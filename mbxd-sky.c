// mbxd-sky: tiny animated ASCII-cloud wallpaper for wlroots/Hyprland.
// Pass 1 computes clouds once per character cell into a tiny texture
// (160x68 on 1080p); pass 2 just draws glyph bitmaps from it. Capped FPS,
// and it naturally pauses when the compositor stops sending frame callbacks.
#define _GNU_SOURCE
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES3/gl3.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <wayland-client.h>
#include <wayland-egl.h>
#include "wlr-layer-shell-unstable-v1-client-protocol.h"

#define CELL_W 12
#define CELL_H 16

static struct wl_compositor *compositor;
static struct zwlr_layer_shell_v1 *layer_shell;
static int width, height, configured, resized, running = 1;

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

static void on_signal(int s) { (void)s; running = 0; }

static const char *VS =
    "#version 300 es\n"
    "void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));"
    "gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n";

// ---- pass 1: one fragment per character cell ----
static const char *FS_CELLS =
    "#version 300 es\n"
    "precision highp float; precision highp int;\n"
    "uniform float uTime; uniform vec2 uGrid; out vec4 o;\n"
    "const int L[28]=int[28](17,27,21,21,17,17,17, 30,17,17,30,17,17,30,"
    "                        17,17,10,4,10,17,17, 30,17,17,17,17,17,30);\n"
    "const int SX=1, SY=1, TW=(4*6-1)*SX, TH=7*SY;\n"
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n"
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);"
    " return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}\n"
    "float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=0.5;}return s;}\n"
    "ivec2 org(){return ivec2((int(uGrid.x)-TW)/2, int(uGrid.y*0.40)-TH/2);}\n"
    "bool body(ivec2 c){ivec2 l=c-org(); if(l.x<0||l.y<0||l.x>=TW||l.y>=TH) return false;"
    " int px=l.x/SX, k=px/6, col=px-k*6; if(col>4) return false;"
    " return ((L[k*7+l.y/SY]>>(4-col))&1)==1;}\n"
    "void main(){\n"
    " ivec2 c=ivec2(gl_FragCoord.xy); c.y=int(uGrid.y)-1-c.y;\n"   // c.y counts from the top
    " vec2 px=vec2(c)*vec2(12.0,16.0); float t=uTime;\n"
    " float yN=float(c.y)/uGrid.y;\n"
    " float far =fbm(px/420.0+vec2(t*0.010,3.7));\n"
    " float near=fbm(px/250.0+vec2(t*0.026,0.0)+0.35*vec2(far,-far));\n"
    " float band=0.10*sin(yN*7.5+1.3)+0.06*sin(yN*15.0+t*0.02);\n"
    " float d=max(smoothstep(0.50,0.80,near+band), 0.55*smoothstep(0.58,0.80,far+band));\n"
    " if(d<0.06){ float h=hash(vec2(c)+0.5);"
    "   if(h>0.955){ float tw=0.55+0.45*sin(t*0.9+h*90.0); o=vec4(1.0/15.0,0.0,tw,1.0/3.0); return; }"
    "   o=vec4(0.0); return; }\n"
    " float g=floor(clamp(d,0.0,0.999)*9.0);\n"
    " float lit=clamp(1.15-yN*0.5+0.25*(near-far),0.4,1.0);\n"
    " o=vec4(g/15.0, smoothstep(0.45,0.9,d), lit*mix(0.55,1.0,d), 0.0);\n"
    "}\n";

