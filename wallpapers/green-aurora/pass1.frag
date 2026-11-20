uniform sampler2D uImage; uniform vec2 uImageSize; uniform vec2 uRes;
uniform float uTime; uniform vec2 uGrid; out vec4 o;
vec2 imageUV(vec2 uv){float ratio=uRes.x/uRes.y/(uImageSize.x/uImageSize.y);
 vec2 sc=ratio>1.0?vec2(1.0,1.0/ratio):vec2(ratio,1.0); return (uv-0.5)*sc+0.5;}
void main(){ if(uImageSize.x<1.0){o=vec4(0.0,0.0,0.0,1.0);return;} vec2 uv=gl_FragCoord.xy/uGrid,m=imageUV(uv);
 if(any(lessThan(m,vec2(0.0)))||any(greaterThan(m,vec2(1.0)))){o=vec4(0.0);return;}
 vec3 c=texture(uImage,vec2(m.x,1.0-m.y)).rgb;
 float mask=smoothstep(0.025,0.18,c.g-max(c.r,c.b)*1.15)*smoothstep(0.05,0.22,c.g);
 vec3 glow=c*mask; float blur=1.0/uGrid.x; glow+=texture(uImage,vec2(m.x+blur,1.0-m.y)).rgb*mask*0.2;
 o=vec4(c*mask+glow*0.15,1.0); }
