// thunder / pass 1 — half resolution: small arcs crackling along the line, drifting embers.
// alpha = flash strength read by pass 2 (always 0 now that the big strikes are gone).
uniform float uTime;
uniform vec2  uGrid;
uniform vec2  uImageSize;   // (0,0) without a picture
out vec4 o;

const float Y0 = 0.125;     // horizon line height (fraction of screen height); keep in sync with pass2
const float IMG_X = 0.80;   // picture centre; keep in sync with pass2

vec3 hex(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }
float h1(float x) { return fract(sin(x * 127.1 + 31.7) * 43758.5453); }
// piecewise-linear noise: straight segments with sharp kinks, which is what lightning looks like
float zig(float x) { float i = floor(x); return mix(h1(i), h1(i + 1.0), fract(x)) * 2.0 - 1.0; }
float jag(float x, float seed) {
    float s = 0.0, a = 1.0, f = 1.0;
    for (int i = 0; i < 5; i++) { s += a * zig(x * f + seed * 13.7 + float(i) * 5.3); f *= 2.3; a *= 0.48; }
    return s;
}

// glow of a bolt at horizontal distance d (aspect units); px = one pass1 pixel in those units
vec3 bolt(float d, float px, float k) {
    float core = smoothstep(1.3 * px, 0.0, d);
    vec3 c = hex(0xfff3c4) * core;
    c += hex(0xffc21a) * (exp(-d / (3.0 * px)) * 0.85 + exp(-d / (14.0 * px)) * 0.25);
    c += hex(0xff8a00) * exp(-d / (45.0 * px)) * 0.08;
    return c * k;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uGrid;
    float aspect = uGrid.x / uGrid.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    float px = 1.0 / uGrid.y;
    float t = uTime;
    vec3 col = vec3(0.0);
    float flash = 0.0;

    // ---- small arcs crackling along the line (re-rolled ~7 times a second)
    for (int a = 0; a < 3; a++) {
        float fa = float(a);
        float slot = floor(t * 7.0 + fa * 0.33);
        if (h1(slot * 1.3 + fa * 4.0) > 0.55) continue;
        float xa = (0.05 + 0.85 * h1(slot * 2.1 + fa)) * aspect;
        if (uImageSize.x > 0.0 && a < 2) xa = (IMG_X - 0.13 + 0.20 * h1(slot * 2.1 + fa)) * aspect;   // crackle at the feet
        float w = 0.05 + 0.10 * h1(slot * 4.7 + fa);
        float u = (p.x - xa) / w;
        if (u < 0.0 || u > 1.0) continue;
        float yc = Y0 + (0.015 + 0.04 * h1(slot + fa * 2.0)) * sin(3.14159 * u) + 0.012 * jag(u * 5.0, slot + fa);
        col += bolt(abs(p.y - yc), px, 0.45 * sin(3.14159 * u));
    }

    // ---- faint embers drifting up
    vec2 g = vec2(p.x * 40.0, p.y * 40.0 - t * 0.6);
    vec2 gi = floor(g);
    float e = h1(gi.x * 17.0 + gi.y * 131.0);
    if (e > 0.985 && p.y > Y0) {
        vec2 f = fract(g) - 0.5;
        col += hex(0xffb020) * smoothstep(0.22, 0.0, length(f)) * 0.8 * (0.5 + 0.5 * sin(t * 2.0 + e * 60.0)) * smoothstep(0.9, 0.2, p.y);
    }

    o = vec4(col, clamp(flash, 0.0, 1.0));
}
