// defaults: {"speed": 0.5, "fit": 1, "zoom": 1, "exposure": 1.20}
// One coherent monochrome sky behind an isolated, stationary 4K manga figure.
// media.r = original ink, media.g = figure matte, media.b = half the original sky marks.
uniform sampler2D media;
uniform vec2 mediaSize;
uniform float speed, fit, zoom, exposure;

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
    for (int i = 0; i < 5; i++) {
        v += a * noise2(p);
        p = p * 2.03 + vec2(11.7, 7.3);
        a *= 0.5;
    }
    return v;
}

vec4 cell(vec2 uv) {
    float t = u_time * speed;
    float imageAspect = mediaSize.x / max(mediaSize.y, 1.0);
    float ratio = u_aspect / imageAspect;
    vec2 sc = vec2(1.0);
    if ((ratio > 1.0) == (fit < 0.5)) sc.x = ratio;
    else sc.y = 1.0 / ratio;
    vec2 m = (uv - 0.5) * sc / zoom + 0.5;
    if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return vec4(0.0);
    vec2 p = m * vec2(imageAspect, 1.0);

    // Screen-wide horizontal cloud layers. Both heights share the same texture and wind,
    // with no radial coordinates, local masks, or cloud source at the moon.
    vec2 wind = vec2(t * 0.006, t * 0.0005);
    vec2 q = p * vec2(2.3, 6.6) - wind;
    vec2 warp = vec2(fbm(q * 0.72 + vec2(3.7, 8.1)),
                     fbm(q * 0.72 + vec2(12.3, 1.9))) - 0.48;
    vec2 shaped = q + warp * vec2(0.85, 0.55);
    float broad = fbm(shaped);
    float wisps = fbm(shaped * vec2(2.1, 2.3) + vec2(5.0, 17.0));
    float cloudMass = smoothstep(0.35, 0.63, broad);
    float cloudEdge = smoothstep(0.40, 0.65, wisps);
    float hollow = smoothstep(0.52, 0.75, fbm(shaped * 0.7 + vec2(16.0, 4.0)));
    // A few drawn tonal planes define the billows instead of a continuous smoky gradient.
    float inkTone = 0.12 + 0.07 * smoothstep(0.36, 0.41, wisps)
                         + 0.08 * smoothstep(0.47, 0.52, wisps)
                         + 0.075 * smoothstep(0.59, 0.64, wisps);
    float clouds = cloudMass * inkTone * (1.0 - hollow * 0.52);
    float contour = smoothstep(0.40, 0.49, broad) * (1.0 - smoothstep(0.53, 0.61, broad));
    clouds += contour * cloudEdge * 0.04;
    // Restrained diagonal pen strokes follow the same wind as the cloud shapes.
    vec2 inkP = p - wind / vec2(2.3, 6.6);
    float hatch = smoothstep(0.58, 0.86, sin(inkP.x * 210.0 + inkP.y * 380.0 + wisps * 5.0));
    float crossHatch = smoothstep(0.70, 0.94, sin(inkP.x * 170.0 - inkP.y * 310.0));
    float shade = 1.0 - cloudEdge;
    clouds *= 1.0 - hatch * (0.08 + 0.09 * shade) - crossHatch * shade * 0.06;
    float sky = 0.002 + clouds;

    // Exactly half the extracted source stars, no extra procedural star population.
    // The texture drifts gently and its twinkle is deterministic in world coordinates.
    vec2 starUv = m + vec2(0.0018 * sin(t * 0.095), 0.0009 * sin(t * 0.075));
    float starInk = texture2D(media, clamp(starUv, 0.001, 0.999)).b;
    vec2 starId = floor(starUv * vec2(96.0, 54.0));
    float seed = hash21(starId);
    float twinkle = 0.72 + 0.28 * sin(t * (0.275 + seed * 0.55) + seed * 40.0);
    sky += starInk * twinkle * (1.0 - cloudMass * 0.72);

    // Circular black eclipse with a brighter, naturally uneven white corona.
    // The old white moon is removed from the sky layer, so the halo cannot double its edge.
    vec2 moon = (m - vec2(0.312, 0.145)) * vec2(imageAspect, 1.0);
    float r = length(moon);
    float moonSize = 0.071;
    float edgeDistance = r - moonSize;
    float outside = max(edgeDistance, 0.0);
    float pulse = 0.96 + 0.04 * sin(t * 0.16);
    float angle = atan(moon.y, moon.x);
    // All corona animation is at half the prior rate; integer harmonics remain seamless.
    float curl = angle - t * 0.060 + 0.11 * sin(angle * 5.0 + t * 0.165)
                                       + 0.06 * sin(angle * 11.0 - t * 0.120);
    float swell = 0.5 + 0.5 * sin(angle * 3.0 - t * 0.085 + 0.55 * sin(angle * 7.0));
    float tongue = pow(0.5 + 0.5 * sin(curl * 5.7 + 0.8 * sin(angle * 7.0 + t * 0.160)
                                                              + sin(angle * 9.3 - t * 0.080)), 2.0);
    float flare = pow(0.5 + 0.5 * sin(angle * 2.7 - t * 0.180), 2.0);
    float filaments = 0.5 + 0.5 * sin(angle * 15.9 - outside * 42.0 + t * 0.305 + sin(angle * 2.7));
    float flameLength = 0.003 + swell * 0.007 + tongue * (0.009 + flare * 0.025);
    // The ragged outer corona peaks at 80% of the inner rim, not a broad smooth annulus.
    // A 40% glow lift, normalized through exposure so the outer ring stays visibly at 80%.
    float innerPeak = 1.40 * (0.97 + filaments * 0.03) * pulse / max(exposure, 0.001);
    float innerRing = innerPeak * exp(-outside * outside / 0.0000045);
    float flameShape = exp(-pow(outside / flameLength, 1.65));
    float outerFlames = innerPeak * 0.80 * flameShape * (0.78 + filaments * 0.22);
    float closeHalo = exp(-outside / (0.012 + swell * 0.010)) * (0.14 + swell * 0.14);
    float wideHalo = exp(-outside / (0.024 + swell * 0.024)) * (0.035 + swell * 0.077);
    float corona = max(max(innerRing, outerFlames), (closeHalo + wideHalo) * pulse);
    float blackDisk = 1.0 - smoothstep(moonSize - 0.0010, moonSize + 0.0007, r);
    // The eclipse has its own radial white-to-crimson corona; keep it separate from the sky.
    // Base ink remains exactly neutral everywhere except the visible eclipse halo.
    sky = max(sky, corona) * (1.0 - blackDisk);
    float bloodHalo = exp(-outside / 0.090) * 0.075 * (1.0 - blackDisk);

    // Composite original figure last: no cloud or star animation touches the face or armor.
    vec2 footprint = sc / (u_grid * zoom) * 0.22;
    float source = 0.25 * (
        texture2D(media, m + vec2(-footprint.x, -footprint.y)).r +
        texture2D(media, m + vec2( footprint.x, -footprint.y)).r +
        texture2D(media, m + vec2(-footprint.x,  footprint.y)).r +
        texture2D(media, m + vec2( footprint.x,  footprint.y)).r);
    float matte = texture2D(media, m).g;
    float figure = pow(max(source, 0.0), 0.94);
    float light = clamp(mix(sky, figure, matte) * exposure, 0.0, 1.0);
    float level = pow(light, 0.83);
    vec3 ink = vec3(light);
    // Uniform blood-red inner rim and corona, with fading dark red outer tongues.
    // No white/hot gradient survives; the rest of the scene stays neutral manga white.
    vec3 redAtRim = vec3(0.85, 0.014, 0.035);
    float outerFade = 1.0 - 0.58 * smoothstep(0.010, 0.070, outside);
    vec3 bloodInk = redAtRim * (corona + bloodHalo) * exposure * outerFade;
    float localHalo = exp(-outside / 0.060) * 0.35;
    float moonTint = max(smoothstep(0.004, 0.090, corona), localHalo) * (1.0 - matte);
    ink = mix(ink, bloodInk, moonTint);
    return vec4(ink, level);
}
