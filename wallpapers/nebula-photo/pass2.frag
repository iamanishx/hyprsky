// Packed image: photograph on top, RGB twinkle map below. See tools/prepare_nebula.py.
uniform sampler2D uImage;
uniform vec2 uImageSize; uniform vec2 uRes; uniform float uTime; out vec4 o;
void main(){ if(uImageSize.x<1.0){o=vec4(0.0,0.0,0.0,1.0);return;}
 vec2 uv=gl_FragCoord.xy/uRes;
 float ratio=(uRes.x/uRes.y)/(uImageSize.x/(uImageSize.y*0.5));
 vec2 scale=ratio>1.0?vec2(1.0,1.0/ratio):vec2(ratio,1.0);
 vec2 m=(uv-0.5)*scale+0.5; m.y=1.0-m.y;
 vec3 base=texture(uImage,vec2(m.x,m.y*0.5)).rgb; vec3 star=texture(uImage,vec2(m.x,0.5+m.y*0.5)).rgb;
 float phase=star.g*6.2831853, speed=0.45+0.65*star.b;
 float wave=0.5+0.5*sin(uTime*speed+phase);
 float pulse=0.8*wave*wave+0.2*(0.5+0.5*sin(uTime*speed*1.71+phase*2.3));
 vec3 col=base*(1.0+star.r*(-0.22+0.52*pulse));
 col+=vec3(0.90,0.94,1.0)*star.r*0.018*pulse;
 o=vec4(clamp(col,0.0,1.0),1.0);
}
