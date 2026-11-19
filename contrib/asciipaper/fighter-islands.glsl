// defaults: {"speed": 1, "waterSpeed": 1}
// A living top-down island flight: a banking jet crosses bright water and green atolls.
uniform float speed, waterSpeed;

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
        p = p * 2.03 + vec2(17.1, 9.2);
        a *= 0.5;
    }
    return v;
}

float islandDist(vec2 p, vec2 center, vec2 size, float angle, float seed) {
    vec2 v = p - center;
    float c = cos(angle), s = sin(angle);
    v = vec2(c * v.x - s * v.y, s * v.x + c * v.y) / size;
    float a = atan(v.y, v.x);
    float edge = 1.0 + 0.11 * sin(a * 3.0 + seed)
                     + 0.065 * sin(a * 7.0 - seed * 1.7)
                     + 0.035 * sin(a * 13.0 + seed * 2.4);
    edge += (fbm(v * 5.0 + seed) - 0.5) * 0.13;
    return length(v) - edge;
}

float cloudShape(vec2 p, vec2 c, float scale) {
    vec2 q = (p - c) / scale;
    float d = min(length(q - vec2(-0.38, 0.0)) - 0.38,
              min(length(q - vec2(0.0, 0.14)) - 0.48,
                  min(length(q - vec2(0.38, 0.0)) - 0.34,
                      length(q - vec2(0.06, -0.10)) - 0.39)));
    return d;
}

