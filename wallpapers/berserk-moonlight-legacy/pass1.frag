// Generated from contrib/asciipaper/berserk-moonlight.before-sky-rebuild.json by tools/port_asciipaper.py.
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

// defaults: {"speed": 1, "fit": 1, "zoom": 1, "contrast": 1.18, "brightness": 0.0, "gamma": 0.94, "threshold": 0.035, "vivid": 0.08, "tint": "#ffffff"}
// Preserve the manga artwork, with slow drifting snow, slight cloud movement, and moon glow.


const float speed=1.0;
const float fit=1.0;
const float zoom=1.0;
const float contrast=1.18;
const float brightness=0.0;
const float gamma=0.94;
const float threshold=0.035;
const float vivid=0.08;
const vec3 tint=vec3(1.0,1.0,1.0);

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
        v += a * noise2(p);
        p = p * 2.03 + vec2(11.7, 7.3);
        a *= 0.5;
    }
    return v;
}

vec4 cell(vec2 uv) {
    float t = u_time * speed;
    float ratio = u_aspect / (mediaSize.x / max(mediaSize.y, 1.0));
    vec2 sc = vec2(1.0);
    if ((ratio > 1.0) == (fit < 0.5)) sc.x = ratio;
    else sc.y = 1.0 / ratio;
    sc /= zoom;
    vec2 m = (uv - 0.5) * sc + 0.5;
    if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return vec4(0.0);

    vec3 guide = texture2D(media, clamp(m, 0.001, 0.999)).rgb;
    float topDown = m.y;
    // Let the low clouds at the lower-left edge drift, while keeping Guts and the moon fixed.
    float clouds = (1.0 - smoothstep(0.30, 0.43, m.x)) * smoothstep(0.74, 0.86, topDown);
    vec2 moved = m;
    moved.x += clouds * 0.006 * sin(t * 0.18 + topDown * 8.0);
    moved.y += clouds * 0.0015 * sin(t * 0.14 + m.x * 10.0);

    // Half the previous footprint averaging to keep fine manga ink and stars crisp.
    vec2 f = sc / u_grid * 0.125;
    vec3 c = (texture2D(media, clamp(moved + vec2(-f.x, -f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2( f.x, -f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2(-f.x,  f.y), 0.001, 0.999)).rgb
            + texture2D(media, clamp(moved + vec2( f.x,  f.y), 0.001, 0.999)).rgb) * 0.25;

    float sourceLuma = dot(guide, vec3(0.299, 0.587, 0.114));
    // A few low-contrast drifting wisps extend the cloud bank without veiling the figure.
    float cloudEnvelope = (1.0 - smoothstep(0.26, 0.49, m.x)) * smoothstep(0.76, 0.84, topDown);
    vec2 cloudUv = m * vec2(8.0, 17.0) + vec2(t * 0.055, -t * 0.018);
    float haze = smoothstep(0.43, 0.71, fbm(cloudUv)) * cloudEnvelope;
    c += vec3(haze * 0.13);

    // A sparse layer of slowly falling manga-like snow in the open dark sky.
    vec2 grid = uv * vec2(96.0, 56.0) + vec2(t * 0.16, t * 0.38);
    vec2 id = floor(grid), local = fract(grid) - 0.5;
    float seed = hash21(id);
    float radius = mix(0.12, 0.25, hash21(id + 5.4));
    float flake = 1.0 - smoothstep(radius * 0.72, radius, length(local));
    float sparse = step(0.988, seed);
    float openSky = 1.0 - smoothstep(0.48, 0.66, m.x);
    float darkness = 1.0 - smoothstep(0.035, 0.22, sourceLuma);
    float twinkle = 0.72 + 0.28 * sin(t * (0.65 + seed * 1.1) + seed * 50.0);
    float snow = flake * sparse * openSky * darkness * twinkle * 0.92;
    c += vec3(snow);

    // Fixed black eclipse with a bright white corona and slowly moving monochrome cloud bands.
    vec2 moonDelta = (m - vec2(0.31, 0.09)) * vec2(mediaSize.x / mediaSize.y, 1.0);
    float moonRadius = length(moonDelta);
    float moonAngle = atan(moonDelta.y, moonDelta.x);
    float coronaNoise = fbm(vec2(moonAngle * 2.4 + t * 0.04, moonRadius * 42.0 - t * 0.07));
    float raggedEdge = 0.064 + (coronaNoise - 0.5) * 0.005 + 0.0015 * sin(moonAngle * 11.0 - t * 0.12);
    float corona = exp(-abs(moonRadius - raggedEdge) * 150.0);
    float outerCorona = exp(-abs(moonRadius - 0.073) * 58.0);
    float moonCore = 1.0 - smoothstep(0.060, 0.064, moonRadius);
    c += vec3(0.92) * corona * (0.78 + 0.22 * coronaNoise);
    c += vec3(0.38) * outerCorona * 0.55;
    c = mix(c, vec3(0.0), moonCore);

    // Layered, ink-like clouds curl around and trail away from the eclipse.
    float cloudNoise = fbm(vec2(moonAngle * 1.8 - t * 0.035, moonRadius * 17.0 + t * 0.06));
    float cloudOrbit = 0.145 + 0.038 * sin(moonAngle * 2.6 + t * 0.045);
    float cloudBand = smoothstep(0.38, 0.68, cloudNoise)
                    * exp(-abs(moonRadius - cloudOrbit) * 11.0);
    float outerWisp = smoothstep(0.42, 0.70, fbm(vec2(moonAngle * 3.0 + t * 0.025, moonRadius * 11.0 - t * 0.04)))
                    * exp(-abs(moonRadius - 0.235) * 8.0);
    float topCloudField = fbm(m * vec2(5.0, 10.0) + vec2(t * 0.025, -t * 0.012));
    float topCloudEnvelope = (1.0 - smoothstep(0.48, 0.68, m.x)) * (1.0 - smoothstep(0.42, 0.66, topDown));
    float topWisps = smoothstep(0.46, 0.68, topCloudField) * topCloudEnvelope;
    c += vec3(cloudBand * 0.24 + outerWisp * 0.18 + topWisps * 0.20);

    float moonGlow = exp(-moonRadius * 17.0) * (0.060 + 0.024 * sin(t * 0.38));
    c += vec3(moonGlow * 0.78);

    // Force a strict manga monochrome palette before the 20% exposure lift.
    float mono = dot(c, vec3(0.299, 0.587, 0.114));
    c = vec3(mono);
    c = min(c * 1.20, vec3(1.0));
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    l = pow(clamp((l - 0.5) * contrast + 0.5 + brightness, 0.0, 1.0), gamma);
    if (l < threshold) return vec4(0.0);
    float hi = max(max(c.r, c.g), c.b);
    float lo = min(min(c.r, c.g), c.b);
    float chroma = (hi - lo) / max(hi, 0.001) * smoothstep(0.03, 0.20, hi);
    vec3 ink = mix(tint, c / max(hi, 0.001), chroma) * mix(hi, 1.0, vivid);
    return vec4(ink, l);
}

void main(){
    if(uImageSize.x<1.0 || uImageSize.y<1.0){o=vec4(0.0);return;}
    vec2 uv=gl_FragCoord.xy/uGrid; uv.y=1.0-uv.y;
    o=clamp(cell(uv),0.0,1.0);
}
