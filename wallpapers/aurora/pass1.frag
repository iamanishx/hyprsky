// aurora / pass 1 — runs at quarter resolution: sky gradient + three aurora curtains.
uniform float uTime;
uniform vec2  uGrid;   // size of this low-res pass in pixels
out vec4 o;

vec3 hex(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }

uint pcg(uint v) {
    uint s = v * 747796405u + 2891336453u;
    uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (w >> 22u) ^ w;
}
float hash(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)) + ivec2(65536));
    return float(pcg(q.x + pcg(q.y)) & 0xffffffu) / 16777215.0;
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
float f1(float x) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * n1(x); x = x * 2.1 + 3.7; a *= 0.5; }
    return s;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uGrid;
    float ax = uv.x * uGrid.x / uGrid.y;   // aspect-correct x
    float t = uTime;

    // night sky with a faint mauve haze near the horizon
    vec3 col = mix(hex(0x161427), hex(0x06060b), smoothstep(0.05, 0.95, uv.y));
    col += hex(0x3a2550) * 0.30 * exp(-max(uv.y - 0.2, 0.0) * 5.0);

    vec3 au = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        // wavy lower edge of the curtain
        float base = 0.52 + 0.10 * fi
                   + 0.22 * (f1(ax * 0.9 + fi * 13.0 + t * 0.012) - 0.5)
                   + 0.04 * sin(ax * 3.1 + fi * 2.0 + t * 0.05);
        float dy = uv.y - base;
        float body  = dy > 0.0 ? exp(-dy * (6.5 - fi * 1.6)) : exp(dy * 45.0);   // sharp bottom, soft fade up
        float rays  = 0.15 + 1.1 * noise(vec2(ax * 26.0 + fi * 7.0 + f1(ax * 1.7 + t * 0.025) * 7.0, t * 0.07));
        float flick = 0.45 + 0.55 * noise(vec2(ax * 2.2 - t * 0.04, fi * 5.0 + t * 0.01));
        // teal/green at the base, mauve at the top
        vec3 c = mix(i == 1 ? hex(0x3fd6e0) : hex(0x3be3a6), hex(0xb07cf7), smoothstep(0.02, 0.30, dy));
        c = mix(c, hex(0xa6e3a1), 0.35 * (1.0 - fi * 0.5) * exp(-abs(dy) * 25.0));
        au += c * body * rays * flick * (0.62 - 0.14 * fi);
    }
    o = vec4(col + au * 1.05, 1.0);
}