// ---- pass 2: per pixel, just a glyph bitmap lookup ----
static const char *FS_DRAW =
    "#version 300 es\n"
    "precision highp float; precision highp int;\n"
    "uniform sampler2D uCells; uniform vec2 uRes; uniform float uTime; out vec4 o;\n"
    //           ' '        '.'        ':'        ';'        '~'
    "const int G[63]=int[63](0,0,0,0,0,0,0, 0,0,0,0,0,12,12, 0,12,12,0,12,12,0, 0,12,12,0,12,12,8,"
    "  0,0,13,22,0,0,0,"
    //   ')'                  '('                  'o'                  '8'
    "  8,4,2,2,2,4,8,  2,4,8,8,8,4,2,  0,0,14,17,17,17,14,  14,17,17,14,17,17,14);\n"
    "vec3 hex(int h){return vec3(float((h>>16)&255),float((h>>8)&255),float(h&255))/255.0;}\n"
    "void main(){\n"
    " ivec2 p=ivec2(gl_FragCoord.xy); ivec2 c=p/ivec2(12,16);\n"
    " int lx=p.x-c.x*12, ly=15-(p.y-c.y*16);\n"                  // ly counts from the cell top
    " vec4 cell=texelFetch(uCells,c,0);\n"
    " int g=int(cell.x*15.0+0.5), kind=int(cell.w*3.0+0.5);\n"
    " vec2 uv=gl_FragCoord.xy/uRes;\n"
    " vec3 col=mix(hex(0x0b1018),hex(0x050608),uv.y);\n"
    " col=mix(col,hex(0x101826),cell.y*0.9);\n"
    " bool on=false;\n"
    " if(g==9) on=lx<11&&ly<15;\n"
    " else if(g==10) on=lx<11&&ly<15&&(((lx>>1)+(ly>>1))&1)==0;\n"
    " else if(g>0){ int gx=(lx-1)>>1, gy=(ly-1)>>1;"
    "   if(lx>0&&ly>0&&gx<5&&gy<7) on=((G[g*7+gy]>>(4-gx))&1)==1; }\n"
    " if(on){\n"
    "  vec3 fg;\n"
    "  if(kind==2){ fg=hex(0x3f6e9e); }\n"
    "  else if(kind==3) fg=hex(0x0e1a2a);\n"
    "  else if(kind==1){ int h=int(fract(float(c.x)*0.37+float(c.y)*0.71)*4.0);"
    "    fg=h==0?hex(0x14406f):h==1?hex(0x1b5799):h==2?hex(0x2a7fd8):hex(0x4f9fe6); fg*=cell.z; }\n"
    "  else fg=hex(0x5d7ea4)*cell.z;\n"
    "  col=fg;\n"
    " }\n"
    " col*=1.0-0.35*smoothstep(0.55,1.1,length((uv-0.5)*vec2(1.3,1.0)));\n"
    " o=vec4(col,1.0);\n"
    "}\n";


// ================= scene "aurora": Catppuccin Mocha aurora over mountains =================
#define AU_COMMON \
    "#version 300 es\n" \
    "precision highp float; precision highp int;\n" \
    "vec3 hex(int h){return vec3(float((h>>16)&255),float((h>>8)&255),float(h&255))/255.0;}\n" \
    "uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return (w>>22u)^w;}\n" \
    "float hash(vec2 p){uvec2 q=uvec2(ivec2(floor(p))+ivec2(65536));return float(pcg(q.x+pcg(q.y))&0xffffffu)/16777215.0;}\n" \
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);" \
    " return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}\n" \
    "float h1(float x){return fract(sin(x*127.1)*43758.5453);}\n" \
    "float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(h1(i),h1(i+1.0),f);}\n" \
    "float f1(float x){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*n1(x);x=x*2.1+3.7;a*=0.5;}return s;}\n" \
    "float r1(float x){float s=0.0,a=0.55;for(int i=0;i<5;i++){s+=a*(1.0-abs(2.0*n1(x)-1.0));x=x*2.07+3.7;a*=0.48;}return s;}\n"

