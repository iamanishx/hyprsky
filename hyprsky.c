// hyprsky: tiny animated shader wallpapers for wlroots compositors (Hyprland, Sway, ...).
//
// Each wallpaper is a folder under wallpapers/ with:
//   scene.conf  - "cell = W H" (pass1 runs once per WxH screen pixels), "filter = linear|nearest"
//   pass1.frag  - runs at low resolution into a small texture (the expensive part)
//   pass2.frag  - runs per screen pixel and reads pass1 via uCells (keep it cheap)
// Both files get "#version 300 es" + precision prepended. Uniforms: uTime, uGrid, uRes, uCells.
//
// Rendering is capped at --fps and throttled by Wayland frame callbacks, so a hidden wallpaper stops drawing.
// SIGUSR1 reloads the shaders (handy while editing a wallpaper).
#define _GNU_SOURCE
#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include <dirent.h>
#include <limits.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <wayland-client.h>
#include <wayland-egl.h>
#include "wlr-layer-shell-unstable-v1-client-protocol.h"

#define DEFAULT_SCENE "aurora"

static struct wl_compositor *compositor;
static struct zwlr_layer_shell_v1 *layer_shell;
static int width, height, configured, resized;
static volatile sig_atomic_t running = 1, reload;

// ---------------------------------------------------------------- wayland
static void reg_global(void *d, struct wl_registry *r, uint32_t name, const char *iface, uint32_t ver) {
    (void)d;
    if (!strcmp(iface, wl_compositor_interface.name))
        compositor = wl_registry_bind(r, name, &wl_compositor_interface, 4);
    else if (!strcmp(iface, zwlr_layer_shell_v1_interface.name))
        layer_shell = wl_registry_bind(r, name, &zwlr_layer_shell_v1_interface, ver < 4 ? ver : 4);
}
static void reg_remove(void *d, struct wl_registry *r, uint32_t n) { (void)d; (void)r; (void)n; }
static const struct wl_registry_listener reg_l = {reg_global, reg_remove};

static void ls_configure(void *d, struct zwlr_layer_surface_v1 *s, uint32_t serial, uint32_t w, uint32_t h) {
    (void)d;
    zwlr_layer_surface_v1_ack_configure(s, serial);
    if ((int)w != width || (int)h != height) { width = w; height = h; resized = 1; }
    configured = 1;
}
static void ls_closed(void *d, struct zwlr_layer_surface_v1 *s) { (void)d; (void)s; running = 0; }
static const struct zwlr_layer_surface_v1_listener ls_l = {ls_configure, ls_closed};

static void on_signal(int s) { if (s == SIGUSR1) reload = 1; else running = 0; }

// ---------------------------------------------------------------- wallpaper files
static int is_dir(const char *p) { struct stat st; return stat(p, &st) == 0 && S_ISDIR(st.st_mode); }

// Where wallpapers/ folders are looked up, in order.
static int wallpaper_roots(char roots[][PATH_MAX], int max) {
    int n = 0;
    const char *env = getenv("HYPRSKY_WALLPAPERS"), *xdg = getenv("XDG_DATA_HOME"), *home = getenv("HOME");
    if (env && n < max) snprintf(roots[n++], PATH_MAX, "%s", env);
    if (xdg && *xdg && n < max) snprintf(roots[n++], PATH_MAX, "%s/hyprsky/wallpapers", xdg);
    else if (home && n < max) snprintf(roots[n++], PATH_MAX, "%s/.local/share/hyprsky/wallpapers", home);
    if (n < max) snprintf(roots[n++], PATH_MAX, "/usr/local/share/hyprsky/wallpapers");
    if (n < max) snprintf(roots[n++], PATH_MAX, "/usr/share/hyprsky/wallpapers");
    if (n < max) snprintf(roots[n++], PATH_MAX, "./wallpapers");
    return n;
}

static int find_scene(const char *name, char *out) {
    if (strchr(name, '/')) { snprintf(out, PATH_MAX, "%s", name); return is_dir(out); }   // explicit path
    char roots[5][PATH_MAX];
    int n = wallpaper_roots(roots, 5);
    for (int i = 0; i < n; i++) {
        snprintf(out, PATH_MAX, "%.3000s/%.900s", roots[i], name);
        if (is_dir(out)) return 1;
    }
    return 0;
}

