#!/usr/bin/env python3
"""Metal Marines 2026 remaster atlas generator.
Classic Win3.1 readability + modern polish. Matches core.json layout exactly.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(
    r"C:\Users\marti_km5l3j5\AppData\Local\Temp\mm-remaster"
    r"\Metal-Marines-Reborn\artifacts\metal-marines\public\game-assets"
)
DOCS = Path(
    r"C:\Users\marti_km5l3j5\AppData\Local\Temp\mm-remaster"
    r"\Metal-Marines-Reborn\docs"
)

# --- Style bible palette (classic MM remaster) ---
PAL = {
    "grass_deep": (34, 92, 48),
    "grass_mid": (58, 130, 62),
    "grass_hi": (92, 168, 78),
    "grass_dot": (120, 190, 95),
    "dirt": (110, 88, 48),
    "forest_canopy": (28, 78, 42),
    "forest_hi": (48, 120, 58),
    "forest_trunk": (72, 52, 28),
    "mtn_dark": (70, 78, 88),
    "mtn_mid": (110, 118, 128),
    "mtn_hi": (190, 198, 208),
    "water_deep": (18, 70, 120),
    "water_mid": (40, 120, 170),
    "water_hi": (90, 190, 220),
    "toxic_base": (70, 110, 20),
    "toxic_hi": (180, 230, 60),
    "pad": (48, 52, 48),
    "pad_hi": (80, 84, 78),
    "metal": (150, 155, 148),
    "metal_dk": (70, 74, 70),
    "metal_hi": (210, 215, 205),
    "olive": (90, 105, 55),
    "olive_dk": (55, 68, 35),
    "olive_hi": (130, 145, 85),
    "player_trim": (210, 50, 45),
    "player_white": (235, 238, 240),
    "enemy_gold": (220, 160, 40),
    "enemy_purple": (130, 70, 180),
    "enemy_dk": (50, 30, 70),
    "smoke": (40, 40, 42),
    "fire": (255, 140, 40),
    "glass": (120, 190, 220),
}


def aa_poly(draw: ImageDraw.ImageDraw, pts, fill, outline=None):
    draw.polygon(pts, fill=fill, outline=outline)


def iso_box(cx, cy, w, d, h, c_top, c_left, c_right):
    """Simple isometric box. cy is ground contact. Returns polygons."""
    # top diamond
    hw, hd = w / 2, d / 2
    top = [
        (cx, cy - h - hd),
        (cx + hw, cy - h),
        (cx, cy - h + hd),
        (cx - hw, cy - h),
    ]
    left = [
        (cx - hw, cy - h),
        (cx, cy - h + hd),
        (cx, cy + hd),
        (cx - hw, cy),
    ]
    right = [
        (cx + hw, cy - h),
        (cx, cy - h + hd),
        (cx, cy + hd),
        (cx + hw, cy),
    ]
    return top, left, right, c_top, c_left, c_right


def draw_iso_box(draw, cx, cy, w, d, h, c_top, c_left, c_right, outline=None):
    top, left, right, *_ = iso_box(cx, cy, w, d, h, c_top, c_left, c_right)
    draw.polygon(right, fill=c_right, outline=outline)
    draw.polygon(left, fill=c_left, outline=outline)
    draw.polygon(top, fill=c_top, outline=outline)


def shade(rgb, f):
    return tuple(max(0, min(255, int(c * f))) for c in rgb)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def new_rgba(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


# ---------- TERRAIN ----------
def tile_grass(rng: random.Random) -> Image.Image:
    im = new_rgba(64, 64)
    px = im.load()
    for y in range(64):
        for x in range(64):
            n = rng.random()
            if n < 0.08:
                c = PAL["dirt"]
            elif n < 0.25:
                c = PAL["grass_hi"]
            elif n < 0.55:
                c = PAL["grass_mid"]
            else:
                c = PAL["grass_deep"]
            # subtle checker noise
            if (x + y) % 7 == 0:
                c = shade(c, 1.08)
            px[x, y] = (*c, 255)
    # blade dots
    d = ImageDraw.Draw(im)
    for _ in range(40):
        x, y = rng.randint(2, 61), rng.randint(2, 61)
        d.point((x, y), fill=(*PAL["grass_dot"], 255))
        d.point((x, y - 1), fill=(*shade(PAL["grass_hi"], 1.1), 200))
    return im


def tile_forest(rng: random.Random) -> Image.Image:
    im = tile_grass(rng)
    d = ImageDraw.Draw(im)
    # canopy blobs - dense, readable as trees at zoom
    for _ in range(14):
        cx, cy = rng.randint(8, 56), rng.randint(8, 56)
        r = rng.randint(7, 14)
        d.ellipse([cx - r, cy - r + 2, cx + r, cy + r + 2], fill=(*PAL["forest_canopy"], 255))
        d.ellipse([cx - r + 2, cy - r, cx + r - 2, cy + r - 4], fill=(*PAL["forest_hi"], 255))
        # highlight
        d.ellipse([cx - 3, cy - r + 2, cx + 2, cy - r + 8], fill=(*shade(PAL["forest_hi"], 1.25), 220))
    return im


def tile_mountain(rng: random.Random) -> Image.Image:
    im = new_rgba(64, 64)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 63, 63], fill=(*PAL["mtn_dark"], 255))
    # ridges
    peaks = [(12, 48, 28), (32, 52, 40), (50, 46, 26), (22, 40, 20), (44, 38, 18)]
    for px, base, h in peaks:
        d.polygon(
            [(px - 14, base), (px, base - h), (px + 14, base)],
            fill=(*PAL["mtn_mid"], 255),
        )
        d.polygon(
            [(px - 4, base - h + 8), (px, base - h), (px + 6, base - h + 10)],
            fill=(*PAL["mtn_hi"], 255),
        )
    # scree
    for _ in range(30):
        x, y = rng.randint(0, 63), rng.randint(40, 63)
        d.point((x, y), fill=(*PAL["mtn_hi"], 180))
    return im


def tile_water(rng: random.Random) -> Image.Image:
    im = new_rgba(64, 64)
    px = im.load()
    for y in range(64):
        for x in range(64):
            wave = math.sin((x + y * 0.6) * 0.35) * 0.5 + 0.5
            wave2 = math.sin((x * 0.5 - y * 0.4) * 0.5) * 0.5 + 0.5
            t = (wave * 0.6 + wave2 * 0.4)
            c = lerp(PAL["water_deep"], PAL["water_hi"], t * 0.7)
            if (x + y * 3) % 17 == 0:
                c = PAL["water_hi"]
            px[x, y] = (*c, 255)
    # foam edges subtle
    d = ImageDraw.Draw(im)
    for i in range(0, 64, 8):
        d.point((i, (i * 3) % 64), fill=(220, 240, 255, 160))
    return im


def tile_toxic(rng: random.Random) -> Image.Image:
    im = new_rgba(64, 64)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 63, 63], fill=(*PAL["toxic_base"], 255))
    for _ in range(25):
        x, y = rng.randint(0, 50), rng.randint(0, 50)
        r = rng.randint(4, 12)
        d.ellipse([x, y, x + r, y + r], fill=(*PAL["toxic_hi"], 200))
    # hex-ish spots like existing atlas identity
    for y in range(8, 64, 14):
        for x in range(8, 64, 16):
            d.ellipse([x - 4, y - 3, x + 4, y + 3], fill=(*shade(PAL["toxic_hi"], 0.85), 220))
    return im


def build_terrain() -> Image.Image:
    rng = random.Random(2026)
    sheet = new_rgba(320, 64)
    tiles = [tile_grass(rng), tile_forest(rng), tile_mountain(rng), tile_water(rng), tile_toxic(rng)]
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 64, 0))
    return sheet


# ---------- BUILDINGS ----------
BUILDING_ROWS = [
    ("hq", 0, 80),
    ("missile_launcher", 80, 64),
    ("energy_plant", 144, 64),
    ("supply_depot", 208, 64),
    ("radar", 272, 64),
    ("radar_jammer", 336, 64),
    ("tunnel_entrance", 400, 64),
    ("seismic_sensor", 464, 64),
    ("terrain_destabilizer", 528, 64),
    ("weather_control", 592, 64),
    ("biosphere_engine", 656, 64),
    ("emp_cannon", 720, 64),
    ("metal_marine_base", 784, 64),
    ("aa_gun", 848, 64),
    ("gun_turret", 912, 64),
    ("gun_pod", 976, 64),
    ("land_mine", 1040, 64),
    ("factory", 1104, 64),
    ("dummy_base", 1168, 64),
    ("dummy_cover", 1232, 64),
    ("icbm_silo", 1296, 80),
]


def faction_colors(owner: str):
    if owner == "player":
        return {
            "primary": PAL["olive"],
            "primary_dk": PAL["olive_dk"],
            "primary_hi": PAL["olive_hi"],
            "trim": PAL["player_trim"],
            "accent": PAL["player_white"],
            "metal": PAL["metal"],
            "metal_dk": PAL["metal_dk"],
            "metal_hi": PAL["metal_hi"],
            "glass": PAL["glass"],
        }
    return {
        "primary": shade(PAL["enemy_purple"], 0.75),
        "primary_dk": PAL["enemy_dk"],
        "primary_hi": PAL["enemy_purple"],
        "trim": PAL["enemy_gold"],
        "accent": PAL["enemy_gold"],
        "metal": (100, 90, 110),
        "metal_dk": (45, 35, 55),
        "metal_hi": (180, 160, 200),
        "glass": PAL["glass"],
    }


def draw_pad(draw, cx, cy, w=36, d=20):
    # ground pad under building
    pts = [
        (cx, cy - d // 2),
        (cx + w // 2, cy),
        (cx, cy + d // 2),
        (cx - w // 2, cy),
    ]
    draw.polygon(pts, fill=(*PAL["pad"], 255))
    draw.polygon(
        [(cx, cy - d // 2 + 2), (cx + w // 2 - 3, cy), (cx, cy + d // 2 - 2), (cx - w // 2 + 3, cy)],
        fill=(*PAL["pad_hi"], 255),
    )


def draw_flag(draw, x, y, color):
    draw.line([(x, y), (x, y - 14)], fill=(30, 30, 30, 255), width=1)
    draw.polygon([(x, y - 14), (x + 8, y - 11), (x, y - 8)], fill=(*color, 255))


def draw_building_idle(im: Image.Image, btype: str, owner: str, h: int):
    d = ImageDraw.Draw(im)
    f = faction_colors(owner)
    cx, cy = 32, h - 10
    draw_pad(d, cx, cy + 2)

    if btype == "hq":
        # wide command fortress - classic MM presence
        draw_iso_box(d, cx, cy, 44, 28, 22, f["primary_hi"], f["primary"], f["primary_dk"])
        draw_iso_box(d, cx, cy - 10, 28, 18, 14, f["metal_hi"], f["metal"], f["metal_dk"])
        # antenna
        d.line([(cx + 8, cy - 36), (cx + 8, cy - 48)], fill=(*f["metal_hi"], 255), width=2)
        d.ellipse([cx + 5, cy - 52, cx + 11, cy - 46], fill=(*f["trim"], 255))
        draw_flag(d, cx - 14, cy - 28, f["trim"])
        draw_flag(d, cx + 16, cy - 24, f["accent"])
        # door
        d.rectangle([cx - 4, cy - 8, cx + 4, cy + 2], fill=(*f["metal_dk"], 255))
    elif btype == "missile_launcher":
        draw_iso_box(d, cx, cy, 30, 20, 10, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.8))
        # twin tubes angled
        for ox in (-6, 6):
            d.polygon(
                [(cx + ox - 3, cy - 12), (cx + ox + 3, cy - 12), (cx + ox + 5, cy - 34), (cx + ox - 5, cy - 34)],
                fill=(*f["metal_hi"], 255),
            )
            d.ellipse([cx + ox - 4, cy - 38, cx + ox + 4, cy - 32], fill=(*f["trim"], 255))
    elif btype == "energy_plant":
        draw_iso_box(d, cx, cy, 28, 18, 12, f["primary_hi"], f["primary"], f["primary_dk"])
        # dome
        d.ellipse([cx - 12, cy - 34, cx + 12, cy - 12], fill=(*f["glass"], 230))
        d.ellipse([cx - 8, cy - 30, cx + 6, cy - 16], fill=(*shade(f["glass"], 1.2), 180))
        d.rectangle([cx - 3, cy - 14, cx + 3, cy - 2], fill=(*f["metal"], 255))
    elif btype == "supply_depot":
        draw_iso_box(d, cx, cy, 34, 22, 14, f["primary_hi"], f["primary"], f["primary_dk"])
        d.rectangle([cx - 10, cy - 18, cx + 10, cy - 10], fill=(*f["metal_dk"], 255))
        for i in range(3):
            d.line([(cx - 8 + i * 6, cy - 16), (cx - 8 + i * 6, cy - 11)], fill=(*f["trim"], 255), width=2)
    elif btype == "radar":
        draw_iso_box(d, cx, cy, 22, 16, 10, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.85))
        d.ellipse([cx - 14, cy - 36, cx + 14, cy - 12], outline=(*f["accent"], 255), width=2)
        d.line([(cx, cy - 24), (cx + 12, cy - 32)], fill=(*f["trim"], 255), width=2)
        d.ellipse([cx - 3, cy - 27, cx + 3, cy - 21], fill=(*f["trim"], 255))
    elif btype == "radar_jammer":
        draw_iso_box(d, cx, cy, 22, 16, 10, f["primary"], f["primary_dk"], shade(f["primary_dk"], 0.85))
        for ang in range(0, 360, 45):
            rad = math.radians(ang)
            d.line(
                [(cx, cy - 22), (cx + math.cos(rad) * 14, cy - 22 + math.sin(rad) * 8)],
                fill=(*f["trim"], 200),
                width=1,
            )
        d.ellipse([cx - 5, cy - 27, cx + 5, cy - 17], fill=(*f["accent"], 255))
    elif btype == "tunnel_entrance":
        draw_iso_box(d, cx, cy, 30, 20, 8, f["metal_dk"], shade(f["metal_dk"], 0.7), shade(f["metal_dk"], 0.55))
        d.ellipse([cx - 10, cy - 14, cx + 10, cy + 2], fill=(20, 20, 22, 255))
        d.ellipse([cx - 7, cy - 11, cx + 7, cy - 1], fill=(10, 10, 12, 255))
    elif btype in ("seismic_sensor", "terrain_destabilizer", "weather_control", "biosphere_engine"):
        draw_iso_box(d, cx, cy, 24, 16, 12, f["primary_hi"], f["primary"], f["primary_dk"])
        col = {
            "seismic_sensor": f["accent"],
            "terrain_destabilizer": PAL["dirt"],
            "weather_control": PAL["water_hi"],
            "biosphere_engine": PAL["grass_hi"],
        }[btype]
        d.ellipse([cx - 8, cy - 28, cx + 8, cy - 12], fill=(*col, 255))
        d.rectangle([cx - 2, cy - 14, cx + 2, cy - 4], fill=(*f["metal"], 255))
    elif btype == "emp_cannon":
        draw_iso_box(d, cx, cy, 26, 18, 10, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.8))
        d.polygon(
            [(cx - 4, cy - 12), (cx + 4, cy - 12), (cx + 6, cy - 30), (cx - 6, cy - 30)],
            fill=(*PAL["glass"], 255),
        )
        d.ellipse([cx - 5, cy - 34, cx + 5, cy - 28], fill=(*f["trim"], 255))
    elif btype == "metal_marine_base":
        draw_iso_box(d, cx, cy, 36, 24, 12, f["primary_hi"], f["primary"], f["primary_dk"])
        # hangar door
        d.rectangle([cx - 10, cy - 10, cx + 10, cy + 2], fill=(*f["metal_dk"], 255))
        d.line([(cx, cy - 10), (cx, cy + 2)], fill=(*f["trim"], 255), width=1)
        draw_flag(d, cx + 12, cy - 18, f["trim"])
    elif btype in ("aa_gun", "gun_turret", "gun_pod"):
        draw_iso_box(d, cx, cy, 22, 16, 8, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.8))
        # turret
        d.ellipse([cx - 8, cy - 20, cx + 8, cy - 6], fill=(*f["primary"], 255))
        barrel_len = 18 if btype != "gun_pod" else 12
        d.rectangle([cx - 2, cy - 8 - barrel_len, cx + 2, cy - 8], fill=(*f["metal_hi"], 255))
        if btype == "aa_gun":
            d.rectangle([cx + 3, cy - 8 - barrel_len + 2, cx + 6, cy - 10], fill=(*f["metal_hi"], 255))
    elif btype == "land_mine":
        d.ellipse([cx - 10, cy - 6, cx + 10, cy + 6], fill=(*f["metal_dk"], 255))
        d.ellipse([cx - 6, cy - 4, cx + 6, cy + 3], fill=(*f["trim"], 255))
        d.ellipse([cx - 2, cy - 1, cx + 2, cy + 1], fill=(20, 20, 20, 255))
    elif btype == "factory":
        draw_iso_box(d, cx, cy, 38, 24, 16, f["primary_hi"], f["primary"], f["primary_dk"])
        draw_iso_box(d, cx - 6, cy - 6, 16, 12, 10, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.85))
        # smokestack
        d.rectangle([cx + 8, cy - 36, cx + 14, cy - 14], fill=(*f["metal_dk"], 255))
        d.ellipse([cx + 6, cy - 40, cx + 16, cy - 34], fill=(*PAL["smoke"], 200))
    elif btype in ("dummy_base", "dummy_cover"):
        draw_iso_box(d, cx, cy, 28, 18, 10, shade(f["primary"], 0.7), shade(f["primary_dk"], 0.8), shade(f["primary_dk"], 0.6))
        # "fake" X mark
        d.line([(cx - 8, cy - 16), (cx + 8, cy - 4)], fill=(*f["trim"], 180), width=2)
        d.line([(cx + 8, cy - 16), (cx - 8, cy - 4)], fill=(*f["trim"], 180), width=2)
    elif btype == "icbm_silo":
        draw_iso_box(d, cx, cy, 36, 24, 10, f["metal"], f["metal_dk"], shade(f["metal_dk"], 0.8))
        # silo doors
        d.ellipse([cx - 14, cy - 18, cx + 14, cy + 2], fill=(*f["metal_dk"], 255))
        d.line([(cx, cy - 18), (cx, cy + 2)], fill=(*f["trim"], 255), width=2)
        # missile tip peeking
        d.polygon([(cx - 4, cy - 18), (cx + 4, cy - 18), (cx, cy - 36)], fill=(*f["trim"], 255))
        draw_flag(d, cx + 16, cy - 14, f["accent"])
    else:
        draw_iso_box(d, cx, cy, 28, 18, 14, f["primary_hi"], f["primary"], f["primary_dk"])


def damage_overlay(im: Image.Image):
    d = ImageDraw.Draw(im)
    w, h = im.size
    # scorch patches
    for _ in range(5):
        x, y = random.randint(8, w - 12), random.randint(8, h - 12)
        d.ellipse([x, y, x + 10, y + 8], fill=(30, 25, 20, 140))
    # cracks
    d.line([(12, h // 2), (20, h // 2 + 8), (28, h // 2 + 2)], fill=(20, 20, 20, 200), width=1)
    # fire glow corner
    d.ellipse([w - 22, 8, w - 8, 20], fill=(255, 120, 40, 160))


def construction_frame(im: Image.Image, h: int):
    d = ImageDraw.Draw(im)
    cx, cy = 32, h - 10
    # scaffold wireframe only - clear readable
    col = (100, 180, 220, 220)
    draw_pad(d, cx, cy + 2)
    # diamond scaffold
    pts = [(cx, cy - 36), (cx + 18, cy - 18), (cx, cy), (cx - 18, cy - 18)]
    d.line(pts + [pts[0]], fill=col, width=2)
    d.line([(cx, cy - 36), (cx, cy)], fill=col, width=1)
    d.line([(cx - 18, cy - 18), (cx + 18, cy - 18)], fill=col, width=1)
    # corner nodes
    for p in pts:
        d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=(200, 240, 255, 255))


def disabled_frame(im: Image.Image, owner: str, h: int):
    # darkened idle-like + EMP bolts
    draw_building_idle(im, "supply_depot", owner, h)  # placeholder overwritten by caller
    pass


def make_building_cell(btype: str, owner: str, state: str, h: int) -> Image.Image:
    im = new_rgba(64, h)
    if state == "construction":
        construction_frame(im, h)
        return im
    draw_building_idle(im, btype, owner, h)
    if state == "damaged":
        damage_overlay(im)
    if state == "disabled":
        # blue EMP wash
        overlay = new_rgba(64, h)
        d = ImageDraw.Draw(overlay)
        d.rectangle([0, 0, 63, h - 1], fill=(30, 180, 220, 70))
        # lightning
        d.line([(20, 10), (28, 28), (22, 32), (34, 50)], fill=(150, 240, 255, 220), width=2)
        im = Image.alpha_composite(im, overlay)
    return im


def build_buildings(owner: str) -> Image.Image:
    sheet = new_rgba(256, 1376)
    states = ["idle", "damaged", "construction", "disabled"]
    for btype, y, h in BUILDING_ROWS:
        for si, st in enumerate(states):
            cell = make_building_cell(btype, owner, st, h)
            sheet.paste(cell, (si * 64, y), cell)
    return sheet


# ---------- UNITS (mechs) ----------
def draw_mech(im: Image.Image, owner: str, pose: str):
    d = ImageDraw.Draw(im)
    f = faction_colors(owner)
    # canvas 40x48, ground near bottom
    cx, cy = 20, 40

    # shadow
    d.ellipse([cx - 10, cy - 2, cx + 10, cy + 5], fill=(0, 0, 0, 90))

    # legs
    leg_spread = 6 if pose in ("idle", "fighting", "fighting2", "dead") else 10
    leg_bend = 0 if pose != "walking2" else 3
    if pose == "dead":
        # collapsed
        d.ellipse([cx - 12, cy - 8, cx + 12, cy + 4], fill=(*f["primary_dk"], 255))
        d.rectangle([cx - 8, cy - 14, cx + 8, cy - 4], fill=(*f["primary"], 255))
        return

    # left leg
    d.polygon(
        [(cx - leg_spread, cy), (cx - leg_spread + 4, cy), (cx - 4, cy - 14 + leg_bend), (cx - 8, cy - 14)],
        fill=(*f["primary_dk"], 255),
    )
    # right leg
    d.polygon(
        [(cx + leg_spread - 4, cy), (cx + leg_spread, cy), (cx + 8, cy - 14), (cx + 4, cy - 14 - leg_bend)],
        fill=(*f["primary"], 255),
    )

    # torso
    torso_y = cy - 28
    if pose == "boarding":
        torso_y = cy - 22
    d.rounded_rectangle([cx - 10, torso_y, cx + 10, torso_y + 16], radius=2, fill=(*f["primary_hi"], 255))
    # cockpit
    cockpit = f["accent"] if owner == "player" else f["trim"]
    d.rectangle([cx - 5, torso_y + 3, cx + 5, torso_y + 9], fill=(*cockpit, 255))
    # trim stripe
    d.rectangle([cx - 10, torso_y + 11, cx + 10, torso_y + 13], fill=(*f["trim"], 255))

    # arms / gun
    if pose in ("fighting", "fighting2"):
        # gun extended
        d.rectangle([cx + 8, torso_y + 4, cx + 18, torso_y + 8], fill=(*f["metal_hi"], 255))
        d.rectangle([cx + 16, torso_y + 3, cx + 22, torso_y + 9], fill=(*f["metal_dk"], 255))
        if pose == "fighting2":
            d.ellipse([cx + 20, torso_y + 2, cx + 26, torso_y + 8], fill=(255, 200, 80, 220))
    else:
        d.rectangle([cx + 8, torso_y + 6, cx + 14, torso_y + 12], fill=(*f["metal"], 255))
        d.rectangle([cx - 14, torso_y + 6, cx - 8, torso_y + 12], fill=(*f["metal_dk"], 255))

    # head antenna
    d.rectangle([cx - 1, torso_y - 5, cx + 1, torso_y], fill=(*f["metal_hi"], 255))
    d.ellipse([cx - 2, torso_y - 7, cx + 2, torso_y - 3], fill=(*f["trim"], 255))


def build_units() -> Image.Image:
    # 280x96: 7 frames * 40 width, 2 rows * 48 height
    sheet = new_rgba(280, 96)
    poses = ["idle", "walking", "walking2", "fighting", "fighting2", "boarding", "dead"]
    for oi, owner in enumerate(["player", "enemy"]):
        for pi, pose in enumerate(poses):
            cell = new_rgba(40, 48)
            draw_mech(cell, owner, pose)
            sheet.paste(cell, (pi * 40, oi * 48), cell)
    return sheet


# ---------- FX boost (simple but punchier) ----------
def build_fx() -> Image.Image:
    # Keep layout of existing if possible - check size 512x192
    # We'll make a clean explosion strip + smoke
    sheet = new_rgba(512, 192)
    d = ImageDraw.Draw(sheet)
    # row of explosion frames 64x64
    colors = [
        [(255, 255, 200), (255, 180, 40), (220, 60, 20)],
        [(255, 240, 160), (255, 140, 30), (180, 40, 10)],
        [(255, 200, 100), (240, 100, 20), (120, 30, 10)],
        [(200, 200, 200), (120, 120, 120), (60, 60, 60)],
        [(160, 160, 160), (90, 90, 90), (40, 40, 40)],
        [(100, 100, 100), (50, 50, 50), (20, 20, 20)],
    ]
    for i, cols in enumerate(colors):
        cx, cy = 32 + i * 64, 32
        for j, c in enumerate(cols):
            r = 22 - j * 6 + (i % 2) * 2
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*c, 220 - j * 40))
    # muzzle flashes row2
    for i in range(4):
        cx, cy = 32 + i * 64, 96
        d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 200, 230))
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 200, 80, 255))
        for a in range(0, 360, 45):
            rad = math.radians(a)
            d.line([(cx, cy), (cx + math.cos(rad) * 16, cy + math.sin(rad) * 16)], fill=(255, 220, 120, 180), width=2)
    # selection rings
    for i, col in enumerate([(80, 220, 120), (220, 80, 80), (240, 180, 40)]):
        cx, cy = 32 + i * 64, 160
        d.ellipse([cx - 18, cy - 10, cx + 18, cy + 10], outline=(*col, 255), width=2)
        d.ellipse([cx - 14, cy - 7, cx + 14, cy + 7], outline=(*col, 160), width=1)
    return sheet


def build_projectiles() -> Image.Image:
    sheet = new_rgba(188, 56)
    d = ImageDraw.Draw(sheet)
    # missiles
    for i, col in enumerate([(240, 220, 80), (255, 100, 80), (100, 220, 255), (200, 200, 200)]):
        x = 8 + i * 46
        d.polygon([(x, 20), (x + 28, 14), (x + 28, 26)], fill=(*col, 255))
        d.rectangle([x + 8, 16, x + 24, 24], fill=(*shade(col, 0.7), 255))
        d.ellipse([x + 24, 15, x + 32, 25], fill=(255, 180, 60, 220))
    return sheet


def write_style_bible():
    DOCS.mkdir(parents=True, exist_ok=True)
    text = """# Metal Marines 2026 — Style Bible (Sprint 0)

