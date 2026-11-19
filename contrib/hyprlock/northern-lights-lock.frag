#version 300 es
precision highp float;
uniform sampler2D photoTexture;
uniform vec2 photoSize;
uniform vec2 resolution;
uniform float time;
uniform float opacity;
out vec4 fragColor;

float emission(vec3 c) {
    return smoothstep(0.025, 0.18, c.g - max(c.r, c.b) * 1.15)
         * smoothstep(0.05, 0.22, c.g);
}

void main() {
    vec2 uv = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution;
    float ratio = (resolution.x / resolution.y) / (photoSize.x / photoSize.y);
    vec2 scale = ratio > 1.0 ? vec2(1.0, 1.0 / ratio) : vec2(ratio, 1.0);
    vec2 p = (uv - 0.5) * scale + 0.5;
    // The texture is the full-density ASCII render, not the unconverted photo.
    vec3 base = texture(photoTexture, p).rgb;
    float mask = emission(base);
    float t = floor(time * 60.0) / 60.0;
    float height = abs(p.y - 0.52);
    float phase = p.x * 22.0 + height * 8.0;
    vec2 drift = vec2(0.014 * sin(phase + t * 0.42)
                    + 0.006 * sin(p.x * 47.0 - t * 0.27),
                      0.009 * sin(p.x * 13.0 + t * 0.31));
    vec3 moved = texture(photoTexture, clamp(p + drift * mask, 0.0, 1.0)).rgb;
    float curtains = 0.90 + 0.18 * sin(p.x * 62.0 + height * 14.0 - t * 0.65)
                         + 0.09 * sin(phase - t * 0.38);
    vec3 color = mix(base, moved * curtains, mask * 0.88);
    color += vec3(0.0, 0.025, 0.012) * mask;
    fragColor = vec4(clamp(color, 0.0, 1.0) * opacity, opacity);
}