static void list_scenes(void) {
    char roots[5][PATH_MAX], seen[64][256];
    int n = wallpaper_roots(roots, 5), nseen = 0;
    for (int i = 0; i < n; i++) {
        DIR *d = opendir(roots[i]);
        if (!d) continue;
        struct dirent *e;
        while ((e = readdir(d))) {
            char p[PATH_MAX + 300];
            int dup = 0;
            if (e->d_name[0] == '.') continue;
            for (int k = 0; k < nseen; k++) dup |= !strcmp(seen[k], e->d_name);   // first one wins, like --scene
            snprintf(p, sizeof p, "%.3000s/%.250s/pass1.frag", roots[i], e->d_name);
            if (dup || access(p, R_OK) != 0) continue;
            printf("%-16s %s/%s\n", e->d_name, roots[i], e->d_name);
            if (nseen < 64) snprintf(seen[nseen++], 256, "%s", e->d_name);
        }
        closedir(d);
    }
}

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    rewind(f);
    char *buf = malloc(len + 1);
    if (fread(buf, 1, len, f) != (size_t)len) { free(buf); fclose(f); return NULL; }
    buf[len] = 0;
    fclose(f);
    return buf;
}

struct scene { int cell_w, cell_h; GLint filter; };

static void read_conf(const char *dir, struct scene *sc) {
    sc->cell_w = sc->cell_h = 4;
    sc->filter = GL_LINEAR;
    char p[PATH_MAX + 16], line[256];
    snprintf(p, sizeof p, "%s/scene.conf", dir);
    FILE *f = fopen(p, "r");
    if (!f) return;
    while (fgets(line, sizeof line, f)) {
        char key[32], v1[32];
        int a, b;
        if (line[0] == '#') continue;
        if (sscanf(line, " cell = %d %d", &a, &b) == 2 && a > 0 && b > 0) { sc->cell_w = a; sc->cell_h = b; }
        else if (sscanf(line, " %31[a-z] = %31s", key, v1) == 2 && !strcmp(key, "filter"))
            sc->filter = strcmp(v1, "nearest") ? GL_LINEAR : GL_NEAREST;
    }
    fclose(f);
}

// ---------------------------------------------------------------- GL helpers
static const char *VS =
    "#version 300 es\n"
    "void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));"
    "gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n";
static const char *FS_HEADER = "#version 300 es\nprecision highp float;\nprecision highp int;\n#line 1\n";

static GLuint compile(GLenum type, const char *src, const char *name) {
    const char *parts[2] = {type == GL_FRAGMENT_SHADER ? FS_HEADER : "", src};
    GLuint s = glCreateShader(type);
    glShaderSource(s, 2, parts, NULL);
    glCompileShader(s);
    GLint ok;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetShaderInfoLog(s, sizeof log, NULL, log);
        fprintf(stderr, "hyprsky: %s:\n%s", name, log);
        glDeleteShader(s);
        return 0;
    }
    return s;
}

static GLuint load_program(const char *dir, const char *file) {
    char path[PATH_MAX + 32];
    snprintf(path, sizeof path, "%s/%s", dir, file);
    char *src = read_file(path);
    if (!src) { fprintf(stderr, "hyprsky: cannot read %s\n", path); return 0; }
    GLuint vs = compile(GL_VERTEX_SHADER, VS, "vertex"), fs = compile(GL_FRAGMENT_SHADER, src, path);
    free(src);
    if (!vs || !fs) return 0;
    GLuint p = glCreateProgram();
    glAttachShader(p, vs);
    glAttachShader(p, fs);
    glLinkProgram(p);
    glDeleteShader(vs);
    glDeleteShader(fs);
    GLint ok;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetProgramInfoLog(p, sizeof log, NULL, log);
        fprintf(stderr, "hyprsky: link %s:\n%s", path, log);
        glDeleteProgram(p);
        return 0;
    }
    return p;
}

struct pass { GLuint prog; GLint uTime, uGrid, uRes, uCells; };

