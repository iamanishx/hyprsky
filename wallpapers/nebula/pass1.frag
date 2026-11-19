
// An original procedural interpretation of the reference's gold/cyan gas and
// dark dust pillar. No image textures, image coordinates, or portrait framing.
uniform vec2 uGrid;
uniform float uTime;
out vec4 o;

float hash(vec2 p) {
    uvec2 q = uvec2(ivec2(p) + ivec2(32768));
    uint n = q.x * 1597334677u + q.y * 3812015801u;
    n = (n ^ (n >> 16u)) * 2246822519u;
    return float(n ^ (n >> 13u)) / 4294967295.0;
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float fbm(vec2 p) {
    float s=0.0, a=0.52;
    for (int i=0; i<6; i++) {
        s += a*noise(p);
        p = ROT*p*2.08 + vec2(7.13, 3.71);
        a *= 0.48;
    }
    return s;
}
float smoothMin(float a, float b, float k) {
    float h=clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
    return mix(b,a,h)-k*h*(1.0-h);
}
float ellipse(vec2 p, vec2 c, vec2 r) {
    return (length((p-c)/r)-1.0)*min(r.x,r.y);
}
float pillar(vec2 p) {
    float d=ellipse(p,vec2(0.02,-0.51),vec2(0.25,0.16));
    d=smoothMin(d,ellipse(p,vec2(-0.015,-0.31),vec2(0.115,0.25)),0.045);
    d=smoothMin(d,ellipse(p,vec2(0.085,-0.10),vec2(0.151,0.20)),0.038);
    d=smoothMin(d,ellipse(p,vec2(-0.012,0.11),vec2(0.075,0.20)),0.033);
    d=smoothMin(d,ellipse(p,vec2(-0.045,0.302),vec2(0.079,0.075)),0.027);
    d=smoothMin(d,ellipse(p,vec2(0.02,0.282),vec2(0.071,0.046)),0.023);
    // Static high-frequency erosion: no swimming silhouette.
    d += 0.025*(fbm(p*32.0)-0.5) + 0.004*(noise(p*149.0)-0.5);
    return d;
}

void main() {
    vec2 p=(gl_FragCoord.xy-0.5*uGrid)/uGrid.y;
    float t=uTime;
    // Domain-warped turbulent gas slowly evolves; the camera never moves.
    vec2 warp=vec2(fbm(p*3.2+vec2(t*0.006,4.1)),
                   fbm(p*3.2+vec2(8.3,-t*0.004)))-0.5;
    vec2 q=p+0.29*warp;
    float broad=fbm(q*5.5+vec2(1.8,t*0.003));
    float folds=fbm(q*13.0+warp*2.5+vec2(t*0.004,8.5));
    float detail=fbm(q*39.0+vec2(5.0,t*0.008));
    float filaments=pow(1.0-abs(folds*2.0-1.0),7.0);
    float haze=smoothstep(0.22,0.76,broad);
    float warm=1.0-smoothstep(-0.38,0.27,p.x+p.y*0.78+warp.x*0.26);
    vec3 cold=mix(vec3(0.009,0.032,0.076),vec3(0.065,0.44,0.56),haze);
    vec3 gold=mix(vec3(0.11,0.029,0.018),vec3(0.86,0.47,0.105),haze);
    vec3 col=mix(cold,gold,warm);
    vec3 light=mix(vec3(0.18,0.63,0.73),vec3(1.0,0.70,0.27),warm);
    col += light*(0.07+0.27*haze)*filaments*(0.45+detail);
    col *= 0.55+0.92*detail;
    // Threaded dust veils run through the field instead of uniform color bands.
    float veil=smoothstep(0.45,0.69,folds+0.11*(detail-0.5));
    col *= 1.0-0.40*veil;

    float d=pillar(p);
    float density=1.0-smoothstep(-0.007,0.003,d);
    float stone=fbm(p*25.0+vec2(19.0,4.0));
    float threads=fbm(p*vec2(68.0,23.0)+stone*3.0);
    vec3 dustColor=mix(vec3(0.012,0.029,0.047),vec3(0.125,0.057,0.030),
                       1.0-smoothstep(-0.35,0.13,p.y));
    dustColor *= 0.46+1.45*stone;
    dustColor += mix(vec3(0.018,0.055,0.077),vec3(0.075,0.038,0.011),warm)
                 *pow(threads,2.0);
    // Cyan illumination at left, gold ionization front at right.
    float right=smoothstep(-0.05,0.10,p.x);
    vec3 rimColor=mix(vec3(0.045,0.24,0.36),vec3(0.93,0.65,0.25),right);
    float rim=exp(-abs(d)*135.0)*(0.30+0.95*stone);
    col += rimColor*exp(-max(d,0.0)*39.0)*(1.0-density)*0.28;
    col = mix(col,dustColor,density*0.97);
    col += rimColor*rim*0.43;
    // A warm shoulder of dust enters from the left and bottom.
    float shoulder=ellipse(p,vec2(-0.59,-0.55),vec2(0.35,0.35));
    shoulder+=0.042*(fbm(p*19.0)-0.5);
    float shoulderMask=1.0-smoothstep(-0.012,0.018,shoulder);
    vec3 shoulderColor=vec3(0.12,0.037,0.021)*(0.45+1.35*fbm(p*29.0+3.0));
    col=mix(col,shoulderColor,shoulderMask*0.85);
    col+=vec3(0.43,0.22,0.060)*exp(-abs(shoulder)*60.0)*(0.3+detail)*0.45;
    // Restrained rose-colored emission at the pillar's crown.
    vec2 crown=(p-vec2(0.028,0.286))/vec2(0.049,0.035);
    float crownDetail=fbm(p*92.0+vec2(5.0,13.0));
    float rose=exp(-dot(crown,crown)*1.3)*(0.3+1.6*crownDetail);
    col+=mix(vec3(0.56,0.05,0.22),vec3(0.93,0.42,0.44),crownDetail)*rose*0.65;
    col*=1.0-0.20*smoothstep(0.4,1.12,length(p*vec2(0.8,1.0)));
    // Alpha is dust occlusion for background stars, not transparency.
    o=vec4(clamp(col,0.0,1.0),max(density,shoulderMask*0.7));
}
