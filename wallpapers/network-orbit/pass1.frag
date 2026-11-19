// Generated from contrib/asciipaper/network-orbit.json by tools/port_asciipaper.py.
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

// defaults: {"globeZoom": 1.04, "rotationSpeed": 0.024, "flowSpeed": 1, "exposure": 1.4, "landTint": "#21586d", "cyanTrail": "#45ddff", "violetTrail": "#af8aff", "amberTrail": "#ffc46b"}
// Original ASCII interpretation of the Global Network Traffic globe.
// Geographic mask: public-domain Natural Earth. Traffic is simulated, not telemetry.


const float globeZoom=1.04;
const float rotationSpeed=0.024;
const float flowSpeed=1.0;
const float exposure=1.4;
const vec3 landTint=vec3(0.12941176470588237,0.34509803921568627,0.42745098039215684);
const vec3 cyanTrail=vec3(0.27058823529411763,0.8666666666666667,1.0);
const vec3 violetTrail=vec3(0.6862745098039216,0.5411764705882353,1.0);
const vec3 amberTrail=vec3(1.0,0.7686274509803922,0.4196078431372549);
const float PI=3.14159265359;

float hash(vec2 p) {
    vec3 p3=fract(vec3(p.xyx)*0.1031);
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
}
vec3 geo(float latitude,float longitude) {
    float lat=latitude*PI/180.0, lon=longitude*PI/180.0;
    return vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
}
mat3 orientation(float time) {
    float a=-0.61-time*rotationSpeed, b=0.29;
    float c=cos(a),s=sin(a),cb=cos(b),sb=sin(b);
    return mat3(1.,0.,0., 0.,cb,sb, 0.,-sb,cb)
         * mat3(c,0.,-s, 0.,1.,0., s,0.,c);
}
vec3 trafficColor(float id) {
    float k=mod(id,3.0);
    return k<0.5?cyanTrail:k<1.5?violetTrail:amberTrail;
}

// Squared screen-space distance to a projected quadratic 3D arc. The coarse
// seed plus Newton refinement avoids marching dozens of segments per glyph.
vec3 route(vec2 p,mat3 view,vec3 start,vec3 end,float id,float front) {
    float halfChord=length(start+end)*0.5;
    float lift=0.12+0.12*(1.0-halfChord);
    float controlR=max(2.0*(1.0+lift)-halfChord,1.035/max(halfChord,0.25));
    vec3 a=view*(start*1.008), b=view*(end*1.008);
    vec3 c=view*(normalize(start+end)*controlR);
    vec2 low=min(min(a.xy,b.xy),c.xy)-0.035;
    vec2 high=max(max(a.xy,b.xy),c.xy)+0.035;
    if(any(lessThan(p,low))||any(greaterThan(p,high))) return vec3(0.0);
    vec3 v=2.0*(c-a), w=a-2.0*c+b;
    float best=1e10, t=0.0;
    for(int j=0;j<5;j++) {
        float s=float(j)*0.25;
        vec2 d=a.xy+s*v.xy+s*s*w.xy-p;
        float r=dot(d,d);
        if(r<best){best=r;t=s;}
    }
    for(int j=0;j<4;j++) {
        vec2 q=a.xy+t*v.xy+t*t*w.xy-p;
        vec2 dq=v.xy+2.0*t*w.xy;
        float den=dot(dq,dq)+2.0*dot(q,w.xy);
        if(den>0.00001) t=clamp(t-clamp(dot(q,dq)/den,-0.24,0.24),0.0,1.0);
    }
    vec3 q=a+t*v+t*t*w;
    if(dot(p,p)<1.0 && q.z<front-0.010) return vec3(0.0);
    float d=length(q.xy-p);
    // Width tracks the character footprint, so the tiny moving head stays legible.
    float width=max(0.0055,1.45/u_grid.y);
    float line=1.0-smoothstep(width*0.30,width,d);
    float glow=exp(-d*d/(width*width*3.5));
    float progress=fract(u_time*flowSpeed/(5.0+mod(id,5.0)*0.6)+id*0.137);
    float behind=mod(progress-t+1.0,1.0);
    float tail=(1.0-smoothstep(0.01,0.72,behind));
    float head=exp(-pow((t-progress)/0.035,2.0));
    vec3 color=trafficColor(id);
    return color*((0.13+tail*0.95)*line+tail*glow*0.12)
         + mix(color,vec3(0.85,0.96,1.0),0.25)*head*(line+glow*0.12)*0.80;
}
vec3 hub(vec2 p,mat3 view,vec3 point,float id,float front) {
    vec3 v=view*(point*1.009);
    if(v.z<0.015 || (dot(p,p)<1.0 && v.z<front-0.012)) return vec3(0.0);
    float d=length(p-v.xy);
    if(d>0.09) return vec3(0.0);
    float phase=fract(u_time*0.25+id*0.237);
    float ring=exp(-pow((d-(0.012+phase*0.06))/0.004,2.0))*(1.0-phase);
    float core=exp(-d*d/0.000050);
    float halo=exp(-d*d/0.00038);
    return trafficColor(id)*(0.18*ring+0.11*halo)+vec3(0.70,0.91,1.0)*core*0.82;
}

