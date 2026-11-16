// latte-dawn / pass 2 — full resolution: upscaled sky, three rolling lavender hills with valley mist, grain.
uniform sampler2D uCells;
uniform vec2  uRes;
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
float f1(float x) {   // smooth 1D fbm -> rolling hills
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * n1(x); x = x * 2.1 + 3.7; a *= 0.45; }
    return s;
}

vec3 hill(vec3 col, float y, float top, vec3 tint, vec3 mist, float mistAmt, float px) {
    if (y >= top) return col;
    vec3 c = mix(tint, mist, mistAmt * smoothstep(top - 0.01, top - 0.16, y));   // mist pools in the valley
    c += hex(0xffe3d2) * 0.18 * smoothstep(1.5 * px, 0.0, top - y);             // warm rim from the sunrise
    return c;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float ax = uv.x * uRes.x / uRes.y;
    float px = 1.0 / uRes.y;

    vec3 col = texture(uCells, uv).rgb;

    float t1 = 0.22 + 0.26 * f1(ax * 1.50 + 3.0);    // far
    float t2 = 0.11 + 0.22 * f1(ax * 2.10 + 11.0);   // middle
    float t3 = 0.01 + 0.16 * f1(ax * 2.80 + 27.0);   // near

    col = hill(col, uv.y, t1, hex(0xcfc8ec), hex(0xf6e4ec), 0.55, px);
    col = hill(col, uv.y, t2, hex(0xaaa3dd), hex(0xe9daf0), 0.45, px);
    col = hill(col, uv.y, t3, hex(0x837dc6), hex(0xc4bce8), 0.35, px);

    col += (hash(gl_FragCoord.xy + vec2(floor(fract(uTime * 0.37) * 311.0))) - 0.5) * (2.5 / 255.0);   // dither
    o = vec4(col, 1.0);
}
