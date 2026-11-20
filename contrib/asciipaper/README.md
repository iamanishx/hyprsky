# Original asciipaper sources

These are the original custom `vec4 cell(vec2 uv)` shaders and twelve scene specs,
with machine-specific media paths removed. They are retained as editable source
for the native Hyprsky ports, not as additional engine code.

Run `make regen-wallpapers` from the repository root after editing a spec or GLSL
file here. `python3 tools/port_asciipaper.py --check` detects stale generated passes.
Use `wallpapers/<name>/` with Hyprsky; these JSON files are **not** Hyprsky configs.

The source `aurora.json` maps to `ribbon-aurora` so it does not replace Hyprsky's
existing Aurora. The older `berserk-moonlight.before-sky-rebuild` maps to
`berserk-moonlight-legacy`. Moonlit Peak and Moonlit Resort reuse Alpine Meadow's
shader with their own settings. Retro Tower reuses `media.glsl`.

The original asciipaper media fields name APF1 data files, which are not included.
Native Hyprsky ports instead use PNGs through `--image`; the globe includes its
public-domain map. See [the collection guide](../COLLECTION.md) for image layouts,
conversion tools, rendering differences and attribution.

`media.glsl` is third-party MIT code from cYoren/asciipaper-engine. Its notice is
preserved in `ASCIIPAPER-LICENSE.txt`; the custom scenes use the repository license.
