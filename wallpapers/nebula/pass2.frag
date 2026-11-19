uniform sampler2D uCells;
uniform vec2 uRes;
uniform float uTime;
out vec4 o;

float hash(vec2 p) {
    uvec2 q=uvec2(ivec2(p)+ivec2(32768));
    uint n=q.x*1597334677u+q.y*3812015801u;
    n=(n^(n>>16u))*2246822519u;
    return float(n^(n>>13u))/4294967295.0;
}
vec3 starColor(float h) {
    return mix(vec3(0.59,0.80,1.0),vec3(1.0,0.78,0.41),h);
}
vec3 starLayer(vec2 p, float scale, float threshold, float seed, float occult) {
    vec2 grid=p*scale, cell=floor(grid);
    float id=hash(cell+seed);
    if(id<threshold) return vec3(0.0);
    vec2 center=vec2(hash(cell+vec2(57.0,seed)),hash(cell+vec2(seed,91.0)));
    center=0.22+0.56*center;
    vec2 d=(fract(grid)-center)*uRes.y/scale;
    float radius=mix(0.50,1.10,hash(cell+43.0))*uRes.y/1080.0;
    float core=exp(-dot(d,d)/(radius*radius));
    float glow=exp(-dot(d,d)/(radius*radius*8.0))*0.07;
    float phase=id*123.45, rate=0.6+hash(cell+81.0)*0.95;
    float twinkle=0.69+0.25*sin(uTime*rate+phase)+0.06*sin(uTime*rate*1.73+phase*2.0);
    return starColor(hash(cell+seed+14.0))*(core+glow)*twinkle*(0.22+0.85*id)*(1.0-occult*0.88);
}
vec3 brightStar(vec2 p, vec2 center, float magnitude, float seed) {
    vec2 d=(p-center)*1080.0;
    float r2=dot(d,d);
    float pulse=0.83+0.14*sin(uTime*(0.59+seed*0.021)+seed*2.74)
                     +0.03*sin(uTime*1.77+seed);
    float radius=1.45+0.38*magnitude;
    float core=exp(-r2/(radius*radius))*2.8;
    float halo=0.15*exp(-r2/(36.0*magnitude));
    // Fine, fixed telescope diffraction rays. Brightness changes, positions don't.
    vec2 diag=vec2(d.x+d.y,d.x-d.y)*0.7071068;
    float spikes=(exp(-abs(diag.x)*1.8)+exp(-abs(diag.y)*1.8))*exp(-sqrt(r2)/(12.0*magnitude))*0.26;
    return starColor(fract(seed*0.73))*(core+halo+spikes)*pulse*magnitude;
}
void main() {
    vec2 uv=gl_FragCoord.xy/uRes;
    vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
    vec4 field=texture(uCells,uv);
    vec3 col=field.rgb;
    col+=starLayer(p,79.0,0.975,3.0,field.a);
    col+=starLayer(p,41.0,0.943,39.0,field.a);
    col+=starLayer(p,19.0,0.954,102.0,field.a);
    // Widescreen composition: points of light extend all the way across the canvas.
    col+=brightStar(p,vec2(-0.66,0.22),0.75,2.0);
    col+=brightStar(p,vec2(-0.41,0.04),1.05,5.0);
    col+=brightStar(p,vec2(-0.25,-0.30),0.62,7.0);
    col+=brightStar(p,vec2(0.29,0.27),1.00,8.0);
    col+=brightStar(p,vec2(0.53,0.03),1.18,10.0);
    col+=brightStar(p,vec2(0.39,-0.16),0.74,13.0);
    col+=brightStar(p,vec2(0.73,-0.32),0.71,17.0);
    col+=brightStar(p,vec2(-0.78,-0.38),0.92,19.0);
    col+=brightStar(p,vec2(0.04,-0.18),0.69,22.0);
    col+=brightStar(p,vec2(-0.31,0.38),0.57,25.0);
    // Gentle exposure; no temporal grain or whole-screen pulsing.
    col=1.0-exp(-col*1.65);
    col=pow(max(col,vec3(0.0)),vec3(0.92));
    o=vec4(col,1.0);
}
