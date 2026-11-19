// Generated bitmap-ASCII pass for berserk-moonlight.before-sky-rebuild; edit tools/port_asciipaper.py to change rendering.
// 6x8 cells contain one hand-authored 5x7 glyph. Keep scene.conf cell sizes in sync.
uniform sampler2D uCells;
uniform vec2 uGrid;
out vec4 o;
const int G[70]=int[70](0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,4,4,0,4,4,0,0,0,0,31,0,0,0,0,0,31,0,31,0,0,0,4,4,31,4,4,0,0,21,14,31,14,21,0,10,31,10,10,31,10,0,24,25,2,4,8,19,3,14,17,23,21,23,16,14);
const vec3 BG=vec3(0.00784313725490196,0.00784313725490196,0.01568627450980392);
void main() {
    ivec2 pixel=ivec2(gl_FragCoord.xy), coord=pixel/ivec2(6,8);
    ivec2 top=ivec2(uGrid)-1;
    vec4 sampleCell=texelFetch(uCells,min(coord,top),0);
    int glyph=int(clamp(sampleCell.a,0.0,1.0)*9.0+0.5);
    int x=pixel.x%6, y=7-pixel.y%8;
    bool ink=x<5 && y<7 && ((G[glyph*7+y]>>(4-x))&1)==1;
    vec3 col=mix(BG,sampleCell.rgb,0.02);
    if(ink) col=sampleCell.rgb;
    vec3 glow=vec3(0.0);
    glow+=texelFetch(uCells,clamp(coord+ivec2(1,0),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(-1,0),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(0,1),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(0,-1),ivec2(0),top),0).rgb;
    col+=glow*0.008400000000000001;
    o=vec4(clamp(col,0.0,1.0),1.0);
}