vec4 cell(vec2 uv) {
    float radius=0.445*globeZoom;
    vec2 p=(uv-vec2(0.5,0.51))*vec2(u_aspect,-1.0)/radius;
    float r2=dot(p,p), front=sqrt(max(0.0,1.0-r2));
    mat3 view=orientation(u_time);
    vec3 col=vec3(0.004,0.009,0.022);
    // Sparse, steady starfield. No flat sidebar or photo panel anywhere.
    float h=hash(floor(uv*u_grid));
    if(h>0.9990) col+=vec3(0.30,0.48,0.71)*(0.45+0.18*sin(u_time*0.55+h*340.0))*1.65;
    if(r2<=1.0) {
        vec3 n=vec3(p,front);
        vec3 world=vec3(dot(view[0],n),dot(view[1],n),dot(view[2],n));
        vec2 mapUV=vec2(fract(atan(world.x,world.z)/(2.0*PI)+0.5),
                        0.5-asin(clamp(world.y,-1.0,1.0))/PI);
        vec3 map=texture2D(media,mapUV).rgb;
        float light=(0.34+0.66*max(dot(n,normalize(vec3(-0.5,0.7,1.3))),0.0))
                    *(0.24+0.76*pow(front,0.40));
        col=vec3(0.019,0.040,0.080)*(0.50+0.50*light);
        col=mix(col,landTint*(0.35+0.65*light),map.r);
        col+=vec3(0.12,0.57,0.69)*map.g*0.30*light;
        col+=vec3(0.07,0.24,0.34)*map.b*0.35*map.r;
        float gridX=abs(fract(mapUV.x*24.0+0.5)-0.5);
        float gridY=abs(fract(mapUV.y*12.0+0.5)-0.5);
        float grid=1.0-smoothstep(0.014,0.047,min(gridX,gridY));
        col+=vec3(0.025,0.063,0.115)*grid*(0.35+front*0.65);
        float points=step(0.985,hash(floor(mapUV*vec2(700.0,350.0))));
        col+=vec3(0.05,0.12,0.16)*points*map.r*light;
        col+=vec3(0.05,0.17,0.36)*pow(1.0-front,3.0)*0.40;
    } else {
        float rim=exp(-(sqrt(r2)-1.0)*34.0);
        col+=vec3(0.09,0.33,0.64)*rim*0.36;
    }

    // Real geographic anchors; fictional traffic pulses travel between these hubs.
    vec3 sf=geo(37.77,-122.42), ny=geo(40.71,-74.01), sao=geo(-23.55,-46.63);
    vec3 lon=geo(51.51,-0.13), par=geo(48.86,2.35), fra=geo(50.11,8.68);
    vec3 lag=geo(6.52,3.38), cape=geo(-33.92,18.42), mos=geo(55.75,37.62);
    vec3 dub=geo(25.20,55.27), mum=geo(19.08,72.88), del=geo(28.61,77.21);
    vec3 sinp=geo(1.35,103.82), tok=geo(35.68,139.65), syd=geo(-33.87,151.21);
    vec3 traffic=vec3(0.0);
    traffic+=route(p,view,lon,ny,0.0,front);
    traffic+=route(p,view,ny,sf,1.0,front);
    traffic+=route(p,view,sf,tok,2.0,front);
    traffic+=route(p,view,tok,sinp,3.0,front);
    traffic+=route(p,view,sinp,del,4.0,front);
    traffic+=route(p,view,del,lon,5.0,front);
    traffic+=route(p,view,par,lag,6.0,front);
    traffic+=route(p,view,lag,sao,7.0,front);
    traffic+=route(p,view,sao,ny,8.0,front);
    traffic+=route(p,view,dub,fra,9.0,front);
    traffic+=route(p,view,dub,mum,10.0,front);
    traffic+=route(p,view,mum,sinp,11.0,front);
    traffic+=route(p,view,sinp,syd,12.0,front);
    traffic+=route(p,view,cape,lag,13.0,front);
    traffic+=route(p,view,fra,mos,14.0,front);
    traffic+=route(p,view,mos,tok,15.0,front);
    traffic+=route(p,view,tok,syd,16.0,front);
    traffic+=route(p,view,ny,par,17.0,front);
    traffic+=route(p,view,fra,sinp,18.0,front);
    traffic+=route(p,view,cape,dub,19.0,front);
    traffic+=route(p,view,cape,sinp,20.0,front);
    traffic+=route(p,view,sao,cape,21.0,front);
    traffic+=route(p,view,lon,mum,22.0,front);
    float signal=max(traffic.r,max(traffic.g,traffic.b));
    col=mix(col,traffic,smoothstep(0.06,0.30,signal));

    col+=hub(p,view,sf,0.0,front); col+=hub(p,view,ny,1.0,front);
    col+=hub(p,view,sao,2.0,front); col+=hub(p,view,lon,3.0,front);
    col+=hub(p,view,par,4.0,front); col+=hub(p,view,fra,5.0,front);
    col+=hub(p,view,lag,6.0,front); col+=hub(p,view,cape,7.0,front);
    col+=hub(p,view,mos,8.0,front); col+=hub(p,view,dub,9.0,front);
    col+=hub(p,view,mum,10.0,front); col+=hub(p,view,del,11.0,front);
    col+=hub(p,view,sinp,12.0,front); col+=hub(p,view,tok,13.0,front);
    col+=hub(p,view,syd,14.0,front);

    float hi=max(col.r,max(col.g,col.b));
    if(hi<0.024) return vec4(0.0);
    // Lift scene exposure, but keep empty space dark and trail geometry unchanged.
    col*=exposure;
    hi=max(col.r,max(col.g,col.b));
    float level=pow(clamp(hi*0.95,0.0,1.0),0.78);
    vec3 ink=col/pow(max(hi,0.001),0.26);
    return vec4(clamp(ink,0.0,1.0),level);
}

void main(){
    if(uImageSize.x<1.0 || uImageSize.y<1.0){o=vec4(0.0);return;}
    vec2 uv=gl_FragCoord.xy/uGrid; uv.y=1.0-uv.y;
    o=clamp(cell(uv),0.0,1.0);
}
