#!/usr/bin/env python3
"""Regenerate the contributed ASCII wallpapers using only the Python standard library.

Original cell() sources/specs live in contrib/asciipaper. Runtime GLSL ES 3.00
passes are checked in so installing/running Hyprsky needs no Python or font stack.
"""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'contrib' / 'asciipaper'
# Hand-authored 5x7 glyph rows, MSB at the left. No font assets are required.
GLYPHS = {
    ' ': [0,0,0,0,0,0,0], '.': [0,0,0,0,0,4,4],
    ',': [0,0,0,0,4,4,8], ':': [0,4,4,0,4,4,0],
    ';': [0,4,4,0,4,4,8], '-': [0,0,0,31,0,0,0],
    '=': [0,0,31,0,31,0,0], '+': [0,4,4,31,4,4,0],
    '*': [0,21,14,31,14,21,0], '#': [10,31,10,10,31,10,0],
    '%': [24,25,2,4,8,19,3], '@': [14,17,23,21,23,16,14],
}
ALIASES = '''uniform float uTime;
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
'''


def glsl_value(kind, value):
    if isinstance(value, str) and value.startswith('#'):
        value = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    if kind == 'float':
        return repr(float(value))
    if kind.startswith('vec') and isinstance(value, list) and len(value) == int(kind[-1]):
        return kind + '(' + ','.join(repr(float(v)) for v in value) + ')'
    raise ValueError(f'Unsupported uniform: {kind} {value!r}')


def first_pass(source, spec, name):
    defaults = {}
    if source.startswith('// defaults:'):
        defaults = json.loads(source.splitlines()[0].split(':', 1)[1])
    defaults.update(spec.get('uniforms', {}))

    def replace_uniform(match):
        kind, names = match.groups()
        result = []
        for raw in names.split(','):
            key = raw.strip()
            if key in {'media', 'mediaSize'}:
                continue
            if key not in defaults:
                raise ValueError(f'{name}: no default for {key}')
            result.append(f'const {kind} {key}={glsl_value(kind, defaults[key])};')
        return '\n'.join(result)

    source = re.sub(r'\buniform\s+(float|vec[234]|sampler2D)\s+([^;]+);', replace_uniform, source)
    guard = 'if(uImageSize.x<1.0 || uImageSize.y<1.0){o=vec4(0.0);return;}\n' if 'media' in spec else ''
    return (f'// Generated from contrib/asciipaper/{name}.json by tools/port_asciipaper.py.\n'
            + ALIASES + '\n' + source + '\nvoid main(){\n    ' + guard
            + '    vec2 uv=gl_FragCoord.xy/uGrid; uv.y=1.0-uv.y;\n'
            + '    o=clamp(cell(uv),0.0,1.0);\n}\n')


def second_pass(spec, name):
    chars = spec.get('charset', ' .:-=+*#%@')
    rows = [row for char in chars for row in GLYPHS[char]]
    bg = glsl_value('vec3', spec.get('background', '#000000'))
    fill = float(spec.get('fill', 0))
    bloom = float(spec.get('effects', {}).get('bloom', 0))
    return f'''// Generated bitmap-ASCII pass for {name}; edit tools/port_asciipaper.py to change rendering.
// 6x8 cells contain one hand-authored 5x7 glyph. Keep scene.conf cell sizes in sync.
uniform sampler2D uCells;
uniform vec2 uGrid;
out vec4 o;
const int G[{len(rows)}]=int[{len(rows)}]({','.join(str(r) for r in rows)});
const vec3 BG={bg};
void main() {{
    ivec2 pixel=ivec2(gl_FragCoord.xy), coord=pixel/ivec2(6,8);
    ivec2 top=ivec2(uGrid)-1;
    vec4 sampleCell=texelFetch(uCells,min(coord,top),0);
    int glyph=int(clamp(sampleCell.a,0.0,1.0)*{float(len(chars)-1)}+0.5);
    int x=pixel.x%6, y=7-pixel.y%8;
    bool ink=x<5 && y<7 && ((G[glyph*7+y]>>(4-x))&1)==1;
    vec3 col=mix(BG,sampleCell.rgb,{fill});
    if(ink) col=sampleCell.rgb;
    vec3 glow=vec3(0.0);
    glow+=texelFetch(uCells,clamp(coord+ivec2(1,0),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(-1,0),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(0,1),ivec2(0),top),0).rgb;
    glow+=texelFetch(uCells,clamp(coord+ivec2(0,-1),ivec2(0),top),0).rgb;
    col+=glow*{bloom * 0.025};
    o=vec4(clamp(col,0.0,1.0),1.0);
}}
'''


def outputs():
    for path in sorted(SOURCES.glob('*.json')):
        spec = json.loads(path.read_text())
        name = path.stem
        target = {'aurora': 'ribbon-aurora',
                  'berserk-moonlight.before-sky-rebuild': 'berserk-moonlight-legacy'}.get(name, name)
        folder = ROOT / 'wallpapers' / target
        source = (SOURCES / spec['shader']).read_text()
        conf = 'cell = 6 8\nfilter = nearest\n'
        if name == 'network-orbit':
            conf += 'image = map.png\n'
        elif 'media' in spec:
            conf = '# Requires --image FILE.png; see contrib/COLLECTION.md for the image layout.\n' + conf
        yield folder / 'scene.conf', conf
        yield folder / 'pass1.frag', first_pass(source, spec, name)
        yield folder / 'pass2.frag', second_pass(spec, name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if checked-in output is stale')
    args = parser.parse_args()
    stale = []
    for path, content in outputs():
        if args.check:
            if not path.exists() or path.read_text() != content:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    if stale:
        raise SystemExit('Regenerate with tools/port_asciipaper.py:\n' + '\n'.join(stale))


if __name__ == '__main__':
    main()
