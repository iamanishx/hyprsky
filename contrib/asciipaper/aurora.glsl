// defaults: {"speed": 1, "scale": 1}
// Aurora: wavering ribbons of light. Each ribbon has a bright hem low in the sky
// and rays that fan upward from it and fade — green at the hem, teal in the veil,
// violet at the fringe. uv.y == 0 is the top of the screen, so y is negated to
// make +y "up".
uniform float speed, scale;

float wave(float x, float t, float fi){
  return sin(x * (1.05 + 0.28*fi) + t * (0.42 + 0.18*fi) + fi*3.1) * 0.075
       + sin(x * (2.60 - 0.30*fi) - t * (0.30 + 0.09*fi)) * 0.028;
}

vec4 cell(vec2 uv){
  vec2 p = (uv - vec2(0.5)) * vec2(u_aspect, 1.0) * scale;
  float t = u_time * speed * 0.20;
  float x = p.x, y = -p.y;                       // +0.5 = top of the screen

  float lit = 0.0;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 3; i++){
    float fi   = float(i);
    float hem  = -0.16 + 0.14*fi + wave(x, t, fi);             // undulating bottom edge
    float up   = y - hem;                                      // >0 above the hem
    if (up < -0.05) continue;

    // macro gaps: the ribbon is not continuous, it breaks into columns of light
    float xs   = x + 0.16 * sin(y*2.0 + t*0.6 + fi*1.3);
    float gap  = 0.5 + 0.5 * sin(xs*(1.5 + 0.5*fi) + t*(0.26 + 0.09*fi) + fi*2.3);
    float open = smoothstep(0.18, 0.92, gap);

    // the hem: a thin, bright line; then a veil of rays above it that thins out
    float hemGlow = exp(-pow(up / 0.016, 2.0)) * (0.65 + 0.35 * sin(xs*27.0 + t*0.7));
    float veil    = smoothstep(0.0, 0.03, up) * exp(-up / (0.42 + 0.12*fi)) * 0.95;

    float rays = 0.35 + 0.65 * sin(xs*(46.0 + 8.0*fi) + sin(xs*4.2 + t*0.75)*2.6 + t*0.28);
    rays *= 0.60 + 0.40 * sin(xs*12.0 - t*0.45 + fi*1.7);
    rays = smoothstep(-0.25, 1.0, rays);

    float a = (hemGlow * 0.80 + veil * rays * 1.05) * mix(0.08, 1.0, open) * (1.05 - 0.18*fi);

    float h = clamp(up / 0.55, 0.0, 1.0);                       // 0 at hem, 1 far up
    vec3 hue = mix(vec3(0.30, 1.00, 0.42), vec3(0.10, 0.95, 0.72), smoothstep(0.02, 0.30, h));
    hue = mix(hue, vec3(0.16, 0.72, 1.00), smoothstep(0.30, 0.62, h));
    hue = mix(hue, vec3(0.62, 0.40, 1.00), smoothstep(0.66, 0.95, h));

    col += hue * a;
    lit += a;
  }

  // faint haze below the ribbons, and stars above them
  float haze = exp(-pow((y + 0.38) * 3.8, 2.0)) * 0.10;
  col += vec3(0.05, 0.28, 0.32) * haze;
  lit += haze;

  vec2 g = floor(uv * vec2(190.0, 115.0));
  float star = step(0.9965, fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453));
  float starFade = smoothstep(0.00, 0.30, y);
  col += vec3(0.75, 0.85, 1.0) * star * 0.55 * starFade;
  lit += star * 0.26 * starFade;

  float level = clamp(lit * 1.75, 0.0, 1.0);
  vec3 ink = col / max(lit, 0.002);
  ink = mix(vec3(0.02, 0.05, 0.08), ink, clamp(level * 2.0, 0.0, 1.0));
  return vec4(ink * (0.55 + 0.75*level), level);
}