// pass 1 at quarter resolution: sky gradient + aurora curtains (all soft, so low-res is invisible)
static const char *AU_SKY = AU_COMMON
    "uniform float uTime; uniform vec2 uGrid; out vec4 o;\n"
    "void main(){\n"
    " vec2 uv=gl_FragCoord.xy/uGrid; float ax=uv.x*uGrid.x/uGrid.y, t=uTime;\n"
    " vec3 col=mix(hex(0x161427),hex(0x06060b),smoothstep(0.05,0.95,uv.y));\n"
    " col+=hex(0x3a2550)*0.30*exp(-max(uv.y-0.2,0.0)*5.0);\n"
    " vec3 au=vec3(0.0);\n"
    " for(int i=0;i<3;i++){ float fi=float(i);\n"
    "  float base=0.52+0.10*fi+0.22*(f1(ax*0.9+fi*13.0+t*0.012)-0.5)+0.04*sin(ax*3.1+fi*2.0+t*0.05);\n"
    "  float dy=uv.y-base;\n"
    "  float body=dy>0.0?exp(-dy*(6.5-fi*1.6)):exp(dy*45.0);\n"
    "  float rays=0.15+1.1*noise(vec2(ax*26.0+fi*7.0+f1(ax*1.7+t*0.025)*7.0,t*0.07));\n"
    "  float flick=0.45+0.55*noise(vec2(ax*2.2-t*0.04,fi*5.0+t*0.01));\n"
    "  vec3 c=mix(i==1?hex(0x3fd6e0):hex(0x3be3a6),hex(0xb07cf7),smoothstep(0.02,0.30,dy));\n"
    "  c=mix(c,hex(0xa6e3a1),0.35*(1.0-fi*0.5)*exp(-abs(dy)*25.0));\n"
    "  au+=c*body*rays*flick*(0.62-0.14*fi);\n"
    " }\n"
    " o=vec4(col+au*1.05,1.0);\n"
    "}\n";

// pass 2 full resolution: upscale sky, stars, three mountain ridges, rim light, mist, grain
static const char *AU_DRAW = AU_COMMON
    "uniform sampler2D uCells; uniform vec2 uRes; uniform float uTime; out vec4 o;\n"
    "void main(){\n"
    " vec2 uv=gl_FragCoord.xy/uRes; float ax=uv.x*uRes.x/uRes.y, px=1.0/uRes.y;\n"
    " vec3 col=texture(uCells,uv).rgb;\n"
    " float h=hash(gl_FragCoord.xy*0.5);\n"
    " if(h>0.9972) col+=hex(0xcdd6f4)*(0.45+0.55*sin(uTime*1.1+h*500.0))*0.75*smoothstep(0.3,0.75,uv.y);\n"
    " vec3 glow=texture(uCells,vec2(uv.x,0.62)).rgb;\n"
    " float m1=0.17+0.30*pow(r1(ax*0.75+2.0),2.2);\n"
    " float m2=0.10+0.20*pow(r1(ax*1.2+9.0),2.2);\n"
    " float m3=0.03+0.12*pow(r1(ax*1.9+21.0),2.0);\n"
    " if(uv.y<m1){ col=mix(hex(0x1e1c31),hex(0x2c2843),smoothstep(m1-0.06,m1-0.30,uv.y))+glow*0.12;"
    "   col+=glow*1.2*smoothstep(2.0*px,0.0,m1-uv.y); }\n"
    " if(uv.y<m2){ col=mix(hex(0x121120),hex(0x1d1a2e),smoothstep(m2-0.05,m2-0.22,uv.y))+glow*0.05;"
    "   col+=glow*0.5*smoothstep(1.5*px,0.0,m2-uv.y); }\n"
    " if(uv.y<m3){ col=hex(0x08080d)+glow*0.02; col+=glow*0.25*smoothstep(1.2*px,0.0,m3-uv.y); }\n"
    " col*=1.0-0.30*smoothstep(0.6,1.2,length((uv-0.5)*vec2(1.4,1.0)));\n"
    " col+=(hash(gl_FragCoord.xy+vec2(floor(fract(uTime*0.37)*311.0)))-0.5)*(3.0/255.0);\n"
    " o=vec4(col,1.0);\n"
    "}\n";

static GLuint compile(GLenum type, const char *src) {
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, NULL);
    glCompileShader(s);
    GLint ok; glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) { char log[4096]; glGetShaderInfoLog(s, sizeof log, NULL, log); fprintf(stderr, "shader: %s\n", log); exit(1); }
    return s;
}
static GLuint program(const char *fs) {
    GLuint p = glCreateProgram();
    glAttachShader(p, compile(GL_VERTEX_SHADER, VS));
    glAttachShader(p, compile(GL_FRAGMENT_SHADER, fs));
    glLinkProgram(p);
    GLint ok; glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if (!ok) { char log[4096]; glGetProgramInfoLog(p, sizeof log, NULL, log); fprintf(stderr, "link: %s\n", log); exit(1); }
    return p;
}

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec / 1e9; }

