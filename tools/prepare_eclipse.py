#!/usr/bin/env python3
"""Prepare an RGB layer PNG for --scene berserk-moonlight.

Supply artwork you have permission to use. The hand-drawn matte outline below
fits a particular 16:9 composition (figure on right, moon upper left); adapt it
for your own artwork. Channels: source luminance, figure matte, thinned stars.
The source artwork is not distributed and is never overwritten.
Requires Pillow, NumPy and SciPy.
"""
from pathlib import Path
import argparse
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output_dir', type=Path)
args = parser.parse_args()
ROOT = args.output_dir
outputs = ('berserk-eclipse-layers.png', 'figure-matte.png', 'half-stars.png',
           'cutout-check.png', 'berserk-eclipse-layers.stats.json')
if args.source.resolve() in {(ROOT / name).resolve() for name in outputs}:
    parser.error('Choose a different output directory; the source must not be overwritten')
ROOT.mkdir(parents=True, exist_ok=True)
image = Image.open(args.source).convert("L")
w, h = image.size
luma = np.asarray(image)
# Outline in coordinates of the 1600x900 layout preview, scaled to the source.
outline = [
    (888, 900), (894, 859), (902, 837), (920, 812), (930, 780),
    (937, 752), (937, 730), (949, 696), (990, 690), (1010, 681),
    (1025, 703), (1038, 698), (1047, 718), (1063, 694), (1073, 718),
    (1085, 714), (1101, 724), (1126, 726), (1122, 698), (1115, 678),
    (1112, 653), (1118, 635), (1129, 612), (1140, 587), (1153, 568),
    (1154, 546), (1147, 532), (1149, 520), (1160, 510), (1173, 497),
    (1184, 485), (1208, 481), (1222, 475), (1225, 464), (1216, 453),
    (1224, 440), (1231, 451), (1241, 437), (1246, 451), (1260, 454),
    (1276, 464), (1287, 455), (1276, 437), (1265, 419), (1253, 403),
    (1255, 390), (1251, 383), (1266, 369), (1259, 357), (1266, 346),
    (1266, 335), (1283, 324), (1305, 323), (1335, 330), (1350, 340),
    (1364, 356), (1375, 380), (1374, 398), (1371, 414), (1396, 419),
    (1418, 417), (1435, 425), (1452, 429), (1479, 437), (1496, 440),
    (1496, 462), (1503, 482), (1519, 508), (1539, 536), (1555, 562),
    (1551, 591), (1550, 617), (1538, 641), (1523, 659), (1521, 684),
    (1536, 717), (1557, 758), (1577, 804), (1594, 846), (1600, 861),
    (1600, 900),
]
matte_image = Image.new("L", (w, h))
ImageDraw.Draw(matte_image).polygon(
    [(round(x * w / 1600), round(y * h / 900)) for x, y in outline], fill=255
)
matte_image = matte_image.filter(ImageFilter.GaussianBlur(1.2))
matte = np.asarray(matte_image)
yy, xx = np.mgrid[:h, :w]
# Exclude original moon and bottom-left cloud bank from the star extraction.
moon = ((xx / w - 0.312) * (w / h)) ** 2 + (yy / h - 0.107) ** 2 < 0.090 ** 2
old_clouds = (xx < w * 0.35) & (yy > h * 0.78)
# A small exclusion margin avoids treating stray armor/hair ink at the matte edge as stars.
figure_margin = ndimage.maximum_filter(matte, size=49) > 8
background = ~figure_margin & ~moon & ~old_clouds
labels, count = ndimage.label((luma >= 45) & background, structure=np.ones((3, 3)))
areas = np.bincount(labels.ravel())
# Avoid isolated JPEG noise, while retaining both tiny and larger source stars.
star_ids = np.flatnonzero((areas >= 3) & (areas <= 1200))
star_ids = star_ids[star_ids != 0]
rng = np.random.default_rng(2406)
rng.shuffle(star_ids)
kept_ids = star_ids[:len(star_ids) // 2]
lookup = np.zeros(count + 1, dtype=bool)
lookup[kept_ids] = True
support = ndimage.maximum_filter(lookup[labels], size=3) & background
star_luma = np.where(support, luma, 0).astype(np.uint8)
packed = np.stack((luma, matte, star_luma), axis=-1)
out = ROOT / "berserk-eclipse-layers.png"
Image.fromarray(packed).save(out)
matte_image.resize((1600, 900)).save(ROOT / "figure-matte.png")
Image.fromarray(star_luma).resize((1600, 900)).save(ROOT / "half-stars.png")
Image.fromarray(np.where(matte[..., None] > 127, np.repeat(luma[..., None], 3, axis=-1), np.array([30, 45, 55], dtype=np.uint8)).astype(np.uint8)).resize((1600, 900)).save(ROOT / "cutout-check.png")
stats = {"source_marks": int(len(star_ids)), "retained_marks": int(len(kept_ids)), "size": [w, h]}
(ROOT / "berserk-eclipse-layers.stats.json").write_text(json.dumps(stats, indent=2) + "\n")
print(json.dumps(stats), out)
