// Animate the photograph's green emission only; blue terrain stays anchored.
uniform sampler2D media;
uniform vec2 mediaSize;

vec3 photo(vec2 uv) {
    vec2 f = 0.25 / u_grid;
    return 0.25 * (texture2D(media, uv + vec2(-f.x, -f.y)).rgb
                + texture2D(media, uv + vec2( f.x, -f.y)).rgb
                + texture2D(media, uv + vec2(-f.x,  f.y)).rgb
                + texture2D(media, uv + vec2( f.x,  f.y)).rgb);
}

float emission(vec3 c) {
    return smoothstep(0.025, 0.18, c.g - max(c.r, c.b) * 1.15)
         * smoothstep(0.05, 0.22, c.g);
}

vec4 cell(vec2 uv) {
    float ratio = u_aspect / (mediaSize.x / mediaSize.y);
    vec2 scale = ratio > 1.0 ? vec2(1.0, 1.0 / ratio) : vec2(ratio, 1.0);
    vec2 p = (uv - 0.5) * scale + 0.5;
    vec3 base = photo(p);
    float mask = emission(base);
    float t = u_time;
    // Sky and reflected curtains share the same phase about the waterline.
    float height = abs(p.y - 0.52);
    float phase = p.x * 22.0 + height * 8.0;
    vec2 drift = vec2(0.014 * sin(phase + t * 0.42)
                    + 0.006 * sin(p.x * 47.0 - t * 0.27),
                      0.009 * sin(p.x * 13.0 + t * 0.31));
    vec3 moved = photo(clamp(p + drift * mask, 0.0, 1.0));
    float curtains = 0.87 + 0.20 * sin(p.x * 62.0 + height * 14.0 - t * 0.65)
                         + 0.10 * sin(phase - t * 0.38);
    // Retain source hues, without the media shader's yellow shadow tint.
    vec3 c = mix(base, moved * curtains, mask * 0.90);
    float light = dot(c, vec3(0.299, 0.587, 0.114));
    float level = pow(clamp(light * 1.18, 0.0, 1.0), 0.78);
    float hi = max(max(c.r, c.g), c.b);
    vec3 ink = c / max(hi, 0.001) * pow(hi, 0.72);
    ink *= 1.20 + 0.28 * mask;
    return vec4(ink, level);
}
