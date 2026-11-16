P=wlr-layer-shell-unstable-v1
XDG=/usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml
PKGS=wayland-client wayland-egl egl glesv2

mbxd-sky: mbxd-sky.c $(P)-client-protocol.h $(P)-protocol.c xdg-shell-protocol.c
	cc -O2 -Wall -Wextra -o $@ mbxd-sky.c $(P)-protocol.c xdg-shell-protocol.c `pkg-config --cflags --libs $(PKGS)` -lm

$(P)-client-protocol.h: $(P).xml
	wayland-scanner client-header $< $@

$(P)-protocol.c: $(P).xml
	wayland-scanner private-code $< $@

xdg-shell-protocol.c:
	wayland-scanner private-code $(XDG) $@

install: mbxd-sky
	install -Dm755 mbxd-sky $(HOME)/.local/bin/mbxd-sky
