# hyprsky

Tiny animated shader wallpapers for Hyprland (and any wlroots compositor with layer-shell).
One small C program, two GPU passes, no browser, no video.

| `aurora` (default) | `clouds` |
|---|---|
| ![aurora](screenshots/aurora.jpg) | ![clouds](screenshots/clouds.jpg) |
| **`latte-dawn`** | **`thunder`** |
| ![latte-dawn](screenshots/latte-dawn.jpg) | ![thunder](screenshots/thunder.jpg) |

- **aurora**: Catppuccin Mocha aurora curtains over three ridged mountain layers, twinkling stars, film grain.
- **clouds**: black ASCII-art clouds (` .:;~)(o8`) drifting over a starfield.
- **latte-dawn**: light theme in Catppuccin Latte. Pastel sunrise, soft drifting clouds, rolling lavender hills with valley mist.
- **thunder**: a gold horizon line on black with a light pulse running along it, small arcs crackling along the line, drifting embers and a rippled floor reflection. Add `--image you.png` to stand your own cut-out picture on the line, reflected too.

## Why it's light

Measured on a 1920×1080 laptop (Intel Raptor Lake iGPU):

| | |
|---|---|
| Own memory | ~14–18 MB (plus ~50 MB of shared, file-backed Mesa driver code) |
| CPU | ~0.7–2 % |
| GPU | iGPU only, the dGPU stays asleep |

How:

- **Two passes.** The expensive part runs at low resolution: per character cell for clouds (160×68), quarter resolution for the aurora (480×270). The full-screen pass only does cheap lookups.
- **FPS cap** (15 by default). The scenes move slowly, so you can't tell the difference from 60.
- **Pauses when hidden.** Rendering is throttled by Wayland frame callbacks, so when the compositor stops showing the wallpaper (for example under a fullscreen window), it stops drawing.
- **Opaque, input-less layer surface**, so the compositor can skip blending under it.

## Recipe

### 1. Dependencies

Ubuntu / Debian:

```sh
sudo apt install build-essential pkg-config libwayland-dev libegl-dev libgles-dev libpng-dev wayland-protocols
```

Arch:

```sh
sudo pacman -S base-devel wayland mesa libpng wayland-protocols
```

### 2. Build and install

```sh
git clone https://github.com/iamanishx/hyprsky
cd hyprsky
make
make install        # binary -> ~/.local/bin/hyprsky, wallpapers -> ~/.local/share/hyprsky/wallpapers
```

### 3. Try it

```sh
hyprsky                     # aurora (Ctrl+C to stop)
hyprsky --scene clouds      # ASCII clouds
hyprsky --list              # installed wallpapers
hyprsky --fps 10            # even lighter
```

### 4. Make it your wallpaper (Hyprland)

In `~/.config/hypr/hyprland.conf`, comment out your old wallpaper (`swaybg`, `hyprpaper`, …) and add:

```ini
exec-once = env __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json ~/.local/bin/hyprsky --scene aurora --fps 15
```

The `__EGL_VENDOR_LIBRARY_FILENAMES` part pins it to Mesa (Intel/AMD iGPU), so a hybrid-graphics laptop doesn't wake the NVIDIA card. Drop it on a desktop with a single GPU.

To restart it without logging out:

```sh
pkill -x hyprsky; hyprctl dispatch exec "~/.local/bin/hyprsky --scene aurora"
```

## Options

| Flag | Default | |
|---|---|---|
| `--scene NAME` | aurora | Wallpaper folder name, or a path to one |
| `--image FILE.png` | | Picture for wallpapers that use one (`thunder`). Transparent PNG, with the subject's feet at the bottom edge |
| `--fps N` | 15 | Frame cap, 1–60 |
| `--list` | | Show installed wallpapers |

`pkill -USR1 hyprsky` reloads the shaders without restarting.

## Layout

```
hyprsky.c            the engine: Wayland layer surface, EGL, two-pass renderer, fps cap
wallpapers/
  aurora/            scene.conf + pass1.frag + pass2.frag
  clouds/
```

The engine knows nothing about any particular wallpaper. To make your own, add a folder under `wallpapers/`. [wallpapers/README.md](wallpapers/README.md) explains the three files and how to live-reload while you edit. Pull requests with new wallpapers are welcome.

Limitation: it draws on one output (the compositor's choice); multi-monitor support isn't there yet.

`wlr-layer-shell-unstable-v1.xml` is from [wlr-protocols](https://gitlab.freedesktop.org/wlroots/wlr-protocols) and keeps its own license.

## License

MIT
