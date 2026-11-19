#!/usr/bin/env python3
"""Rasterize public-domain Natural Earth geometry for a procedural ASCII globe.

R=land coverage, G=coastal glow, B=country borders. This is a geographic data
texture, not a wallpaper image. Projection, lighting and motion happen in GLSL.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, maximum_filter, minimum_filter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools/data/ne_110m_admin_0_countries.geojson'
W, H = 2048, 1024
land = Image.new('L', (W, H))
borders = Image.new('L', (W, H))
ld, bd = ImageDraw.Draw(land), ImageDraw.Draw(borders)
features = json.loads(SOURCE.read_text())['features']
for feature in features:
    geom = feature['geometry']
    polygons = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            points = [((lon+180)/360*(W-1), (90-lat)/180*(H-1)) for lon,lat in ring]
            ld.polygon(points, fill=255 if index == 0 else 0)
            bd.line(points, fill=255, width=1)
coverage = np.asarray(land) > 0
coast = maximum_filter(coverage, size=3) != minimum_filter(coverage, size=3)
distance = distance_transform_edt(~coast)
glow = np.uint8(np.exp(-distance/2.0)*255)
land = land.filter(ImageFilter.GaussianBlur(0.45))
borders = borders.filter(ImageFilter.GaussianBlur(0.40))
texture = Image.merge('RGB', (land, Image.fromarray(glow), borders))
output = ROOT / 'wallpapers/network-orbit/map.png'
texture.save(output)
metadata = {
    'source': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
    'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'license': 'Public domain — Natural Earth',
    'terms': 'https://www.naturalearthdata.com/about/terms-of-use/',
    'size': [W,H],
    'channels': ['land coverage','coast glow','country borders'],
}
(ROOT/'tools/data/network-map-source.json').write_text(json.dumps(metadata, indent=2)+'\n')
print(f'Created {output}: {W}x{H}, {len(features)} country features')
