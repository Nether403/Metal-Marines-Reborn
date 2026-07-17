#!/usr/bin/env python3
"""Generate Metal Marines sprite atlases for public/game-assets/.

Produces stylized isometric-looking tiles matching the remake faction palette
(player red/white, enemy gold/purple). Atlases are hot-swappable — replace PNGs
later without code changes.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "artifacts/metal-marines/public/game-assets"
OUT.mkdir(parents=True, exist_ok=True)

PLAYER = {
    "primary": (239, 68, 68, 255),
    "secondary": (248, 250, 252, 255),
    "trim": (153, 27, 27, 255),
    "dark": (69, 10, 10, 255),
    "glow": (248, 113, 113, 180),
    "glass": (186, 230, 253, 220),
}
ENEMY = {
    "primary": (217, 119, 6, 255),
    "secondary": (124, 58, 237, 255),
    "trim": (69, 26, 3, 255),
    "dark": (45, 15, 70, 255),
    "glow": (216, 180, 254, 180),
    "glass": (253, 230, 138, 220),
}


def new_rgba(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def shade(c, f: float):
    return tuple(max(0, min(255, int(ch * f))) for ch in c[:3]) + (c[3] if len(c) > 3 else 255,)


def draw_iso_diamond(draw: ImageDraw.ImageDraw, cx, cy, w, h, fill, outline=None):
    pts = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(pts, fill=fill, outline=outline)


def paint_terrain_cell(img: Image.Image, x0: int, y0: int, kind: str):
    d = ImageDraw.Draw(img)
    cell = img.crop((x0, y0, x0 + 64, y0 + 64))
    cd = ImageDraw.Draw(cell)
    if kind == "grass":
        for y in range(64):
            t = y / 63
            c = (
                int(18 + 40 * (1 - t)),
                int(90 + 50 * (1 - t)),
                int(48 + 20 * (1 - t)),
                255,
            )
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(40):
            gx = (i * 17 + 5) % 60 + 2
            gy = (i * 29 + 9) % 56 + 4
            cd.line([(gx, gy), (gx, gy - 3)], fill=(74, 222, 128, 200))
    elif kind == "forest":
        for y in range(64):
            c = (int(12 + y * 0.2), int(55 + y * 0.3), int(28 + y * 0.15), 255)
            cd.line([(0, y), (63, y)], fill=c)
        for cx, cy, r in [(18, 28, 12), (40, 22, 14), (32, 40, 11), (14, 44, 9)]:
            cd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(22, 101, 52, 255))
            cd.ellipse([cx - r + 3, cy - r + 2, cx + r - 4, cy + r - 5], fill=(34, 140, 70, 230))
    elif kind == "mountain":
        for y in range(64):
            c = (int(55 + y * 0.5), int(60 + y * 0.4), int(70 + y * 0.5), 255)
            cd.line([(0, y), (63, y)], fill=c)
        cd.polygon([(8, 56), (28, 14), (48, 56)], fill=(148, 163, 184, 255))
        cd.polygon([(24, 56), (44, 10), (62, 56)], fill=(100, 116, 139, 255))
        cd.polygon([(34, 18), (44, 10), (40, 28)], fill=(241, 245, 249, 230))
    elif kind == "water":
        for y in range(64):
            wave = math.sin(y / 6) * 8
            c = (int(12 + wave), int(70 + y * 0.4 + wave), int(140 + y * 0.5), 255)
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(6):
            yy = 10 + i * 9
            cd.arc([4, yy, 60, yy + 10], 200, 340, fill=(125, 211, 252, 160), width=1)
    elif kind == "toxic":
        for y in range(64):
            c = (int(40 + y * 0.6), int(180 - y * 0.4), int(40 + math.sin(y / 4) * 20), 255)
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(12):
            cx = (i * 13) % 56 + 4
            cy = (i * 19) % 52 + 6
            cd.ellipse([cx, cy, cx + 6, cy + 4], fill=(190, 242, 100, 180))
    # tile rim
    cd.rectangle([0, 0, 63, 63], outline=(15, 23, 42, 90))
    img.paste(cell, (x0, y0))


def make_terrain():
    img = new_rgba(64 * 5, 64)
    for i, kind in enumerate(["grass", "forest", "mountain", "water", "toxic"]):
        paint_terrain_cell(img, i * 64, 0, kind)
    img.save(OUT / "terrain.png")


def building_block(palette, label: str, state: str, w=64, h=64) -> Image.Image:
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, int(h * 0.62)
    # platform
    draw_iso_diamond(d, cx, cy + 6, w - 10, 22, shade(palette["dark"], 0.7), palette["trim"])
    body_h = 28 if h <= 64 else 40
    top = cy - body_h
    # body
    fill = palette["primary"]
    if state == "damaged":
        fill = shade(palette["primary"], 0.55)
    elif state == "construction":
        fill = (*palette["secondary"][:3], 160)
    elif state == "disabled":
        fill = shade(palette["secondary"], 0.45)

    d.rectangle([cx - 16, top, cx + 16, cy], fill=fill, outline=palette["trim"])
    # roof slant
    d.polygon(
        [(cx - 16, top), (cx, top - 10), (cx + 16, top)],
        fill=palette["secondary"] if state != "damaged" else shade(palette["trim"], 1.1),
    )
    # glass / antenna accents by label
    if label in ("HQ", "RADAR", "SEISMIC"):
        d.rectangle([cx - 8, top + 6, cx + 8, top + 18], fill=palette["glass"])
    if label in ("MISSILE", "ICBM", "EMP"):
        d.rectangle([cx - 3, top - 18, cx + 3, cy - 4], fill=palette["secondary"])
        d.ellipse([cx - 6, top - 24, cx + 6, top - 12], fill=palette["glow"])
    if label in ("ENERGY",):
        d.ellipse([cx - 10, top + 4, cx + 10, cy - 4], fill=palette["glass"])
        d.arc([cx - 10, top + 4, cx + 10, cy - 4], 0, 360, fill=palette["glow"], width=2)
    if label in ("SUPPLY", "FACTORY"):
        d.rectangle([cx - 12, top + 8, cx + 12, cy - 2], fill=shade(palette["dark"], 1.2))
        for i in range(3):
            d.line([(cx - 10 + i * 8, top + 10), (cx - 10 + i * 8, cy - 4)], fill=palette["secondary"], width=2)
    if label in ("AA", "TURRET", "GUNPOD"):
        d.ellipse([cx - 12, top + 2, cx + 12, cy - 2], fill=shade(palette["dark"], 1.1))
        d.rectangle([cx - 2, top - 14, cx + 2, top + 8], fill=palette["secondary"])
    if label in ("MECHBAY",):
        d.rectangle([cx - 14, top + 4, cx + 14, cy], fill=shade(palette["dark"], 0.9))
        d.polygon([(cx - 10, cy - 4), (cx, top + 2), (cx + 10, cy - 4)], fill=palette["glow"])
    if label in ("MINE",):
        d.ellipse([cx - 10, cy - 8, cx + 10, cy + 6], fill=shade(palette["trim"], 0.8))
    if label in ("DUMMY", "DUMMYCOVER"):
        d.rectangle([cx - 16, top, cx + 16, cy], outline=palette["secondary"], width=2)
        d.line([(cx - 12, top + 6), (cx + 12, cy - 6)], fill=palette["secondary"], width=2)
        d.line([(cx + 12, top + 6), (cx - 12, cy - 6)], fill=palette["secondary"], width=2)
    if label in ("JAMMER", "TUNNEL", "DESTAB", "WEATHER", "BIO"):
        d.ellipse([cx - 11, top + 2, cx + 11, top + 24], fill=palette["glass"])
        d.arc([cx - 14, top - 2, cx + 14, top + 28], 0, 360, fill=palette["glow"], width=2)
    if state == "construction":
        d.line([(cx - 18, top - 4), (cx + 18, cy + 2)], fill=(125, 211, 252, 200), width=2)
    if state == "damaged":
        d.line([(cx - 10, top + 4), (cx + 8, cy - 6)], fill=(15, 23, 42, 220), width=2)
        d.line([(cx + 4, top + 2), (cx - 6, cy - 2)], fill=(15, 23, 42, 180), width=1)
    return img


BUILDING_ROWS_PLAYER = [
    ("HQ", 80),
    ("MISSILE", 64),
    ("ENERGY", 64),
    ("SUPPLY", 64),
    ("RADAR", 64),
    ("JAMMER", 64),
    ("TUNNEL", 64),
    ("SEISMIC", 64),
    ("DESTAB", 64),
    ("WEATHER", 64),
    ("BIO", 64),
    ("EMP", 64),
    ("MECHBAY", 64),
    ("AA", 64),
    ("TURRET", 64),
    ("GUNPOD", 64),
    ("MINE", 64),
    ("FACTORY", 64),
    ("DUMMY", 64),
    ("DUMMYCOVER", 64),
    ("ICBM", 80),
]

STATES = ["idle", "damaged", "construction", "disabled"]


def make_buildings(path: Path, palette):
    # layout: each row is one building type, 4 state columns
    # HQ and ICBM are 64x80; others 64x64 — pack with row heights
    row_heights = [h for _, h in BUILDING_ROWS_PLAYER]
    width = 64 * 4
    height = sum(row_heights)
    img = new_rgba(width, height)
    y = 0
    for (label, h), rh in zip(BUILDING_ROWS_PLAYER, row_heights):
        for si, state in enumerate(STATES):
            cell = building_block(palette, label, state, 64, h)
            img.paste(cell, (si * 64, y), cell)
        y += rh
    img.save(path)


def mech_frame(palette, pose: str) -> Image.Image:
    img = new_rgba(40, 48)
    d = ImageDraw.Draw(img)
    # legs
    leg_off = 0
    if pose == "walking":
        leg_off = 3
    elif pose == "fighting":
        leg_off = -2
    d.rectangle([12, 30, 17, 44 + leg_off], fill=palette["trim"])
    d.rectangle([23, 30, 28, 44 - leg_off], fill=palette["trim"])
    # body
    d.rectangle([10, 14, 30, 34], fill=palette["primary"], outline=palette["secondary"])
    # head / cockpit
    d.rectangle([14, 6, 26, 16], fill=palette["glass"], outline=palette["trim"])
    # arms
    if pose == "fighting":
        d.rectangle([28, 16, 38, 20], fill=palette["secondary"])
        d.ellipse([34, 14, 40, 22], fill=palette["glow"])
    else:
        d.rectangle([6, 18, 12, 28], fill=shade(palette["primary"], 0.85))
        d.rectangle([28, 18, 34, 28], fill=shade(palette["primary"], 0.85))
    if pose == "dead":
        d.line([(8, 10), (32, 40)], fill=(15, 23, 42, 230), width=2)
    if pose == "boarding":
        d.rectangle([8, 2, 32, 10], fill=palette["glow"])
    return img


def make_units():
    poses = ["idle", "walking", "fighting", "boarding", "dead"]
    img = new_rgba(40 * 5, 48 * 2)
    for oi, pal in enumerate([PLAYER, ENEMY]):
        for pi, pose in enumerate(poses):
            frame = mech_frame(pal, pose)
            img.paste(frame, (pi * 40, oi * 48), frame)
    # Gunner II row accents — reuse fighting with gold trim overlay in same atlas unused for now
    img.save(OUT / "units.png")


def make_projectiles():
    # widths from manifest
    specs = [
        ("icbm", 24, 48, (248, 250, 252, 255)),
        ("emp", 32, 32, (125, 211, 252, 255)),
        ("transport_pod", 32, 24, (239, 68, 68, 255)),
        ("tunnel_buster", 24, 40, (250, 204, 21, 255)),
        ("dummy", 20, 36, (148, 163, 184, 255)),
        ("aa", 16, 28, (74, 222, 128, 255)),
    ]
    width = sum(s[1] for s in specs)
    img = new_rgba(width, 48)
    d = ImageDraw.Draw(img)
    x = 0
    for name, w, h, color in specs:
        cy = 24
        if name == "emp":
            d.ellipse([x + 2, cy - h // 2 + 2, x + w - 2, cy + h // 2 - 2], outline=color, width=3)
            d.ellipse([x + 8, cy - 6, x + w - 8, cy + 6], fill=(*color[:3], 120))
        elif name == "transport_pod":
            d.polygon(
                [(x + 2, cy), (x + w // 2, cy - h // 2 + 2), (x + w - 2, cy), (x + w // 2, cy + h // 2 - 2)],
                fill=color,
            )
        else:
            d.polygon(
                [(x + w // 2, cy - h // 2 + 2), (x + w - 2, cy + h // 2 - 4), (x + w // 2, cy + h // 2 - 2), (x + 2, cy + h // 2 - 4)],
                fill=color,
            )
            d.ellipse([x + w // 2 - 3, cy - h // 2, x + w // 2 + 3, cy - h // 2 + 8], fill=(251, 146, 60, 255))
        x += w
    img.save(OUT / "projectiles.png")


def make_fx():
    """Explosion / smoke / muzzle flipbook atlas for battlefeel."""
    # 8 frames x 48px explosion, 6 smoke, 4 muzzle
    frame = 48
    cols = 8
    img = new_rgba(frame * cols, frame * 3)
    d = ImageDraw.Draw(img)
    # row 0 explosions
    for i in range(8):
        cx, cy = i * frame + 24, 24
        r = 4 + i * 3
        alpha = max(40, 220 - i * 24)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(251, 146, 60, alpha))
        d.ellipse([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2], fill=(254, 243, 199, alpha))
        if i > 2:
            for a in range(6):
                ang = a * math.pi / 3
                dx = int(math.cos(ang) * r * 0.9)
                dy = int(math.sin(ang) * r * 0.9)
                d.line([(cx, cy), (cx + dx, cy + dy)], fill=(239, 68, 68, alpha), width=2)
    # row 1 smoke
    for i in range(6):
        cx, cy = i * frame + 24, frame + 24
        r = 6 + i * 2
        d.ellipse([cx - r, cy - r - i, cx + r, cy + r - i], fill=(100, 116, 139, max(30, 160 - i * 20)))
        d.ellipse([cx - r + 4, cy - r - 4 - i, cx + r - 2, cy + r - 6 - i], fill=(71, 85, 105, max(20, 120 - i * 15)))
    # row 2 muzzle
    for i in range(4):
        cx, cy = i * frame + 24, frame * 2 + 24
        d.ellipse([cx - 4 - i, cy - 3, cx + 8 + i * 2, cy + 3], fill=(254, 249, 195, 220 - i * 40))
        d.polygon([(cx - 2, cy), (cx + 14 + i * 3, cy - 4 - i), (cx + 14 + i * 3, cy + 4 + i)], fill=(251, 191, 36, 200))
    img.save(OUT / "fx.png")


def make_ui():
    img = new_rgba(128, 64)
    d = ImageDraw.Draw(img)
    # selection rings
    d.ellipse([4, 4, 60, 60], outline=(239, 68, 68, 220), width=3)
    d.ellipse([68, 4, 124, 60], outline=(217, 119, 6, 220), width=3)
    img.save(OUT / "ui.png")


def main():
    make_terrain()
    make_buildings(OUT / "buildings-player.png", PLAYER)
    make_buildings(OUT / "buildings-enemy.png", ENEMY)
    make_units()
    make_projectiles()
    make_fx()
    make_ui()
    print(f"Wrote atlases to {OUT}")
    for p in sorted(OUT.glob("*.png")):
        print(f"  {p.name}: {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