static int load_pass(struct pass *ps, const char *dir, const char *file) {
    GLuint p = load_program(dir, file);
    if (!p) return 0;
    if (ps->prog) glDeleteProgram(ps->prog);
    ps->prog = p;
    ps->uTime = glGetUniformLocation(p, "uTime");
    ps->uGrid = glGetUniformLocation(p, "uGrid");
    ps->uRes = glGetUniformLocation(p, "uRes");
    ps->uCells = glGetUniformLocation(p, "uCells");
    return 1;
}

static void set_uniforms(struct pass *ps, float t, int cols, int rows) {
    glUseProgram(ps->prog);
    if (ps->uTime >= 0) glUniform1f(ps->uTime, t);
    if (ps->uGrid >= 0) glUniform2f(ps->uGrid, cols, rows);
    if (ps->uRes >= 0) glUniform2f(ps->uRes, width, height);
    if (ps->uCells >= 0) glUniform1i(ps->uCells, 0);
}

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec / 1e9; }

static void usage(void) {
    puts("usage: hyprsky [--scene NAME|PATH] [--fps N] [--list]\n"
         "  --scene  wallpaper folder name (default " DEFAULT_SCENE ") or a path to one\n"
         "  --fps    frame cap, 1-60 (default 15)\n"
         "  --list   show installed wallpapers\n"
         "Wallpapers are searched in $HYPRSKY_WALLPAPERS, ~/.local/share/hyprsky/wallpapers,\n"
         "/usr/local/share/hyprsky/wallpapers, /usr/share/hyprsky/wallpapers, ./wallpapers.\n"
         "Send SIGUSR1 (pkill -USR1 hyprsky) to reload the shaders.");
}

