uniform sampler2D uCells; uniform sampler2D uImage; uniform vec2 uImageSize;
uniform vec2 uRes; uniform float uTime; out vec4 o;
vec3 photo(vec2 uv){ return texture(uImage,clamp(vec2(uv.x,1.0-uv.y),0.001,0.999)).rgb; }
float emission(vec3 c){return smoothstep(0.025,0.18,c.g-max(c.r,c.b)*1.15)*smoothstep(0.05,0.22,c.g);}
void main(){ if(uImageSize.x<1.0){o=vec4(0.0,0.0,0.0,1.0);return;}
 vec2 uv=gl_FragCoord.xy/uRes; float ratio=uRes.x/uRes.y/(uImageSize.x/uImageSize.y);
 vec2 sc=ratio>1.0?vec2(1.0,1.0/ratio):vec2(ratio,1.0); vec2 m=(uv-0.5)*sc+0.5;
 if(any(lessThan(m,vec2(0.0)))||any(greaterThan(m,vec2(1.0)))){o=vec4(0.0,0.0,0.0,1.0);return;}
 vec3 base=photo(m); float mask=emission(base); float t=uTime;
 // Explicit static landscape region: every mountain and shoreline pixel is copied
 // from the same base photograph, irrespective of green emission or aurora phase.
 float terrain=(smoothstep(0.44,0.47,m.y))*(1.0-smoothstep(0.72,0.80,m.y));
 float height=abs(m.y-0.52); float phase=m.x*22.0+height*8.0;
 vec2 drift=vec2(0.010*sin(phase+t*0.30)+0.004*sin(m.x*47.0-t*0.20),
                  0.006*sin(m.x*13.0+t*0.23));
 vec3 moved=photo(m+drift*mask);
 float curtain=0.90+0.16*sin(m.x*62.0+height*14.0-t*0.46)+0.08*sin(phase-t*0.28);
 // Never warp or replace the base photograph. Modulation is additive light only,
 // masked away from the entire mountain and foreground region.
 float liveMask=mask*(1.0-terrain);
 vec3 col=base+max(vec3(0.0),moved-base)*(curtain-0.35)*liveMask*0.75;
 col+=moved*0.10*liveMask;
 vec3 bloom=texture(uCells,uv).rgb;
 col+=bloom*mask*(1.0-terrain)*0.045;
 o=vec4(clamp(col,0.0,1.0),1.0); }
