P=wlr-layer-shell-unstable-v1
XDG=/usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml
PKGS=wayland-client wayland-egl egl glesv2
PREFIX?=$(HOME)/.local
DATADIR?=$(PREFIX)/share/hyprsky

hyprsky: hyprsky.c $(P)-client-protocol.h $(P)-protocol.c xdg-shell-protocol.c
	cc -O2 -Wall -Wextra -o $@ hyprsky.c $(P)-protocol.c xdg-shell-protocol.c `pkg-config --cflags --libs $(PKGS)` -lm

$(P)-client-protocol.h: $(P).xml
	wayland-scanner client-header $< $@

$(P)-protocol.c: $(P).xml
	wayland-scanner private-code $< $@

xdg-shell-protocol.c:
	wayland-scanner private-code $(XDG) $@

install: hyprsky
	install -Dm755 hyprsky $(PREFIX)/bin/hyprsky
	mkdir -p $(DATADIR)
	cp -r wallpapers $(DATADIR)/

# run straight from the repo, using ./wallpapers
run: hyprsky
	HYPRSKY_WALLPAPERS=./wallpapers ./hyprsky --scene $(or $(SCENE),aurora)

.PHONY: install run
