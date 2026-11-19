#!/usr/bin/env python3
"""Build a PNG atlas for `hyprsky --scene nebula-photo --image atlas.png`.

Requires Pillow, NumPy and SciPy. Supply an image you have permission to use.
The 3840x4320 PNG contains a 16:9 photo above an aligned RGB twinkle map:
finite-support amplitude, per-star phase, per-star speed. The input stays untouched.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps
from scipy.ndimage import gaussian_filter, maximum_filter


def prepare(source, out):
    outputs = ('nebula-atlas.png', 'nebula-preview.jpg', 'nebula-star-detection.jpg', 'nebula.json')
    if source.resolve() in {(out / name).resolve() for name in outputs}:
        raise ValueError('Choose a different output directory; the source must not be overwritten')
    out.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        photo = ImageOps.exif_transpose(original).convert("RGB")
    w, h = 3840, 2160
    foreground = ImageOps.contain(photo, (w, h), Image.Resampling.LANCZOS)
    fw, fh = foreground.size
    x0, y0 = (w - fw) // 2, (h - fh) // 2
    backdrop = ImageOps.fit(photo, (w, h), Image.Resampling.LANCZOS)
    backdrop = ImageEnhance.Brightness(backdrop.filter(ImageFilter.GaussianBlur(72))).enhance(0.48)
    # Only feather the narrow boundary; keep the complete upright portrait.
    _, xx = np.mgrid[:fh, :fw]
    edge = np.minimum(xx, fw - 1 - xx) / 24.0
    alpha = np.uint8(np.clip(edge, 0, 1) * 255)
    backdrop.paste(foreground, (x0, y0), Image.fromarray(alpha))

    rgb = np.asarray(foreground, dtype=np.float32) / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    detail = lum - gaussian_filter(lum, 4.5)
    peaks = (lum == maximum_filter(lum, size=11)) & (detail > 0.12) & (lum > 0.56)
    # Reject colored cloud edges. White and pale-gold stellar cores survive.
    peaks &= (rgb.min(axis=2) > 0.32) & (np.ptp(rgb, axis=2) < 0.48)
    peaks[:14] = peaks[-14:] = False
    peaks[:, :28] = peaks[:, -28:] = False
    py, px = np.nonzero(peaks)
    order = np.argsort(lum[py, px] + detail[py, px])[::-1]
    selected = []
    for idx in order:
        x, y = int(px[idx]), int(py[idx])
        if all((x - sx) ** 2 + (y - sy) ** 2 > 16 ** 2 for sx, sy in selected):
            selected.append((x, y))
        if len(selected) == 160:
            break
    if len(selected) < 10:
        raise RuntimeError(f"Only {len(selected)} star candidates found; inspect source before applying")

    star_map = np.zeros((h, w, 3), dtype=np.uint8)
    rng = np.random.default_rng(74219)
    stars = []
    for x, y in selected:
        radius = 12
        dy, dx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
        distance2 = dx * dx + dy * dy
        # Most modulation follows the existing compact highlight, not nearby gas.
        patch_detail = detail[y-radius:y+radius+1, x-radius:x+radius+1]
        core = np.clip(patch_detail / max(float(detail[y, x]), 0.12), 0, 1)
        profile = core * np.exp(-distance2 / (2 * 4.0 ** 2))
        profile += 0.045 * np.exp(-distance2 / (2 * 4.5 ** 2))
        amplitude = np.uint8(np.clip(profile, 0, 1) * 255)
        phase, speed = rng.integers(20, 236, size=2)
        target = star_map[y0+y-radius:y0+y+radius+1, x0+x-radius:x0+x+radius+1]
        choose = amplitude > target[:, :, 0]
        target[choose] = np.stack((amplitude, np.full_like(amplitude, phase),
                                  np.full_like(amplitude, speed)), axis=-1)[choose]
        stars.append({"x": x0+x, "y": y0+y, "phase": int(phase), "speed": int(speed)})

    atlas = Image.new("RGB", (w, h * 2))
    atlas.paste(backdrop, (0, 0))
    atlas.paste(Image.fromarray(star_map), (0, h))
    atlas.save(out / "nebula-atlas.png")
    backdrop.resize((1920, 1080), Image.Resampling.LANCZOS).save(out / "nebula-preview.jpg", quality=94)
    preview = backdrop.resize((1920, 1080), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(preview)
    for star in stars:
        x, y = star["x"] / 2, star["y"] / 2
        draw.ellipse((x-5, y-5, x+5, y+5), outline="#ff7868")
    preview.save(out / "nebula-star-detection.jpg", quality=92)
    metadata = {"source": source.name, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "size": [w, h], "portrait_box": [x0, y0, fw, fh], "seed": 74219,
                "stars": stars, "animated_pixel_fraction": float(np.mean(star_map[:, :, 0] > 0))}
    (out / "nebula.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Prepared {w}x{h}: {len(stars)} stars; {metadata['animated_pixel_fraction']:.3%} of pixels animated")
    print(f"Original preserved: {source}")
    print(f"Preview: {out / 'nebula-preview.jpg'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    prepare(args.source, args.output_dir)
