# Community wallpaper collection

Fifteen wallpaper folders contributed by [@ujsquared](https://github.com/ujsquared),
from a set of AI-assisted shader experiments. They use the existing two-pass
Hyprsky interface; **there are no renderer changes or new runtime dependencies**.
The original asciipaper sources and settings are retained for editing and reuse.

## Ready to run

| Scene | Description | Image dependency |
|---|---|---|
| `nebula` | Slowly evolving gold/cyan gas, a fixed dark dust pillar, twinkling stars | None |
| `network-orbit` | Large rotating ASCII globe, cyan/violet/amber traffic trails, pulsing city hubs | Bundled public-domain geographic map |
| `ribbon-aurora` | Green/teal/violet light ribbons rendered as ASCII | None |
| `fighter-islands` | A small fighter above moving islands, sea and clouds | None |
| `space-drifter` | ASCII astronaut, colored nebula, ringed planet and black hole | None |

```sh
make
HYPRSKY_WALLPAPERS=./wallpapers ./hyprsky --scene network-orbit --fps 24
```

The globe is simulated artwork: its 23 paths connect 15 geographic city anchors,
not live network traffic or detected cyberattacks. Its globe occupies about 93%
of the viewport height; exposure is 1.4, with slim, long trails and bright stars.
Its visual reference was [Global Network Traffic](https://steamcommunity.com/sharedfiles/filedetails/?id=820502524),
not that web application's code or data feed.

## Bring-your-own-image recipes

These preserve the image-driven experiments without redistributing downloaded
photographs, manga art, or their extracted layers. They are not complete image
wallpapers until you supply a PNG. Missing images render an opaque fallback.
Use images you have permission to use, and do not commit them to the project.

| Scene | PNG expected / effect |
|---|---|
| `alpine-meadow` | Landscape; upper-sky drift and color-masked flower sway |
| `moonlit-peak` | Mountain/night landscape; cloud and light settings |
| `moonlit-resort` | Night landscape; cloud drift and warm-light flicker |
| `northern-lights-photo` | Green aurora photograph; ASCII green-emission motion |
| `green-aurora` | Green aurora photograph; non-ASCII light overlay, with a static terrain band |
| `yosemite-sunset` | Sunset landscape; ASCII sky/cloud animation |
| `retro-tower` | Any image; subtle flag-like warp in ASCII |
| `berserk-moonlight` | Packed RGB layers: luminance / figure matte / sky marks; red eclipse and mono clouds |
| `berserk-moonlight-legacy` | Ordinary image; older monochrome sky/snow treatment |
| `nebula-photo` | Photo + star-map PNG atlas; fixed photograph with detected-star twinkling |

```sh
HYPRSKY_WALLPAPERS=./wallpapers ./hyprsky --scene northern-lights-photo --image /path/to/your-aurora.png
```

Masks and coordinates in these recipes were tuned for particular compositions;
edit them for different artwork. They do not perform semantic segmentation.
The old green-photo masks are heuristic and not a guarantee that every landscape
pixel will be static for an arbitrary photograph.

### Prepare layered inputs

Optional authoring tools use **Pillow, NumPy and SciPy**. They are not needed to
build or run Hyprsky. The scripts never download the source artwork.

```sh
# A portrait is contained in a 16:9 frame over soft side fill. This is deliberately
# a photo mode, distinct from the fully procedural edge-to-edge nebula.
python3 tools/prepare_nebula.py /path/to/your-space-photo.jpg /path/to/output
./hyprsky --scene ./wallpapers/nebula-photo --image /path/to/output/nebula-atlas.png

# Adapt the outlined figure coordinates in this script to your own artwork first.
python3 tools/prepare_eclipse.py /path/to/your-artwork.png /path/to/output
./hyprsky --scene ./wallpapers/berserk-moonlight --image /path/to/output/berserk-eclipse-layers.png
```

## Editing / regeneration

- `wallpapers/nebula/*.frag` and `wallpapers/green-aurora/*.frag` are editable native passes.
- `wallpapers/nebula-photo/pass2.frag` samples the two halves of its packed PNG.
- The other twelve folders are generated from `contrib/asciipaper/*.json` and
  their referenced `cell(vec2)` GLSL. Run `make regen-wallpapers` after editing.
- `tools/port_asciipaper.py` adapts uniforms to Hyprsky and bakes spec defaults as
  shader constants. Runtime tuning is by shader edit + SIGUSR1, not a new CLI.
- The portable renderer uses hand-authored 5x7 bitmaps in 6x8 cells. It preserves
  the scene math but does **not** reproduce asciipaper's Pango fonts, exact glyph
  density, pointer effects, RGB splitting or full post-processing stack.
- `contrib/hyprlock/` also preserves the related lock-screen fragment as a reference;
  that fragment is not a Hyprsky wallpaper by itself.

## Verification

`make test` builds a small surfaceless EGL smoke renderer using Hyprsky's actual
shader loader, header, config parser, PNG loader and uniform setup. It checks all
nineteen scenes (the four existing ones plus this collection) at two times and odd
viewport sizes, with synthetic image fixtures and missing-image fallbacks.
It does not connect to Wayland or replace your wallpaper. A Mesa software-rendering
run is also possible with `LIBGL_ALWAYS_SOFTWARE=1 make test`.

Screenshots in `screenshots/collection/` are rendered from the five self-contained
scenes. No third-party photograph or manga screenshot is included.

## Attribution

- Custom collection shaders are contributed under this repository's MIT license.
- `contrib/asciipaper/media.glsl` (used by retro-tower) is from
  [cYoren/asciipaper-engine](https://github.com/cYoren/asciipaper-engine), MIT;
  its original notice is retained in `contrib/asciipaper/ASCIIPAPER-LICENSE.txt`.
- Network Orbit's land/border data is [Natural Earth](https://www.naturalearthdata.com/),
  public domain. `tools/data/network-map-source.json` records the URL, hash and
  terms. `python3 tools/build_network_map.py` regenerates the bundled `map.png`.
- The source images used during the private image-based experiments are intentionally
  excluded. This contribution grants no rights to third-party reference artwork.
