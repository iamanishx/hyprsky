// clouds / pass 1 — one fragment per 12x16 character cell.
// Output: r = glyph index / 15, g = puff background, b = brightness, a = kind / 3 (0 cloud, 1 star)
uniform float uTime;
uniform vec2  uGrid;   // columns, rows
out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return s;
}

void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    c.y = int(uGrid.y) - 1 - c.y;            // count rows from the top
    vec2 px = vec2(c) * vec2(12.0, 16.0);    // cell position in screen pixels
    float t = uTime;
    float yN = float(c.y) / uGrid.y;

    float far  = fbm(px / 420.0 + vec2(t * 0.010, 3.7));
    float near = fbm(px / 250.0 + vec2(t * 0.026, 0.0) + 0.35 * vec2(far, -far));
    float band = 0.10 * sin(yN * 7.5 + 1.3) + 0.06 * sin(yN * 15.0 + t * 0.02);
    float d = max(smoothstep(0.50, 0.80, near + band), 0.55 * smoothstep(0.58, 0.80, far + band));

    if (d < 0.06) {   // empty sky: occasional twinkling star
        float h = hash(vec2(c) + 0.5);
        if (h > 0.955) { o = vec4(1.0 / 15.0, 0.0, 0.55 + 0.45 * sin(t * 0.9 + h * 90.0), 1.0 / 3.0); return; }
        o = vec4(0.0);
        return;
    }
    float g = floor(clamp(d, 0.0, 0.999) * 9.0);   // index into " .:;~)(o8"
    float lit = clamp(1.15 - yN * 0.5 + 0.25 * (near - far), 0.4, 1.0);
    o = vec4(g / 15.0, smoothstep(0.45, 0.9, d), lit * mix(0.55, 1.0, d), 0.0);
}