vec4 cell(vec2 uv) {
    float t = u_time * speed;
    vec2 p = (uv - 0.5) * vec2(u_aspect, 1.0);
    p.y = -p.y;
    // Slow forward drift gives the water and islands a sense of travel.
    vec2 world = p + vec2(t * 0.008 * waterSpeed, -t * 0.0025 * waterSpeed);
    float water = fbm(world * vec2(8.0, 11.0) + vec2(t * 0.035, -t * 0.025));
    float caustic = 0.5 + 0.5 * sin(world.x * 48.0 + sin(world.y * 31.0 + t * 0.7) + t * 0.8);
    vec3 color = mix(vec3(0.075, 0.27, 0.54), vec3(0.13, 0.47, 0.76), water * 0.8);
    color += vec3(0.025, 0.085, 0.12) * caustic * (0.32 + 0.34 * water);

    // Island chain: pale sand, turquoise surf, and textured green interiors.
    float d0 = islandDist(world, vec2(-0.34, 0.30), vec2(0.16, 0.095), -0.48, 1.2);
    float d1 = islandDist(world, vec2(0.42, 0.13), vec2(0.15, 0.105), 0.52, 2.7);
    float d2 = islandDist(world, vec2(0.27, -0.40), vec2(0.57, 0.205), -0.18, 4.1);
    float d3 = islandDist(world, vec2(-0.56, -0.28), vec2(0.105, 0.070), 0.32, 5.8);
    float d = min(min(d0, d1), min(d2, d3));
    float land = 1.0 - smoothstep(-0.005, 0.018, d);
    float sand = smoothstep(-0.16, -0.10, d) * (1.0 - smoothstep(-0.035, 0.012, d));
    float surf = exp(-abs(d) * 58.0) * (0.62 + 0.38 * noise2(world * 54.0 + vec2(t * 0.08, 0.0)));
    float greenNoise = fbm(world * 33.0 + vec2(3.0, 8.0));
    vec3 beachColor = mix(vec3(0.72, 0.59, 0.32), vec3(0.98, 0.84, 0.57), greenNoise * 0.55);
    vec3 greenColor = mix(vec3(0.15, 0.46, 0.14), vec3(0.31, 0.72, 0.24), smoothstep(0.27, 0.77, greenNoise));
    greenColor *= 0.83 + 0.25 * sin(world.x * 20.0 + world.y * 11.0 + fbm(world * 15.0) * 5.0);
    color = mix(color, beachColor, sand);
    color = mix(color, greenColor, land * (1.0 - sand * 0.75));
    color = mix(color, vec3(0.54, 0.91, 0.91), surf * 0.78);

    // Drifting cloud banks, with soft shadows against the sea.
    vec2 drift = vec2(t * 0.012, 0.0);
    float cloud0 = cloudShape(world, vec2(-0.61, 0.14) + drift, 0.12);
    float cloud1 = cloudShape(world, vec2(0.65, 0.38) - drift * 0.65, 0.105);
    float cloud2 = cloudShape(world, vec2(-0.10, -0.06) + drift * 0.45, 0.075);
    float clouds = max(max(1.0 - smoothstep(-0.035, 0.055, cloud0),
                           1.0 - smoothstep(-0.035, 0.055, cloud1)),
                           1.0 - smoothstep(-0.035, 0.055, cloud2));
    float cloudShade = max(max(1.0 - smoothstep(-0.10, 0.025, cloud0),
                              1.0 - smoothstep(-0.10, 0.025, cloud1)),
                              1.0 - smoothstep(-0.10, 0.025, cloud2));
    color = mix(color, color * vec3(0.68, 0.79, 0.89), cloudShade * 0.36);
    color = mix(color, vec3(0.80, 0.91, 0.99), clouds * 0.92);

    // Tiny animated glints and wake lines across the water.
    vec2 grid = world * vec2(61.0, 46.0) + vec2(t * 2.3, -t * 0.8);
    vec2 id = floor(grid), f = fract(grid) - 0.5;
    float seed = hash21(id);
    float dash = smoothstep(0.105, 0.015, abs(f.y + (seed - 0.5) * f.x * 0.35))
               * smoothstep(0.46, 0.12, abs(f.x));
    float glint = dash * step(0.945, seed) * (0.5 + 0.5 * sin(t * 3.0 + seed * 50.0));
    color += vec3(0.40, 0.69, 0.86) * glint * (1.0 - land) * (1.0 - clouds);

    // The jet banks gently as its twin orange exhaust trails stream behind it.
    vec2 jetPos = vec2(-0.10 + 0.045 * sin(t * 0.31), 0.015 + 0.035 * sin(t * 0.47));
    vec2 q = world - jetPos;
    float bank = 0.075 * sin(t * 0.38);
    q = vec2(cos(bank) * q.x + sin(bank) * q.y,
             -sin(bank) * q.x + cos(bank) * q.y);
    q *= vec2(1.8, 3.0);
    float trailWave = 0.004 * sin(q.x * 36.0 - t * 3.0);
    float trailA = exp(-abs(q.y - 0.014 - trailWave) * 85.0)
                 * smoothstep(-0.42, -0.18, q.x) * (1.0 - smoothstep(-0.20, -0.13, q.x));
    float trailB = exp(-abs(q.y + 0.014 - trailWave) * 85.0)
                 * smoothstep(-0.42, -0.18, q.x) * (1.0 - smoothstep(-0.20, -0.13, q.x));
    float exhaust = exp(-length((q - vec2(-0.13, 0.0)) * vec2(10.0, 24.0)));
    color += vec3(1.0, 0.34, 0.045) * (trailA + trailB) * 0.95;
    color += vec3(1.0, 0.72, 0.20) * exhaust * (0.80 + 0.20 * sin(t * 12.0));

    float wingSpan = 0.125 * clamp((q.x + 0.105) / 0.12, 0.0, 1.0);
    float wing = step(-0.105, q.x) * step(q.x, 0.035) * (1.0 - step(wingSpan, abs(q.y)));
    float wingOuter = step(-0.112, q.x) * step(q.x, 0.042) * (1.0 - step(wingSpan + 0.010, abs(q.y)));
    float tail = step(-0.12, q.x) * step(q.x, -0.075) * (1.0 - step(0.045, abs(q.y)));
    float bodyWidth = 0.006 + 0.014 * (1.0 - smoothstep(0.025, 0.145, q.x));
    float body = step(-0.12, q.x) * step(q.x, 0.15) * (1.0 - step(bodyWidth, abs(q.y)));
    float bodyOuter = step(-0.126, q.x) * step(q.x, 0.155) * (1.0 - step(bodyWidth + 0.007, abs(q.y)));
    float jet = max(max(wing, tail), body);
    float wingDetail = wing * (0.58 + 0.16 * smoothstep(-0.10, 0.0, q.x));
    color = mix(color, vec3(0.035, 0.075, 0.11), max(wingOuter, bodyOuter) * 0.97);
    color = mix(color, vec3(0.40, 0.50, 0.58), wing * 0.96);
    color = mix(color, vec3(0.69, 0.75, 0.78), wingDetail * 0.48);
    color = mix(color, vec3(0.58, 0.65, 0.70), body * 0.98);
    float cockpit = (1.0 - smoothstep(0.009, 0.018, length((q - vec2(0.068, 0.0)) * vec2(1.0, 1.8)))) * body;
    color = mix(color, vec3(0.30, 0.80, 0.96), cockpit * 0.92);
    float wingFlash = exp(-abs(abs(q.y) - wingSpan * 0.72) * 180.0) * wing;
    color += vec3(0.28, 0.41, 0.48) * wingFlash * 0.35;

    float level = dot(color, vec3(0.299, 0.587, 0.114));
    level = clamp(level, 0.0, 1.0);
    return vec4(color, level);
}
