# Related Aurora lock-screen fragment

`northern-lights-lock.frag` is the related non-ASCII, photo-backed Aurora experiment
for a shader-capable lock-screen renderer. It is preserved as a source reference,
not loaded by Hyprsky's scene loader.

Its host must bind `photoTexture` (RGB photograph), `photoSize`, `resolution`, `time`
and `opacity`. Actual integration depends on the lock-screen build's shader API.
The original photograph is not included; use an image you have permission to use.
For a native Hyprsky scene, see `wallpapers/green-aurora` instead.
