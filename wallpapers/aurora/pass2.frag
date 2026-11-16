// aurora / pass 2 — full resolution: upscaled sky, stars, three mountain ridges, rim light, grain.
uniform sampler2D uCells;   // pass 1 output
uniform vec2  uRes;         // screen size in pixels
uniform float uTime;
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
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
// ridged 1D noise -> sharp mountain peaks
float r1(float x) {
    float s = 0.0, a = 0.55;
    for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(2.0 * n1(x) - 1.0)); x = x * 2.07 + 3.7; a *= 0.48; }
    return s;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float ax = uv.x * uRes.x / uRes.y;
    float px = 1.0 / uRes.y;

    vec3 col = texture(uCells, uv).rgb;

    // stars (2x2 px), fading out toward the horizon
    float h = hash(gl_FragCoord.xy * 0.5);
    if (h > 0.9972)
        col += hex(0xcdd6f4) * (0.45 + 0.55 * sin(uTime * 1.1 + h * 500.0)) * 0.75 * smoothstep(0.3, 0.75, uv.y);

    // aurora light above this column, used to light the ridges
    vec3 glow = texture(uCells, vec2(uv.x, 0.62)).rgb;

    float m1 = 0.17 + 0.30 * pow(r1(ax * 0.75 + 2.0), 2.2);   // far
    float m2 = 0.10 + 0.20 * pow(r1(ax * 1.20 + 9.0), 2.2);   // middle
    float m3 = 0.03 + 0.12 * pow(r1(ax * 1.90 + 21.0), 2.0);  // near

    if (uv.y < m1) {
        col = mix(hex(0x1e1c31), hex(0x2c2843), smoothstep(m1 - 0.06, m1 - 0.30, uv.y)) + glow * 0.12;
        col += glow * 1.2 * smoothstep(2.0 * px, 0.0, m1 - uv.y);   // rim light
    }
    if (uv.y < m2) {
        col = mix(hex(0x121120), hex(0x1d1a2e), smoothstep(m2 - 0.05, m2 - 0.22, uv.y)) + glow * 0.05;
        col += glow * 0.5 * smoothstep(1.5 * px, 0.0, m2 - uv.y);
    }
    if (uv.y < m3) {
        col = hex(0x08080d) + glow * 0.02;
        col += glow * 0.25 * smoothstep(1.2 * px, 0.0, m3 - uv.y);
    }

    col *= 1.0 - 0.30 * smoothstep(0.6, 1.2, length((uv - 0.5) * vec2(1.4, 1.0)));   // vignette
    col += (hash(gl_FragCoord.xy + vec2(floor(fract(uTime * 0.37) * 311.0))) - 0.5) * (3.0 / 255.0);  // grain / dither
    o = vec4(col, 1.0);
}
