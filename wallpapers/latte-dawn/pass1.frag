// latte-dawn / pass 1 — quarter resolution: pastel sky, sun with halo, two layers of soft clouds.
uniform float uTime;
uniform vec2  uGrid;
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
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.02 + vec2(11.3, 7.9); a *= 0.5; }
    return s;
}

const vec2 SUN = vec2(0.68, 0.45);   // x as a fraction of width, y of height

void main() {
    vec2 uv = gl_FragCoord.xy / uGrid;
    float aspect = uGrid.x / uGrid.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    float t = uTime;

    // peach horizon -> rose -> soft periwinkle
    vec3 col = mix(hex(0xfcdccb), hex(0xf0d9ec), smoothstep(0.12, 0.50, uv.y));
    col = mix(col, hex(0xbfcaf3), smoothstep(0.45, 1.00, uv.y));

    // sun: wide warm halo, then the disc
    float sd = length(p - vec2(SUN.x * aspect, SUN.y));
    col = mix(col, hex(0xffd6bd), 0.50 * exp(-sd * 3.0));
    col = mix(col, hex(0xffeee0), 0.65 * exp(-sd * 11.0));
    col = mix(col, mix(hex(0xffe3cc), hex(0xfff7ee), smoothstep(0.055, 0.0, sd)), smoothstep(0.058, 0.051, sd));

    // two cloud layers: far (slow, faint) and near (faster, fuller); stretched for long stratus shapes
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        vec2 q = vec2(p.x * (1.4 + fk * 0.5) + t * (0.004 + fk * 0.006) + fk * 9.0, p.y * (3.6 + fk) + fk * 4.0);
        q += 0.45 * vec2(fbm(q * 0.6 + fk * 3.1), 0.0);
        float n = fbm(q);
        float band = smoothstep(0.42, 0.62, uv.y) * smoothstep(1.15, 0.85, uv.y);
        float c = smoothstep(0.44 - fk * 0.03, 0.70, n) * band;
        // light from the sun side: compare density toward the sun
        float lit = clamp(0.55 + (n - fbm(q + vec2(-0.07, 0.10))) * 7.0, 0.0, 1.0);
        vec3 cc = mix(hex(0xc4bde9), hex(0xfffdfb), lit);
        cc = mix(cc, hex(0xffd9cc), 0.35 * exp(-sd * 3.0));   // pink edges near the sun
        col = mix(col, cc, c * (0.80 + fk * 0.15));
    }
    o = vec4(col, 1.0);
}