**Goal:** Beat the 1993 Win3.1 original on **clarity**. Deliberate remaster, not AAA trailer bait.

## Camera & grid
- Top-down grid, `TILE_PX = 64` (unchanged)
- Buildings drawn as **fake-isometric** sprites on rectangular cells
- Anchor: buildings `anchorY ≈ 0.75`, mechs `≈ 0.85` (feet on tile)

## Palette
| Role | Hex-ish | Notes |
|------|---------|-------|
| Grass | deep/mid/hi greens | Classic MM island — brighter than pre-remaster sludge |
| Water | deep teal → cyan foam | High contrast vs land |
| Player structures | olive drab + **red** trim/flags + white accents | Military MM, not neon sci-fi |
| Enemy structures | purple mass + **gold** trim | Readable faction at combat zoom |
| Metal | cool gray hierarchy | Edges catch light |

## Silhouette rules
1. Every building must read as a **unique roof/mass shape** at 64px
2. Mechs: torso + legs + gun — no mud, no black-on-black
3. No photographic texture noise; soft dither OK
4. Transparent backgrounds only
5. Construction = cyan wire scaffold (not muddy half-meshes)
6. Damaged = scorch + fire wink; Disabled = EMP cyan wash

## North star references
- OG Win3.1 screenshots in `Game-art/Metal-marines-original/`
- Identity: player disciplined reds, enemy gold/purple
- **Not** the README marketing hero (aspirational mockup)

