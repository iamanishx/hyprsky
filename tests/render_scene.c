// Headless smoke renderer using the same loader, shader header and uniforms as Hyprsky.
// This does not create a Wayland surface or change the desktop wallpaper.
#define main hyprsky_main
#include "../hyprsky.c"
#undef main
#include <EGL/eglext.h>
#include <stdint.h>

#define CHECK(test) do { if (!(test)) { fprintf(stderr, "render_scene: failed at line %d: %s\n", __LINE__, #test); return 1; } } while (0)

int main(int argc, char **argv) {
    if (argc != 3 && argc != 4 && argc != 5 && argc != 7) {
        fprintf(stderr, "usage: render_scene SCENE_DIR OUTPUT.png [SECONDS [IMAGE.png [WIDTH HEIGHT]]]\n");
        return 2;
    }
    width = argc >= 7 ? atoi(argv[5]) : 640;
    height = argc >= 7 ? atoi(argv[6]) : 360;
    CHECK(width > 0 && height > 0 && width <= 4096 && height <= 4096);
    float time = argc >= 4 ? strtof(argv[3], NULL) : 5.0f;
    struct scene sc;
    read_conf(argv[1], &sc);
    if (argc >= 5 && *argv[4]) snprintf(sc.image, sizeof sc.image, "%s", argv[4]);
    EGLDisplay ed = eglGetPlatformDisplay(EGL_PLATFORM_SURFACELESS_MESA, EGL_DEFAULT_DISPLAY, NULL);
    CHECK(ed != EGL_NO_DISPLAY && eglInitialize(ed, NULL, NULL));
    CHECK(eglBindAPI(EGL_OPENGL_ES_API));
    EGLint attributes[] = {EGL_SURFACE_TYPE, EGL_PBUFFER_BIT, EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
                           EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_BLUE_SIZE, 8, EGL_ALPHA_SIZE, 8, EGL_NONE};
    EGLConfig cfg; EGLint count;
    CHECK(eglChooseConfig(ed, attributes, &cfg, 1, &count) && count > 0);
    EGLint context_attributes[] = {EGL_CONTEXT_MAJOR_VERSION, 3, EGL_NONE};
    EGLint surface_attributes[] = {EGL_WIDTH, width, EGL_HEIGHT, height, EGL_NONE};
    EGLContext ctx = eglCreateContext(ed, cfg, EGL_NO_CONTEXT, context_attributes);
    EGLSurface surf = eglCreatePbufferSurface(ed, cfg, surface_attributes);
    CHECK(ctx != EGL_NO_CONTEXT && surf != EGL_NO_SURFACE && eglMakeCurrent(ed, surf, surf, ctx));
    struct pass p1 = {0}, p2 = {0};
    CHECK(load_pass(&p1, argv[1], "pass1.frag") && load_pass(&p2, argv[1], "pass2.frag"));
    GLuint image = load_image(sc.image, 0), vao, texture, fbo;
    CHECK(!*sc.image || image);
    int cols = (width + sc.cell_w - 1) / sc.cell_w;
    int rows = (height + sc.cell_h - 1) / sc.cell_h;
    glGenVertexArrays(1, &vao); glBindVertexArray(vao);
    glGenTextures(1, &texture); glBindTexture(GL_TEXTURE_2D, texture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, cols, rows, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, sc.filter);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, sc.filter);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glGenFramebuffers(1, &fbo); glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, texture, 0);
    CHECK(glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE);
    glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, image);
    glActiveTexture(GL_TEXTURE0);
    glViewport(0, 0, cols, rows); set_uniforms(&p1, time, cols, rows);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    glBindFramebuffer(GL_FRAMEBUFFER, 0); glViewport(0, 0, width, height);
    glBindTexture(GL_TEXTURE_2D, texture); set_uniforms(&p2, time, cols, rows);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    CHECK(glGetError() == GL_NO_ERROR);
    size_t stride = (size_t)width * 4, size = stride * height;
    unsigned char *pixels = malloc(size), *flipped = malloc(size);
    CHECK(pixels && flipped);
    glReadPixels(0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
    CHECK(glGetError() == GL_NO_ERROR);
    uint64_t sum = 0, hash = UINT64_C(14695981039346656037);
    int opaque = 1;
    for (size_t i = 0; i < size; i++) {
        hash = (hash ^ pixels[i]) * UINT64_C(1099511628211);
        if (i % 4 != 3) sum += pixels[i]; else opaque &= pixels[i] == 255;
    }
    for (int y = 0; y < height; y++) memcpy(flipped + y * stride, pixels + (height - 1 - y) * stride, stride);
    png_image png;
    memset(&png, 0, sizeof png);
    png.version = PNG_IMAGE_VERSION; png.width = width; png.height = height; png.format = PNG_FORMAT_RGBA;
    CHECK(png_image_write_to_file(&png, argv[2], 0, flipped, 0, NULL));
    printf("%llu %llu %d\n", (unsigned long long)hash, (unsigned long long)sum, opaque);
    free(pixels); free(flipped);
    eglMakeCurrent(ed, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    eglDestroySurface(ed, surf); eglDestroyContext(ed, ctx); eglTerminate(ed);
    return 0;
}
