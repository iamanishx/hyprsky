// thunder / pass 2 — full resolution: optional character standing on the line, sharp gold horizon line
// with a travelling pulse, rippled floor reflection of everything above.
uniform sampler2D uCells;
uniform vec2  uRes;
uniform float uTime;
uniform sampler2D uImage;     // optional picture (scene.conf "image =" or --image); feet go on the line
uniform vec2  uImageSize;     // (0,0) when there is no picture
out vec4 o;

const float Y0 = 0.125;      // horizon line height; keep in sync with pass1
const float IMG_X = 0.80;    // picture centre, fraction of screen width; keep in sync with pass1
const float IMG_H = 0.36;    // picture height, fraction of screen height

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

// everything above the line: pass1 + the picture
vec3 above(vec2 uv) {
    vec3 c = texture(uCells, uv).rgb;
    if (uImageSize.x > 0.0) {
        float w = IMG_H * (uImageSize.x / uImageSize.y) * (uRes.y / uRes.x);
        vec2 iuv = vec2((uv.x - (IMG_X - 0.5 * w)) / w, (uv.y - Y0) / IMG_H);
        if (iuv.x >= 0.0 && iuv.x <= 1.0 && iuv.y >= 0.0 && iuv.y <= 1.0) {
            vec4 s = texture(uImage, vec2(iuv.x, 1.0 - iuv.y));
            c = mix(c, s.rgb, s.a);
        }
    }
    return c;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float px = 1.0 / uRes.y;
    float t = uTime;
    float flash = texture(uCells, vec2(0.5, 0.5)).a;

    vec3 col;
    if (uv.y >= Y0) {
        col = above(uv);
    } else {
        // mirror above the line, with a soft ripple that grows with depth
        float depth = (Y0 - uv.y) / Y0;
        float rx = uv.x + 0.004 * depth * sin(uv.y * 420.0 + t * 1.7) + 0.002 * depth * sin(uv.y * 977.0 - t * 2.3);
        col = above(vec2(rx, 2.0 * Y0 - uv.y)) * 0.45 * exp(-depth * 2.2);
    }

    // the horizon line: dim amber on the left, bright gold on the right, 2 px core + bloom
    float dy = abs(uv.y - Y0) / px;
    float ramp = smoothstep(0.02, 0.75, uv.x);
    vec3 lineCol = mix(hex(0x6b3200), hex(0xffd23a), ramp);
    float pulse = exp(-pow((uv.x - fract(t * 0.045)) * 9.0, 2.0));   // light running along the line
    float k = (0.35 + 0.65 * ramp) + 0.8 * pulse + 1.2 * flash;
    col += lineCol * smoothstep(1.6, 0.4, dy) * k;
    col += lineCol * exp(-dy * 0.15) * 0.16 * k;

    col += (hash(gl_FragCoord.xy + vec2(floor(fract(t * 0.37) * 311.0))) - 0.5) * (2.0 / 255.0);   // dither
    o = vec4(col, 1.0);
}