## Definition of done (portfolio gate)
A real in-game capture where:
- Islands read green and dense
- Bases look built (pads + chunky structures)
- Mechs readable while walking
- Side-by-side with OG does not embarrass the remaster

Generated assets: `public/game-assets/{terrain,buildings-*,units,fx,projectiles}.png`
"""
    (DOCS / "STYLE_BIBLE.md").write_text(text, encoding="utf-8")
    print("wrote", DOCS / "STYLE_BIBLE.md")


def main():
    random.seed(2026)
    write_style_bible()
    OUT.mkdir(parents=True, exist_ok=True)

    terrain = build_terrain()
    terrain.save(OUT / "terrain.png")
    print("terrain", terrain.size)

    bp = build_buildings("player")
    bp.save(OUT / "buildings-player.png")
    print("buildings-player", bp.size)

    be = build_buildings("enemy")
    be.save(OUT / "buildings-enemy.png")
    print("buildings-enemy", be.size)

    units = build_units()
    units.save(OUT / "units.png")
    print("units", units.size)

    fx = build_fx()
    fx.save(OUT / "fx.png")
    print("fx", fx.size)

    proj = build_projectiles()
    proj.save(OUT / "projectiles.png")
    print("projectiles", proj.size)

    # preview strip for QA
    preview = Image.new("RGBA", (640, 400), (15, 20, 30, 255))
    preview.paste(terrain, (8, 8))
    preview.paste(units, (8, 88), units)
    # sample HQ idle player
    hq = bp.crop((0, 0, 64, 80))
    preview.paste(hq, (8, 200), hq)
    ms = bp.crop((0, 80, 64, 144))
    preview.paste(ms, (80, 216), ms)
    en = bp.crop((0, 144, 64, 208))
    preview.paste(en, (152, 216), en)
    hq_e = be.crop((0, 0, 64, 80))
    preview.paste(hq_e, (224, 200), hq_e)
    preview_path = OUT.parent.parent.parent / "docs" / "remaster-preview.png"
    # docs is under repo
    preview_path = Path(
        r"C:\Users\marti_km5l3j5\AppData\Local\Temp\mm-remaster\Metal-Marines-Reborn\docs\remaster-preview.png"
    )
    preview.save(preview_path)
    print("preview", preview_path)


if __name__ == "__main__":
    main()
