// Generated from contrib/asciipaper/yosemite-sunset.json by tools/port_asciipaper.py.
uniform float uTime;
uniform vec2 uGrid, uRes, uImageSize;
uniform sampler2D uImage;
#define u_time uTime
#define u_grid uGrid
#define u_size uRes
#define u_aspect (uRes.x / uRes.y)
#define media uImage
#define mediaSize uImageSize
#define texture2D texture
// Pointer effects are disabled for an input-less wallpaper layer.
const vec2 u_pointer=vec2(0.5), u_velocity=vec2(0.0);
const float u_strength=0.0, u_idle=3600.0, u_down=0.0;
const vec3 u_clicks[8]=vec3[8](vec3(0),vec3(0),vec3(0),vec3(0),vec3(0),vec3(0),vec3(0),vec3(0));
out vec4 o;




vec3 photo(vec2 p) {
    vec2 f = 0.25 / u_grid;
    return 0.25 * (texture2D(media, p + vec2(-f.x, -f.y)).rgb
                 + texture2D(media, p + vec2( f.x, -f.y)).rgb
                 + texture2D(media, p + vec2(-f.x,  f.y)).rgb
                 + texture2D(media, p + vec2( f.x,  f.y)).rgb);
}

// Approximate the photograph's skyline; never drift the granite or trees.
float skyline(float x) {
    float h = mix(0.75, 0.68, smoothstep(0.12, 0.25, x));
    h = mix(h, 0.60, smoothstep(0.25, 0.30, x));
    h = mix(h, 0.55, smoothstep(0.34, 0.43, x));
    h = mix(h, 0.38, smoothstep(0.43, 0.50, x));
    h = mix(h, 0.23, smoothstep(0.50, 0.57, x));
    h = mix(h, 0.21, smoothstep(0.57, 0.66, x));
    h = mix(h, 0.26, smoothstep(0.68, 0.86, x));
    return h;
}

vec4 cell(vec2 uv) {
    float ratio = u_aspect / (mediaSize.x / mediaSize.y);
    vec2 scale = ratio > 1.0 ? vec2(1.0, 1.0 / ratio) : vec2(ratio, 1.0);
    vec2 p = (uv - 0.5) * scale + 0.5;
    vec3 base = photo(p);
    float sky = 1.0 - smoothstep(skyline(p.x) - 0.035, skyline(p.x) - 0.012, p.y);
    float t = u_time;
    vec2 drift = vec2(0.010 * sin(t * 0.14 + p.y * 8.0)
                    + 0.004 * sin(t * 0.23 + p.x * 11.0),
                     0.004 * sin(t * 0.17 + p.x * 7.0));
    vec3 clouds = photo(clamp(p + drift * sky, 0.0, 1.0));
    float light = 1.0 + sky * (0.045 * sin(t * 0.35 + p.x * 9.0)
                            + 0.025 * sin(t * 0.21 - p.y * 13.0));
    vec3 c = mix(base, clouds, sky * 0.92) * light;
    float luminance = dot(c, vec3(0.299, 0.587, 0.114));
    float level = pow(clamp(luminance * 1.18, 0.0, 1.0), 0.78);
    float hi = max(max(c.r, c.g), c.b);
    vec3 ink = c / max(hi, 0.001) * pow(hi, 0.72);
    return vec4(ink * (1.18 + sky * 0.10), level);
}

void main(){
    if(uImageSize.x<1.0 || uImageSize.y<1.0){o=vec4(0.0);return;}
    vec2 uv=gl_FragCoord.xy/uGrid; uv.y=1.0-uv.y;
    o=clamp(cell(uv),0.0,1.0);
}
