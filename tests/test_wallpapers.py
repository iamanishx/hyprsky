#!/usr/bin/env python3
"""Headless shader smoke tests. Standard-library Python; uses the EGL/libpng test binary.

No Wayland connection, live desktop changes, network calls or private images.
"""
import argparse
import binascii
from pathlib import Path
import struct
import subprocess
import tempfile
import zlib

ROOT = Path(__file__).resolve().parent.parent
PHOTO_SCENES = {
    'alpine-meadow', 'berserk-moonlight', 'berserk-moonlight-legacy', 'green-aurora',
    'moonlit-peak', 'moonlit-resort', 'nebula-photo', 'northern-lights-photo',
    'retro-tower', 'yosemite-sunset',
}


def png(path, w, h, pixel):
    def chunk(name, data):
        return struct.pack('!I', len(data)) + name + data + struct.pack('!I', binascii.crc32(name+data) & 0xffffffff)
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        for x in range(w):
            rows.extend(pixel(x, y))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', w, h, 8, 2, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(bytes(rows))) + chunk(b'IEND', b''))


def fixture(x, y):
    if x % 41 < 4 and y % 37 < 4:
        return (255, 255, 255)
    return (30+x*180//640, 55+y*170//360, 25+(x+y)*115//1000)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renderer', type=Path, default=ROOT/'tests/render-scene')
    args = parser.parse_args()
    renderer = args.renderer.resolve()
    subprocess.run(['python3', str(ROOT/'tools/port_asciipaper.py'), '--check'], check=True)
    with tempfile.TemporaryDirectory(prefix='hyprsky-wallpaper-tests-') as tmp:
        folder = Path(tmp)
        image = folder/'fixture.png'
        png(image, 640, 360, fixture)
        atlas = folder/'star-atlas.png'
        png(atlas, 640, 720, lambda x, y: fixture(x, y) if y < 360 else
            ((220, 80+x % 150, 120) if x % 41 < 6 and (y-360) % 37 < 6 else (0,0,0)))
        for scene in sorted((ROOT/'wallpapers').iterdir()):
            if not (scene/'pass1.frag').is_file():
                continue
            photo = (atlas if scene.name == 'nebula-photo' else image) if scene.name in PHOTO_SCENES else ''
            hashes = []
            for time in (3, 9):
                output = folder/f'{scene.name}-{time}.png'
                result = subprocess.run([str(renderer), str(scene), str(output), str(time), str(photo)],
                                        check=True, capture_output=True, text=True, timeout=60)
                digest, total, opaque = map(int, result.stdout.split())
                assert opaque == 1, f'{scene.name}: non-opaque output'
                assert total > 0, f'{scene.name}: blank rendering'
                hashes.append(digest)
            assert hashes[0] != hashes[1], f'{scene.name}: animation did not change'
            # Odd sizes catch edge-cell indexing errors. Network map retains its bundled image.
            subprocess.run([str(renderer), str(scene), str(folder/'odd.png'), '5', str(photo), '853', '479'],
                           check=True, capture_output=True, timeout=60)
            if photo:
                # Missing optional image must still compile/render an opaque fallback, not NaNs.
                result = subprocess.run([str(renderer), str(scene), str(folder/'missing.png'), '5'],
                                        check=True, capture_output=True, text=True, timeout=60)
                assert int(result.stdout.split()[2]) == 1
            print(f'PASS {scene.name}: two animated frames, odd dimensions' + (', with/without image' if photo else ''))
    print('All wallpaper shaders compiled and rendered without GL errors.')


if __name__ == '__main__':
    main()