// ---------------------------------------------------------------- main
int main(int argc, char **argv) {
    double fps = 15;
    const char *scene_name = DEFAULT_SCENE;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--fps") && i + 1 < argc) fps = atof(argv[++i]);
        else if (!strcmp(argv[i], "--scene") && i + 1 < argc) scene_name = argv[++i];
        else if (!strcmp(argv[i], "--list")) { list_scenes(); return 0; }
        else { usage(); return !strcmp(argv[i], "--help") || !strcmp(argv[i], "-h") ? 0 : 2; }
    }
    if (fps < 1) fps = 1;
    if (fps > 60) fps = 60;

    char scene_dir[PATH_MAX];
    if (!find_scene(scene_name, scene_dir)) {
        fprintf(stderr, "hyprsky: wallpaper '%s' not found (try --list)\n", scene_name);
        return 1;
    }
    struct scene sc;
    read_conf(scene_dir, &sc);

    signal(SIGTERM, on_signal);
    signal(SIGINT, on_signal);
    signal(SIGUSR1, on_signal);

    struct wl_display *dpy = wl_display_connect(NULL);
    if (!dpy) { fprintf(stderr, "hyprsky: no wayland display\n"); return 1; }
    struct wl_registry *reg = wl_display_get_registry(dpy);
    wl_registry_add_listener(reg, &reg_l, NULL);
    wl_display_roundtrip(dpy);
    if (!compositor || !layer_shell) { fprintf(stderr, "hyprsky: compositor lacks wlr-layer-shell\n"); return 1; }

    struct wl_surface *surf = wl_compositor_create_surface(compositor);
    struct zwlr_layer_surface_v1 *ls = zwlr_layer_shell_v1_get_layer_surface(
        layer_shell, surf, NULL, ZWLR_LAYER_SHELL_V1_LAYER_BACKGROUND, "wallpaper");
    zwlr_layer_surface_v1_set_anchor(ls, ZWLR_LAYER_SURFACE_V1_ANCHOR_TOP | ZWLR_LAYER_SURFACE_V1_ANCHOR_BOTTOM |
                                         ZWLR_LAYER_SURFACE_V1_ANCHOR_LEFT | ZWLR_LAYER_SURFACE_V1_ANCHOR_RIGHT);
    zwlr_layer_surface_v1_set_size(ls, 0, 0);
    zwlr_layer_surface_v1_set_exclusive_zone(ls, -1);
    zwlr_layer_surface_v1_add_listener(ls, &ls_l, NULL);
    struct wl_region *empty = wl_compositor_create_region(compositor);
    wl_surface_set_input_region(surf, empty);
    wl_region_destroy(empty);
    wl_surface_commit(surf);
    while (!configured && wl_display_dispatch(dpy) != -1) {}
    if (!width || !height) { fprintf(stderr, "hyprsky: bad size\n"); return 1; }

    struct wl_region *opaque = wl_compositor_create_region(compositor);
    wl_region_add(opaque, 0, 0, INT32_MAX, INT32_MAX);
    wl_surface_set_opaque_region(surf, opaque);
    wl_region_destroy(opaque);

    struct wl_egl_window *win = wl_egl_window_create(surf, width, height);
    EGLDisplay ed = eglGetDisplay((EGLNativeDisplayType)dpy);
    eglInitialize(ed, NULL, NULL);
    eglBindAPI(EGL_OPENGL_ES_API);
    EGLint cattr[] = {EGL_SURFACE_TYPE, EGL_WINDOW_BIT, EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
                      EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_BLUE_SIZE, 8, EGL_ALPHA_SIZE, 0, EGL_NONE};
    EGLConfig cfg;
    EGLint n;
    if (!eglChooseConfig(ed, cattr, &cfg, 1, &n) || n < 1) { fprintf(stderr, "hyprsky: no EGL config\n"); return 1; }
    EGLint xattr[] = {EGL_CONTEXT_MAJOR_VERSION, 3, EGL_NONE};
    EGLContext ctx = eglCreateContext(ed, cfg, EGL_NO_CONTEXT, xattr);
    EGLSurface es = eglCreateWindowSurface(ed, cfg, (EGLNativeWindowType)win, NULL);
    eglMakeCurrent(ed, es, es, ctx);
    eglSwapInterval(ed, 1);

    struct pass p1 = {0}, p2 = {0};
    if (!load_pass(&p1, scene_dir, "pass1.frag") || !load_pass(&p2, scene_dir, "pass2.frag")) return 1;
    fprintf(stderr, "hyprsky: %s, %dx%d @ %.0f fps on %s\n", scene_dir, width, height, fps, glGetString(GL_RENDERER));

    GLuint vao, tex = 0, fbo;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glGenFramebuffers(1, &fbo);
    int cols = 0, rows = 0;
    resized = 1;

    double t0 = now(), next = t0, dt = 1.0 / fps;
    while (running) {
        wl_display_dispatch_pending(dpy);
        if (reload) {
            reload = 0;
            struct scene ns;
            read_conf(scene_dir, &ns);
            int ok1 = load_pass(&p1, scene_dir, "pass1.frag"), ok2 = load_pass(&p2, scene_dir, "pass2.frag");
            if (ns.cell_w != sc.cell_w || ns.cell_h != sc.cell_h || ns.filter != sc.filter) { sc = ns; resized = 1; }
            fprintf(stderr, "hyprsky: reloaded%s\n", ok1 && ok2 ? "" : " (errors above, kept the old shader)");
        }
        if (resized) {
            resized = 0;
            wl_egl_window_resize(win, width, height, 0, 0);
            cols = (width + sc.cell_w - 1) / sc.cell_w;
            rows = (height + sc.cell_h - 1) / sc.cell_h;
            if (tex) glDeleteTextures(1, &tex);
            glGenTextures(1, &tex);
            glBindTexture(GL_TEXTURE_2D, tex);
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, cols, rows, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, sc.filter);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, sc.filter);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
            glBindFramebuffer(GL_FRAMEBUFFER, fbo);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
        }
        float t = (float)fmod(now() - t0 + 40.0, 20000.0);

        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glViewport(0, 0, cols, rows);
        set_uniforms(&p1, t, cols, rows);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, width, height);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, tex);
        set_uniforms(&p2, t, cols, rows);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        // Blocks on the compositor's frame callback, so a hidden wallpaper stops drawing.
        if (!eglSwapBuffers(ed, es)) break;
        if (wl_display_flush(dpy) < 0) break;

        next += dt;
        double w = next - now();
        if (w < 0) { next = now(); continue; }
        struct timespec ts = {(time_t)w, (long)((w - (time_t)w) * 1e9)};
        nanosleep(&ts, NULL);
    }
    eglMakeCurrent(ed, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    eglDestroySurface(ed, es);
    eglDestroyContext(ed, ctx);
    eglTerminate(ed);
    wl_egl_window_destroy(win);
    zwlr_layer_surface_v1_destroy(ls);
    wl_surface_destroy(surf);
    wl_display_disconnect(dpy);
    return 0;
}
