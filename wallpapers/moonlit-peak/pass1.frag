// Generated from contrib/asciipaper/moonlit-peak.json by tools/port_asciipaper.py.
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

// defaults: {"speed": 1, "contrast": 1.08, "brightness": 0.015, "gamma": 0.98, "threshold": 0.025, "vivid": 0.35, "fit": 1, "zoom": 1, "backdrop": 0, "skyLimit": 0.40, "flowerWind": 1, "lightFlicker": 0, "tint": "#a8bbc8"}
// Source image with restrained cloud drift and a gentle wind-sway in the foreground flowers.


const float speed=0.9;
const float contrast=1.08;
const float brightness=0.012;
const float gamma=0.96;
const float threshold=0.026;
const float vivid=0.34;
const float fit=0.0;
const float zoom=1.0;
const float backdrop=0.14;
const float skyLimit=0.58;
const float flowerWind=0.0;
const float lightFlicker=0.28;
const vec3 tint=vec3(0.6078431372549019,0.6980392156862745,0.7686274509803922);

vec4 cell(vec2 uv) {
    float t = u_time * speed;
    float ratio = u_aspect / (mediaSize.x / max(mediaSize.y, 1.0));
    vec2 sc = vec2(1.0);
    vec2 bc = vec2(1.0);
    if ((ratio > 1.0) == (fit < 0.5)) sc.x = ratio;
    else sc.y = 1.0 / ratio;
    if (ratio > 1.0) bc.y = 1.0 / ratio;
    else bc.x = ratio;
    sc /= zoom;

    vec2 m = (uv - 0.5) * sc + 0.5;
    float dim = 1.0;
    if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) {
        if (backdrop <= 0.0) return vec4(0.0);
        sc = bc * 0.88;
        m = (uv - 0.5) * sc + 0.5;
        dim = backdrop;
    }

    // Use the original image to identify the foreground vegetation and sky.
    vec3 guide = texture2D(media, clamp(m, 0.001, 0.999)).rgb;
    float topDown = m.y;
    float sky = 1.0 - smoothstep(skyLimit * 0.52, skyLimit, topDown);
    float hi = max(max(guide.r, guide.g), guide.b);
    float bright = smoothstep(0.24, 0.50, hi);
    float warmPetal = smoothstep(0.08, 0.22, guide.r - guide.b)
                    * smoothstep(0.04, 0.15, guide.g - guide.b)
                    * smoothstep(0.30, 0.58, min(guide.r, guide.g));
    float bluePetal = smoothstep(0.10, 0.26, guide.b - guide.r)
                    * smoothstep(0.24, 0.50, guide.b);
    float violetPetal = smoothstep(0.08, 0.20, guide.b - guide.g)
                      * smoothstep(0.06, 0.19, guide.r - guide.g)
                      * smoothstep(0.26, 0.50, hi);
    float flowerPetal = max(max(warmPetal, bluePetal), violetPetal) * bright;
    float foreground = smoothstep(0.50, 0.66, topDown)
                     * (1.0 - smoothstep(0.90, 0.98, topDown));
    float plantMask = foreground * flowerPetal;

    // Clouds slide slowly across the sky. Flowers bend slightly more than their stems.
    vec2 moved = m;
    moved.x += sky * 0.006 * sin(t * 0.22 + topDown * 7.0);
    moved.y += sky * 0.002 * sin(t * 0.17 + m.x * 8.0);
    moved.x += plantMask * flowerWind * 0.008 * sin(t * 0.92 + m.x * 15.0 + topDown * 3.0);
    moved.y += plantMask * flowerWind * 0.0012 * sin(t * 0.92 + m.x * 15.0 + topDown * 3.0);

    vec2 f = sc / u_grid * 0.25;
    vec3 c = (texture2D(media, clamp(moved + vec2(-f.x, -f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2( f.x, -f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2(-f.x,  f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2( f.x,  f.y), 0.001, 0.999)).rgb) * 0.25;

    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float warm = smoothstep(0.045, 0.20, guide.r - guide.b)
               * smoothstep(0.24, 0.48, topDown) * (1.0 - smoothstep(0.92, 0.99, topDown))
               * smoothstep(0.18, 0.50, guide.r);
    float lightSeed = fract(sin(floor(m.x * 210.0) * 12.9898 + floor(m.y * 180.0) * 78.233) * 43758.5453);
    float lightPulse = 0.5 + 0.5 * sin(t * (1.1 + lightSeed * 1.2) + lightSeed * 6.2832);
    float lightBoost = warm * lightFlicker * lightPulse * 0.055;
    c += vec3(lightBoost, lightBoost * 0.48, lightBoost * 0.10);
    l = dot(c, vec3(0.299, 0.587, 0.114));
    l = pow(clamp((l - 0.5) * contrast + 0.5 + brightness, 0.0, 1.0), gamma);
    l *= dim;
    if (l < threshold) return vec4(0.0);

    float cHi = max(max(c.r, c.g), c.b);
    float cLo = min(min(c.r, c.g), c.b);
    float chroma = (cHi - cLo) / max(cHi, 0.001) * smoothstep(0.03, 0.20, cHi);
    vec3 ink = mix(tint, c / max(cHi, 0.001), chroma) * mix(cHi, 1.0, vivid);
    return vec4(ink, l);
}

void main(){
    if(uImageSize.x<1.0 || uImageSize.y<1.0){o=vec4(0.0);return;}
    vec2 uv=gl_FragCoord.xy/uGrid; uv.y=1.0-uv.y;
    o=clamp(cell(uv),0.0,1.0);
}