int main(int argc, char **argv) {
    double fps = 15;
    int aurora = 0;
    for (int i = 1; i < argc; i++)
        if (!strcmp(argv[i], "--fps") && i + 1 < argc) fps = atof(argv[++i]);
        else if (!strcmp(argv[i], "--scene") && i + 1 < argc) aurora = !strcmp(argv[++i], "aurora");
    if (fps < 1) fps = 1;
    if (fps > 60) fps = 60;
    signal(SIGTERM, on_signal);
    signal(SIGINT, on_signal);

    struct wl_display *dpy = wl_display_connect(NULL);
    if (!dpy) { fprintf(stderr, "no wayland display\n"); return 1; }
    struct wl_registry *reg = wl_display_get_registry(dpy);
    wl_registry_add_listener(reg, &reg_l, NULL);
    wl_display_roundtrip(dpy);
    if (!compositor || !layer_shell) { fprintf(stderr, "compositor lacks layer-shell\n"); return 1; }

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
    if (!width || !height) { fprintf(stderr, "bad size\n"); return 1; }

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
    EGLConfig cfg; EGLint n;
    if (!eglChooseConfig(ed, cattr, &cfg, 1, &n) || n < 1) { fprintf(stderr, "no egl config\n"); return 1; }
    EGLint xattr[] = {EGL_CONTEXT_MAJOR_VERSION, 3, EGL_NONE};
    EGLContext ctx = eglCreateContext(ed, cfg, EGL_NO_CONTEXT, xattr);
    EGLSurface es = eglCreateWindowSurface(ed, cfg, (EGLNativeWindowType)win, NULL);
    eglMakeCurrent(ed, es, es, ctx);
    eglSwapInterval(ed, 1);
    fprintf(stderr, "mbxd-sky: %dx%d @ %.0f fps on %s\n", width, height, fps, glGetString(GL_RENDERER));

    GLuint pcell = program(aurora ? AU_SKY : FS_CELLS), pdraw = program(aurora ? AU_DRAW : FS_DRAW), vao, tex = 0, fbo;
    glGenVertexArrays(1, &vao); glBindVertexArray(vao);
    glGenFramebuffers(1, &fbo);
    GLint uT1 = glGetUniformLocation(pcell, "uTime"), uG = glGetUniformLocation(pcell, "uGrid");
    GLint uT2 = glGetUniformLocation(pdraw, "uTime"), uR = glGetUniformLocation(pdraw, "uRes");
    GLint uC = glGetUniformLocation(pdraw, "uCells");
    int cols = 0, rows = 0;
    resized = 1;

    double t0 = now(), next = t0, dt = 1.0 / fps;
    while (running) {
        wl_display_dispatch_pending(dpy);
        if (resized) {
            resized = 0;
            wl_egl_window_resize(win, width, height, 0, 0);
            if (aurora) { cols = (width + 3) / 4; rows = (height + 3) / 4; }
            else { cols = (width + CELL_W - 1) / CELL_W; rows = (height + CELL_H - 1) / CELL_H; }
            if (tex) glDeleteTextures(1, &tex);
            glGenTextures(1, &tex); glBindTexture(GL_TEXTURE_2D, tex);
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, cols, rows, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
            GLint filt = aurora ? GL_LINEAR : GL_NEAREST;
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filt);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filt);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
            glBindFramebuffer(GL_FRAMEBUFFER, fbo);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
        }
        float t = (float)fmod(now() - t0 + 40.0, 20000.0);

        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glViewport(0, 0, cols, rows);
        glUseProgram(pcell);
        glUniform1f(uT1, t); glUniform2f(uG, cols, rows);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, width, height);
        glUseProgram(pdraw);
        glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, tex);
        glUniform1i(uC, 0); glUniform1f(uT2, t); glUniform2f(uR, width, height);
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
    eglDestroySurface(ed, es); eglDestroyContext(ed, ctx); eglTerminate(ed);
    wl_egl_window_destroy(win);
    zwlr_layer_surface_v1_destroy(ls); wl_surface_destroy(surf);
    wl_display_disconnect(dpy);
    return 0;
}
