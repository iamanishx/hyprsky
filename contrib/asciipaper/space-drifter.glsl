// defaults: {"speed": 1, "drift": 1}
// A quiet spacewalk through a drifting Milky Way: moving stars, breathing dust, and a floating astronaut.
uniform float speed, drift;

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
    for (int i = 0; i < 4; i++) {
        v += a * noise2(p);
        p = p * 2.02 + vec2(13.7, 8.3);
        a *= 0.5;
    }
    return v;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float starField(vec2 p, float t) {
    vec2 g = p * vec2(142.0, 112.0) + vec2(t * 0.18, -t * 0.035);
    vec2 id = floor(g), f = fract(g) - 0.5;
    float seed = hash21(id);
    float size = mix(0.32, 0.82, pow(hash21(id + 8.7), 2.0));
    float dotStar = 1.0 - smoothstep(size * 0.28, size, length(f));
    float picked = step(0.94, seed);
    float twinkle = 0.50 + 0.50 * sin(t * (0.65 + seed * 2.3) + seed * 65.0);
    float bright = (0.30 + 0.70 * twinkle) * (0.48 + 0.52 * hash21(id + 3.2));
    float halo = exp(-length(f) * 5.0) * 0.11;
    return (dotStar + halo) * picked * bright;
}

vec4 cell(vec2 uv) {
    float t = u_time * speed;
    // Coordinates stay in screen-height units, so the figure keeps its shape on any monitor.
    vec2 p = (uv - 0.5) * vec2(u_aspect, 1.0);
    p.y = -p.y;
    vec2 drifted = p + vec2(t * 0.0035 * drift, -t * 0.0018 * drift);

    // Fixed-position Milky Way clouds; their glow breathes while only the stars drift.
    vec2 alongAxis = normalize(vec2(0.70, -0.72));
    vec2 acrossAxis = vec2(-alongAxis.y, alongAxis.x);
    float along = dot(p, alongAxis);
    float across = dot(p, acrossAxis) + 0.018 * sin(along * 7.0);
    vec2 nebulaUv = vec2(along * 3.4, across * 8.0);
    float clouds = fbm(nebulaUv) * 0.62 + fbm(nebulaUv * 1.9 + vec2(4.0, 11.0)) * 0.38;
    float detail = fbm(nebulaUv * 2.5 - vec2(8.0, 3.0));
    float band = exp(-abs(across) * 2.8);
    float pockets = smoothstep(0.30, 0.68, clouds) * band;
    float haze = smoothstep(0.27, 0.64, clouds) * exp(-abs(across) * 1.85);
    float filaments = smoothstep(0.45, 0.73, detail) * band;
    float cyanCloud = smoothstep(0.44, 0.72,
        fbm(nebulaUv * 1.55 + vec2(12.0, 5.0))) * exp(-abs(across + 0.075) * 6.0);
    float roseCloud = smoothstep(0.44, 0.70,
        fbm(nebulaUv * 1.8 + vec2(-5.0, 14.0))) * exp(-abs(across - 0.06) * 5.0);
    float greenCloud = smoothstep(0.39, 0.68,
        fbm(nebulaUv * 1.65 + vec2(18.0, -9.0))) * exp(-abs(across + 0.13) * 4.8);
    float breathe = 0.86 + 0.14 * sin(t * 0.16 + along * 5.0 + clouds * 4.0);
    float nebulaAmount = (0.42 * pockets + 0.17 * haze + 0.24 * filaments) * breathe;
    vec3 nebulaColor = vec3(0.56, 0.15, 0.96) * nebulaAmount;
    nebulaColor += vec3(0.045, 0.38, 0.82) * cyanCloud * 0.42;
    nebulaColor += vec3(0.72, 0.055, 0.25) * roseCloud * 0.42;
    nebulaColor += vec3(0.035, 0.62, 0.19) * greenCloud * 0.58;
    nebulaColor += vec3(0.025, 0.08, 0.22) * haze * 0.36;
    float glow = exp(-abs(across) * 3.2) * (0.45 + 0.55 * sin(along * 8.0 + clouds * 9.0 + t * 0.14));
    nebulaColor *= 0.84 + 0.16 * glow;

    float stars = starField(drifted, t);
    // A faint second layer adds depth without crowding the black sky.
    float dustStars = starField(drifted * 1.015 + vec2(0.07, -0.04), t * 0.72);
    stars = max(stars, dustStars * pockets * 0.48);
    vec3 color = nebulaColor + vec3(0.78, 0.86, 1.0) * stars * 0.90;

    // A slowly tumbling, bright EVA silhouette at the heart of the scene.
    vec2 astronautPos = vec2(0.012 + 0.006 * sin(t * 0.21), 0.018 + 0.010 * sin(t * 0.27 + 1.0));
    vec2 a = p - astronautPos;
    float rot = 0.10 * sin(t * 0.19);
    a = vec2(cos(rot) * a.x + sin(rot) * a.y,
             -sin(rot) * a.x + cos(rot) * a.y);
    a *= 0.62;
    // Helmet, torso, backpack, arms and separated bent legs.
    float helmet = length(a - vec2(0.0, 0.028)) - 0.0105;
    float torso = sdRoundBox(a - vec2(0.0, 0.005), vec2(0.0085, 0.015), 0.004);
    float pack = sdRoundBox(a - vec2(-0.010, 0.007), vec2(0.0045, 0.011), 0.002);
    float leftArm = sdSegment(a, vec2(-0.006, 0.015), vec2(-0.017, 0.026), 0.0035);
    float rightArm = sdSegment(a, vec2(0.006, 0.015), vec2(0.015, 0.025), 0.0035);
    float leftLeg = sdSegment(a, vec2(-0.004, -0.008), vec2(-0.012, -0.024), 0.0042);
    float leftBoot = sdSegment(a, vec2(-0.012, -0.024), vec2(-0.018, -0.027), 0.0035);
    float rightLeg = sdSegment(a, vec2(0.004, -0.008), vec2(0.010, -0.020), 0.0042);
    float rightBoot = sdSegment(a, vec2(0.010, -0.020), vec2(0.016, -0.023), 0.0035);
    float suit = min(min(min(helmet, torso), min(pack, min(leftArm, rightArm))),
                     min(min(leftLeg, leftBoot), min(rightLeg, rightBoot)));
    float suitMask = 1.0 - smoothstep(0.001, 0.0035, suit);
    color = mix(color, vec3(0.91, 0.94, 0.97), suitMask);

    // A dark visor keeps the helmet readable; tiny suit highlights glint as it turns.
    float visor = length(a - vec2(0.0025, 0.030)) - 0.0052;
    float visorMask = (1.0 - smoothstep(0.0005, 0.002, visor)) * (1.0 - smoothstep(0.008, 0.012, length(a - vec2(0.0, 0.028))));
    color = mix(color, vec3(0.045, 0.055, 0.07), visorMask);
    float suitLight = exp(-abs(a.x - 0.006) * 240.0) * exp(-abs(a.y - 0.006) * 34.0) * suitMask;
    color += vec3(0.10, 0.11, 0.12) * suitLight;

    // Ringed blue-violet planet with a restrained illuminated edge and soft rings.
    vec2 planetCenter = vec2(u_aspect * 0.25, 0.22);
    vec2 planetP = p - planetCenter;
    float ringAngle = -0.32;
    planetP = vec2(cos(ringAngle) * planetP.x + sin(ringAngle) * planetP.y,
                   -sin(ringAngle) * planetP.x + cos(ringAngle) * planetP.y);
    float planetRadius = 0.102;
    float ringRadius = length(vec2(planetP.x, planetP.y * 2.45));
    float ringMask = (1.0 - smoothstep(0.004, 0.012, abs(ringRadius - planetRadius * 1.47)))
                   * (0.68 + 0.32 * sin(ringRadius * 380.0 + t * 0.08));
    color += vec3(0.28, 0.40, 0.82) * ringMask * 0.62;
    float planetDist = length(planetP);
    float planetMask = 1.0 - smoothstep(planetRadius - 0.0015, planetRadius + 0.002, planetDist);
    vec2 normal = planetP / max(planetDist, 0.001);
    float illumination = clamp(0.50 + dot(normal, normalize(vec2(-0.62, 0.78))) * 0.58, 0.0, 1.0);
    float banding = 0.5 + 0.5 * sin(planetP.y * 260.0 + sin(planetP.x * 60.0) * 1.4);
    vec3 planetColor = mix(vec3(0.018, 0.027, 0.095), vec3(0.20, 0.35, 0.78), smoothstep(0.08, 0.78, illumination));
    planetColor = mix(planetColor, vec3(0.48, 0.22, 0.67), banding * smoothstep(0.25, 0.9, illumination) * 0.28);
    planetColor += vec3(0.035, 0.12, 0.22) * smoothstep(0.2, 0.9, banding);
    color = mix(color, planetColor, planetMask);
    float planetRim = exp(-abs(planetDist - planetRadius) * 75.0);
    color += vec3(0.10, 0.22, 0.70) * planetRim * 0.20;

    // A fixed Interstellar-inspired black hole; the luminous disk rotates in place.
    vec2 holeP = p - vec2(-u_aspect * 0.25, 0.10);
    float holeAngle = atan(holeP.y, holeP.x);
    float holeDist = length(holeP);
    float diskRadius = length(vec2(holeP.x, holeP.y * 1.48));
    float orbitPhase = holeAngle * 5.0 - t * 1.25 + diskRadius * 62.0
                     + 0.35 * sin(holeAngle * 3.0 + t * 0.42);
    float gas = 0.5 + 0.5 * sin(orbitPhase);
    float innerDisk = exp(-abs(diskRadius - 0.082) * 92.0);
    float outerDisk = exp(-abs(diskRadius - 0.132) * 58.0);
    float diskMask = innerDisk * 0.62 + outerDisk * 0.72;
    float beaming = 0.45 + 0.55 * (0.5 + 0.5 * cos(holeAngle - t * 0.20));
    vec3 diskColor = mix(vec3(0.06, 0.72, 0.40), vec3(0.92, 0.10, 0.26), gas);
    diskColor = mix(diskColor, vec3(0.66, 0.86, 1.0), smoothstep(0.78, 1.0, gas) * 0.72);
    color += diskColor * diskMask * beaming * 0.64;
    float photonRing = exp(-abs(holeDist - 0.073) * 135.0);
    color += vec3(0.47, 0.76, 0.84) * photonRing * 0.48;
    color += vec3(0.025, 0.16, 0.11) * exp(-abs(holeDist - 0.105) * 26.0) * 0.30;
    float horizon = 1.0 - smoothstep(0.067, 0.075, holeDist);
    color = mix(color, vec3(0.001, 0.002, 0.006), horizon);

    float level = dot(color, vec3(0.299, 0.587, 0.114));
    float nebulaLevel = max(max(nebulaColor.r, nebulaColor.g), nebulaColor.b) * 0.95;
    level = clamp(pow(level * 1.55, 0.82) + nebulaLevel * 0.10, 0.0, 1.0);
    return vec4(color, level);
}
