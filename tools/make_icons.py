#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render PNG icons (active + inactive variants) from a single design.

Design: blue rounded-square, white globe (ring + meridian + equator),
white clock hands with an amber minute hand. Inactive variant is a
desaturated grey of the same shape.

Usage:  python tools/make_icons.py
Output: icons/16.png, icons/32.png, icons/48.png, icons/128.png
        icons/16-off.png, icons/32-off.png, icons/48-off.png, icons/128-off.png
"""
import os
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
SS = 8  # supersampling factor

ACTIVE_BG_TOP = (0x3B, 0x82, 0xF6)
ACTIVE_BG_BOT = (0x1E, 0x40, 0xAF)
ACTIVE_FG = (0xFF, 0xFF, 0xFF)
ACTIVE_ACCENT = (0xFB, 0xBF, 0x24)

INACTIVE_BG_TOP = (0xE5, 0xE7, 0xEB)
INACTIVE_BG_BOT = (0xC7, 0xD2, 0xDA)
INACTIVE_FG = (0x6B, 0x72, 0x80)
INACTIVE_ACCENT = (0x9C, 0xA3, 0xAF)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render(size, active):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    top = ACTIVE_BG_TOP if active else INACTIVE_BG_TOP
    bot = ACTIVE_BG_BOT if active else INACTIVE_BG_BOT
    fg = ACTIVE_FG if active else INACTIVE_FG
    accent = ACTIVE_ACCENT if active else INACTIVE_ACCENT

    # rounded-square background with a vertical gradient
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    radius = int(S * 0.225)
    md.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        gd.line([(0, y), (S, y)], fill=lerp(top, bot, y / max(1, S - 1)) + (255,))
    img.paste(grad, (0, 0), mask)

    cx, cy = S / 2, S / 2
    R = S * 0.36                     # globe radius
    ring_w = max(2, int(S * 0.055))

    # globe: ring, meridian ellipse, equator
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=fg, width=ring_w)
    rx = R * 0.42
    d.ellipse([cx - rx, cy - R, cx + rx, cy + R], outline=fg, width=max(2, int(ring_w * 0.8)))
    d.line([cx - R, cy, cx + R, cy], fill=fg, width=max(2, int(ring_w * 0.8)))

    # clock hands (hour up, minute at ~4 o'clock), amber minute hand
    hand_w = max(2, int(S * 0.05))
    d.line([cx, cy, cx, cy - R * 0.62], fill=accent, width=hand_w)
    d.line([cx, cy, cx + R * 0.5, cy + R * 0.34], fill=fg, width=hand_w)
    r0 = max(2, int(S * 0.045))
    d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=fg)

    return img.resize((size, size), Image.LANCZOS)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "icons")
    os.makedirs(out, exist_ok=True)
    for size in SIZES:
        render(size, True).save(os.path.join(out, "%d.png" % size))
        render(size, False).save(os.path.join(out, "%d-off.png" % size))
        print("wrote icons/%d.png (%d-off.png)" % (size, size))


if __name__ == "__main__":
    main()
