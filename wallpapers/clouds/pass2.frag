// clouds / pass 2 — per pixel: look up the cell from pass 1 and draw its 5x7 glyph (scaled 2x in a 12x16 cell).
uniform sampler2D uCells;
uniform vec2  uRes;
uniform float uTime;
out vec4 o;

// 5x7 bitmaps, 7 rows per glyph, 5 bits per row (MSB = left):  ' '  '.'  ':'  ';'  '~'  ')'  '('  'o'  '8'
const int G[63] = int[63](
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 12, 12,
    0, 12, 12, 0, 12, 12, 0,
    0, 12, 12, 0, 12, 12, 8,
    0, 0, 13, 22, 0, 0, 0,
    8, 4, 2, 2, 2, 4, 8,
    2, 4, 8, 8, 8, 4, 2,
    0, 0, 14, 17, 17, 17, 14,
    14, 17, 17, 14, 17, 17, 14);

vec3 hex(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }

void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    ivec2 c = p / ivec2(12, 16);
    int lx = p.x - c.x * 12;
    int ly = 15 - (p.y - c.y * 16);          // from the cell top
    vec4 cell = texelFetch(uCells, c, 0);
    int g = int(cell.x * 15.0 + 0.5);
    int kind = int(cell.w * 3.0 + 0.5);

    vec2 uv = gl_FragCoord.xy / uRes;
    vec3 col = mix(hex(0x0b1018), hex(0x050608), uv.y);
    col = mix(col, hex(0x101826), cell.y * 0.9);   // soft puff behind dense cloud

    bool on = false;
    if (g > 0) {
        int gx = (lx - 1) >> 1, gy = (ly - 1) >> 1;
        if (lx > 0 && ly > 0 && gx < 5 && gy < 7) on = ((G[g * 7 + gy] >> (4 - gx)) & 1) == 1;
    }
    if (on) {
        if (kind == 1) {   // star, one of four blues
            int h = int(fract(float(c.x) * 0.37 + float(c.y) * 0.71) * 4.0);
            col = (h == 0 ? hex(0x14406f) : h == 1 ? hex(0x1b5799) : h == 2 ? hex(0x2a7fd8) : hex(0x4f9fe6)) * cell.z;
        } else {
            col = hex(0x5d7ea4) * cell.z;
        }
    }
    col *= 1.0 - 0.35 * smoothstep(0.55, 1.1, length((uv - 0.5) * vec2(1.3, 1.0)));   // vignette
    o = vec4(col, 1.0);
}
