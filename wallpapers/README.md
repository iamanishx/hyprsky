# Wallpapers

Each folder here is one wallpaper. `hyprsky --scene <folder>` runs it, and `hyprsky --list` shows what's installed.

```
wallpapers/
  aurora/   Catppuccin Mocha aurora over ridged mountains (default)
  clouds/   black ASCII-art clouds over a starfield
  latte-dawn/  light: Catppuccin Latte pastel sunrise over lavender hills
```

## Adding one

1. Copy an existing folder: `cp -r wallpapers/aurora wallpapers/mything`
2. Edit the three files (see below).
3. Run it from the repo: `make run SCENE=mything`
4. While it's running, save your edits and reload them without restarting: `pkill -USR1 hyprsky`.
   Compile errors are printed to the terminal, and the last working shader keeps running.
5. `make install` copies it to `~/.local/share/hyprsky/wallpapers/`.

## The three files

### `scene.conf`

```ini
cell   = 4 4       # pass1 runs once per 4x4 screen pixels (1/16 of the work)
filter = linear    # how pass2 samples pass1: linear (smooth) or nearest (blocky / grid)
```

### `pass1.frag`: the expensive part, at low resolution

Draws into a small texture of `ceil(screen / cell)` pixels. Put heavy maths here (noise, fbm, loops).

| Uniform | |
|---|---|
| `float uTime` | seconds, wraps every 20000 s |
| `vec2 uGrid` | size of this pass in pixels |
| `vec2 uRes` | screen size in pixels |

### `pass2.frag`: the cheap part, once per screen pixel

Reads pass1 and adds the sharp details (edges, glyphs, stars, grain).

| Uniform | |
|---|---|
| `sampler2D uCells` | pass1's output |
| `float uTime`, `vec2 uGrid`, `vec2 uRes` | same as above |

Both files are GLSL ES 3.00. Don't write `#version` or `precision`: hyprsky adds them. Declare `out vec4 o;` (any name) and write an opaque colour.

## Keeping it light

- Smooth things (skies, gradients, fog, aurora) go in pass1 with a big `cell`. They look the same upscaled.
- Sharp things (edges, text, stars) go in pass2, but keep its loops short.
- Move slowly. At the default 15 fps, slow motion looks smooth and costs little.
- Check the cost with `ps -o pcpu= -C hyprsky`. The built-in wallpapers sit around 1–2 %.
