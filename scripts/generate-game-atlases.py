#!/usr/bin/env python3
"""Generate Metal Marines sprite atlases for public/game-assets/.

Hot-swappable atlases matching manifests/core.json frame layout.
Art direction from Game-art identity board:
  Player = olive drab / gunmetal + red & white markings (disciplined)
  Enemy  = charcoal / bronze + purple glow (brutal)

Hero overlays in public/game-assets/heroes/ (HF + Cursor image gen).
Also writes build-palette icons under public/game-assets/icons/.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

# Building atlas row labels -> hero stem (player). Enemy derived via recolor.
HERO_BUILDINGS = {
    "HQ": "hq-player",
    "ENERGY": "energy-player",
    "RADAR": "radar-player",
    "MISSILE": "missile-player",
    "ICBM": "missile-player",
    "TURRET": "turret-player",
    "GUNPOD": "gunpod-player",
    "AA": "aa-player",
    "FACTORY": "factory-player",
    "SUPPLY": "supply-player",
    "MECHBAY": "factory-player",
    "JAMMER": "jammer-player",
    "TUNNEL": "tunnel-player",
    "SEISMIC": "seismic-player",
    "DESTAB": "destab-player",
    "WEATHER": "weather-player",
    "BIO": "biosphere-player",
    "EMP": "emp-player",
    "DUMMY": "dummy-player",
    "DUMMYCOVER": "dummy-player",
}

# icons exported for BuildPalette (BuildingType -> atlas label)
ICON_EXPORT = {
    "HQ": "HQ",
    "ENERGY_PLANT": "ENERGY",
    "SUPPLY_DEPOT": "SUPPLY",
    "FACTORY": "FACTORY",
    "RADAR": "RADAR",
    "MISSILE_LAUNCHER": "MISSILE",
    "ICBM_SILO": "ICBM",
    "AA_GUN": "AA",
    "GUN_TURRET": "TURRET",
    "GUN_POD": "GUNPOD",
    "METAL_MARINE_BASE": "MECHBAY",
    "EMP_CANNON": "EMP",
    "RADAR_JAMMER": "JAMMER",
    "DUMMY_BASE": "DUMMY",
    "DUMMY_COVER": "DUMMYCOVER",
    "LAND_MINE": "MINE",
    "TUNNEL_ENTRANCE": "TUNNEL",
    "SEISMIC_SENSOR": "SEISMIC",
    "TERRAIN_DESTABILIZER": "DESTAB",
    "WEATHER_CONTROL": "WEATHER",
    "BIOSPHERE_ENGINE": "BIO",
}

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/metal-marines/public/game-assets"
HERO_DIR = Path(
    os.environ.get(
        "MM_HERO_DIR",
        str(ROOT / "artifacts/metal-marines/public/game-assets/heroes"),
    )
)
OUT.mkdir(parents=True, exist_ok=True)

PLAYER = {
    "olive": (74, 84, 48, 255),
    "olive_lit": (110, 122, 72, 255),
    "metal": (55, 62, 70, 255),
    "metal_lit": (90, 98, 108, 255),
    "primary": (196, 40, 40, 255),
    "secondary": (245, 245, 240, 255),
    "trim": (28, 32, 28, 255),
    "dark": (22, 26, 22, 255),
    "glow": (255, 90, 90, 200),
    "glass": (160, 200, 210, 220),
    "hazard_a": (245, 245, 240, 255),
    "hazard_b": (20, 20, 20, 255),
}
ENEMY = {
    "olive": (42, 36, 40, 255),
    "olive_lit": (70, 55, 48, 255),
    "metal": (48, 40, 52, 255),
    "metal_lit": (90, 70, 55, 255),
    "primary": (168, 85, 247, 255),
    "secondary": (217, 140, 60, 255),
    "trim": (18, 12, 22, 255),
    "dark": (16, 10, 18, 255),
    "glow": (192, 132, 252, 210),
    "glass": (120, 60, 160, 220),
    "hazard_a": (217, 140, 60, 255),
    "hazard_b": (40, 20, 50, 255),
}


def new_rgba(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def shade(c, f: float):
    return tuple(max(0, min(255, int(ch * f))) for ch in c[:3]) + (c[3] if len(c) > 3 else 255,)


def mix(a, b, t: float):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (a[3] if len(a) > 3 else 255,)


def draw_iso_diamond(draw: ImageDraw.ImageDraw, cx, cy, w, h, fill, outline=None):
    pts = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(pts, fill=fill, outline=outline)


def draw_iso_box(d: ImageDraw.ImageDraw, cx, cy, tw, th, elev, left, right, top, outline=None):
    """Simple isometric box: tw/th = top diamond size, elev = wall height."""
    top_pts = [
        (cx, cy - th // 2 - elev),
        (cx + tw // 2, cy - elev),
        (cx, cy + th // 2 - elev),
        (cx - tw // 2, cy - elev),
    ]
    left_pts = [
        (cx - tw // 2, cy - elev),
        (cx, cy + th // 2 - elev),
        (cx, cy + th // 2),
        (cx - tw // 2, cy),
    ]
    right_pts = [
        (cx + tw // 2, cy - elev),
        (cx, cy + th // 2 - elev),
        (cx, cy + th // 2),
        (cx + tw // 2, cy),
    ]
    d.polygon(left_pts, fill=left, outline=outline)
    d.polygon(right_pts, fill=right, outline=outline)
    d.polygon(top_pts, fill=top, outline=outline)


def hazard_strip(d, x0, y0, x1, y1, pal, step=4):
    for i, x in enumerate(range(x0, x1, step)):
        col = pal["hazard_a"] if i % 2 == 0 else pal["hazard_b"]
        d.rectangle([x, y0, min(x + step - 1, x1), y1], fill=col)


def remove_near_bg(im: Image.Image, tol: int = 42) -> Image.Image:
    """Knock out flat studio grey / green-screen-ish backdrops from hero renders."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    samples = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3], px[w // 2, 2], px[w // 4, 2]]
    br, bg, bb = [sum(s[i] for s in samples) // len(samples) for i in range(3)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - br) < tol and abs(g - bg) < tol and abs(b - bb) < tol:
                px[x, y] = (r, g, b, 0)
            elif abs(r - g) < 14 and abs(g - b) < 14 and 70 < r < 220:
                if abs(r - br) < tol + 30:
                    px[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def fit_rgba(src: Image.Image, tw: int, th: int, pad: int = 1) -> Image.Image:
    src = src.convert("RGBA")
    src.thumbnail((tw - pad * 2, th - pad * 2), Image.Resampling.LANCZOS)
    out = new_rgba(tw, th)
    ox = (tw - src.width) // 2
    oy = th - src.height - pad
    out.paste(src, (ox, oy), src)
    return out


def to_enemy_faction(im: Image.Image) -> Image.Image:
    """Recolor olive/red player art toward charcoal / bronze / purple enemy identity."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            # crush greens, push purple/bronze
            nr = min(255, int(r * 0.55 + b * 0.15 + 35))
            ng = min(255, int(g * 0.35 + r * 0.1 + 18))
            nb = min(255, int(b * 0.45 + r * 0.25 + 55))
            # keep bright red accents as gold/purple highlights
            if r > 140 and r > g + 40 and r > b + 40:
                nr, ng, nb = 196, 120, 255
            px[x, y] = (nr, ng, nb, a)
    return im


def load_hero(name: str) -> Image.Image | None:
    # Prefer PNG (Cursor gens), then webp (HF).
    for ext in (".png", ".webp", ".jpg"):
        p = HERO_DIR / f"{name}{ext}"
        if p.exists():
            return remove_near_bg(Image.open(p))
    return None


def paint_tree_canopy(cd: ImageDraw.ImageDraw, cx: int, cy: int, r: int, lit: bool = True):
    """One top-down tree: dark rim + solid crown + top-left highlight.

    Sized for 64px combat tiles so clumps read as trees, not soft green blobs.
    """
    shadow = (6, 22, 12, 255)
    deep = (16, 58, 30, 255)
    mid = (32, 108, 52, 255)
    hi = (78, 164, 82, 255) if lit else (52, 130, 60, 255)
    tip = (130, 200, 105, 240) if lit else (88, 156, 78, 220)
    trunk = (70, 50, 32, 200)

    # ground shadow + short trunk stub under the crown
    cd.ellipse(
        [cx - r + 2, cy + max(2, r // 3), cx + r - 2, cy + r // 2 + 4],
        fill=(4, 14, 8, 170),
    )
    if r >= 8:
        cd.rectangle([cx - 1, cy + r // 5, cx + 1, cy + r // 2 + 1], fill=trunk)

    # hard outer silhouette so neighboring trees separate at combat zoom
    cd.ellipse([cx - r, cy - r + 1, cx + r, cy + r - 1], fill=shadow)
    cd.ellipse([cx - r + 1, cy - r + 2, cx + r - 1, cy + r - 3], fill=deep)

    # scalloped leaf mass around the rim (chunky, not ring/eyeball)
    lobes = 6 if r >= 9 else 5
    for i in range(lobes):
        ang = (i / lobes) * math.tau + 0.2
        lr = max(3, (r * 2) // 5)
        lx = int(cx + math.cos(ang) * (r * 0.62))
        ly = int(cy + math.sin(ang) * (r * 0.55))
        cd.ellipse([lx - lr, ly - lr, lx + lr, ly + lr], fill=mid if i % 2 == 0 else deep)

    # solid crown fill so the center isn't a hole
    cd.ellipse([cx - r + 2, cy - r + 3, cx + r - 2, cy + r - 4], fill=mid)
    # top-left light (classic MM read)
    cd.ellipse(
        [cx - r + 3, cy - r + 3, cx + max(2, r // 3), cy + max(1, r // 5)],
        fill=hi,
    )
    cd.ellipse(
        [cx - r // 2, cy - r + 4, cx - 1, cy - r // 3],
        fill=tip,
    )
    # a couple leaf flecks for texture without breaking the silhouette
    cd.point((cx + 1, cy - 1), fill=tip)
    cd.point((cx - 2, cy + 1), fill=deep)


def paint_forest_tile(cell: Image.Image, understory: Image.Image | None = None):
    """Dense canopy forest tile readable at combat zoom (64px)."""
    cd = ImageDraw.Draw(cell)
    # deep understory bed
    for y in range(64):
        t = y / 63
        c = mix((12, 36, 20, 255), (22, 58, 30, 255), t)
        cd.line([(0, y), (63, y)], fill=c)

    # optional hero texture: crush into dark undergrowth, never the sole silhouette
    if understory is not None:
        u = understory.convert("RGBA").resize((64, 64), Image.Resampling.LANCZOS)
        upx = u.load()
        for y in range(64):
            for x in range(64):
                r, g, b, a = upx[x, y]
                if a < 20:
                    continue
                # keep greens, darken hard so procedural crowns carry the read
                nr = max(0, int(r * 0.25 + 8))
                ng = max(0, int(g * 0.35 + 14))
                nb = max(0, int(b * 0.22 + 8))
                upx[x, y] = (nr, ng, nb, min(a, 110))
        cell.alpha_composite(u)

    # brush / fern undergrowth between trunks
    for i in range(28):
        bx = (i * 11 + 3) % 60 + 2
        by = (i * 17 + 7) % 58 + 3
        cd.ellipse([bx, by, bx + 3, by + 2], fill=(20, 72, 34, 200))
        if i % 4 == 0:
            cd.line([(bx + 1, by + 1), (bx + 1, by - 3)], fill=(36, 96, 44, 160))

    # Dense tree crowns — packed, slightly overlapping, clear silhouettes.
    # Order: back (top) to front (bottom) for simple depth.
    trees = [
        (10, 14, 9, True),
        (28, 10, 10, True),
        (46, 13, 9, False),
        (16, 26, 11, True),
        (36, 24, 12, True),
        (52, 28, 10, True),
        (8, 38, 10, False),
        (24, 40, 11, True),
        (42, 38, 12, True),
        (56, 42, 9, False),
        (14, 52, 10, True),
        (32, 54, 11, True),
        (48, 52, 10, True),
        (4, 22, 7, False),
        (58, 18, 7, True),
        (20, 18, 8, False),
    ]
    for cx, cy, r, lit in trees:
        paint_tree_canopy(cd, cx, cy, r, lit)

    # sparse litter / needles so the floor isn't a flat void in gaps
    for i in range(18):
        lx = (i * 13 + 5) % 62
        ly = (i * 19 + 9) % 62
        cd.point((lx, ly), fill=(90, 110, 50, 140))


def paint_terrain_cell(img: Image.Image, x0: int, y0: int, kind: str, pavement: Image.Image | None):
    cell = new_rgba(64, 64)
    cd = ImageDraw.Draw(cell)
    if kind == "grass":
        # Classic Metal Marines: green island turf. Building pads are drawn in-renderer.
        for y in range(64):
            t = y / 63
            c = mix((48, 102, 52, 255), (86, 140, 68, 255), 1 - t * 0.4)
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(90):
            gx = (i * 17 + 5) % 60 + 2
            gy = (i * 23 + 9) % 58 + 3
            cd.point((gx, gy), fill=(120, 180, 85, 150))
            if i % 6 == 0:
                cd.line([(gx, gy), (gx, gy - 2)], fill=(95, 160, 70, 140))
        # soft dirt flecks
        for i in range(12):
            dx = (i * 13 + 8) % 56 + 4
            dy = (i * 19 + 11) % 52 + 6
            cd.point((dx, dy), fill=(110, 95, 55, 90))
        cd.rectangle([0, 0, 63, 63], outline=(20, 50, 28, 80))
    elif kind == "forest":
        paint_forest_tile(cell)
    elif kind == "mountain":
        for y in range(64):
            cd.line([(0, y), (63, y)], fill=mix((70, 75, 85, 255), (110, 115, 125, 255), y / 63))
        cd.polygon([(6, 58), (26, 12), (46, 58)], fill=(130, 140, 155, 255))
        cd.polygon([(22, 58), (42, 8), (60, 58)], fill=(95, 105, 120, 255))
        cd.polygon([(34, 16), (42, 8), (40, 26)], fill=(235, 240, 245, 230))
        cd.line([(26, 12), (34, 40)], fill=(80, 85, 95, 180), width=1)
    elif kind == "water":
        for y in range(64):
            wave = math.sin(y / 5.5 + 0.4) * 10
            c = (
                int(8 + wave * 0.3),
                int(55 + y * 0.45 + wave * 0.4),
                int(120 + y * 0.55),
                255,
            )
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(7):
            yy = 8 + i * 8
            cd.arc([3, yy, 60, yy + 12], 200, 340, fill=(140, 220, 255, 140), width=1)
        # shoreline foam dots
        for i in range(10):
            cd.point(((i * 7 + 2) % 62, 4 + (i % 3)), fill=(200, 240, 255, 160))
    elif kind == "toxic":
        for y in range(64):
            c = (
                int(50 + math.sin(y / 3) * 20),
                int(170 - y * 0.5),
                int(40 + math.cos(y / 4) * 15),
                255,
            )
            cd.line([(0, y), (63, y)], fill=c)
        for i in range(14):
            cx = (i * 11) % 54 + 4
            cy = (i * 17) % 50 + 6
            cd.ellipse([cx, cy, cx + 7, cy + 5], fill=(210, 250, 90, 170))
    cd.rectangle([0, 0, 63, 63], outline=(10, 16, 30, 70))
    img.paste(cell, (x0, y0), cell)


def slice_terrain_sheet() -> dict[str, Image.Image] | None:
    """Extract grass/forest/mountain/water from heroes/terrain-sheet.png if present."""
    sheet = None
    for ext in (".png", ".webp"):
        p = HERO_DIR / f"terrain-sheet{ext}"
        if p.exists():
            sheet = Image.open(p).convert("RGBA")
            break
    if sheet is None:
        return None
    w, h = sheet.size
    # Four tiles in a horizontal strip, roughly centered vertically.
    cell_w = w // 4
    y0 = int(h * 0.18)
    y1 = int(h * 0.82)
    keys = ["grass", "forest", "mountain", "water"]
    out: dict[str, Image.Image] = {}
    for i, key in enumerate(keys):
        crop = sheet.crop((i * cell_w + 8, y0, (i + 1) * cell_w - 8, y1))
        # knock near-black backdrop
        px = crop.load()
        cw, ch = crop.size
        for y in range(ch):
            for x in range(cw):
                r, g, b, a = px[x, y]
                if r < 28 and g < 28 and b < 28:
                    px[x, y] = (0, 0, 0, 0)
        bbox = crop.getbbox()
        if bbox:
            crop = crop.crop(bbox)
        out[key] = fit_rgba(crop, 64, 64, pad=0)
    return out


def make_terrain(pavement: Image.Image | None):
    img = new_rgba(64 * 5, 64)
    sliced = slice_terrain_sheet()
    kinds = ["grass", "forest", "mountain", "water", "toxic"]
    for i, kind in enumerate(kinds):
        # Forest: always stamp combat-readable canopy clumps. Hero slice (if any)
        # is crushed into understory texture so downscaled AI art doesn't blob out.
        if kind == "forest":
            cell = new_rgba(64, 64)
            paint_forest_tile(cell, understory=sliced.get("forest") if sliced else None)
            cd = ImageDraw.Draw(cell)
            cd.rectangle([0, 0, 63, 63], outline=(10, 16, 30, 70))
            img.paste(cell, (i * 64, 0), cell)
            continue
        if sliced and kind in sliced:
            fills = {
                "grass": (56, 118, 58, 255),
                "mountain": (90, 96, 108, 255),
                "water": (18, 70, 130, 255),
            }
            fill = fills.get(kind, (40, 40, 40, 255))
            bg = Image.new("RGBA", (64, 64), fill)
            bg.paste(sliced[kind], (0, 0), sliced[kind])
            flat = Image.alpha_composite(Image.new("RGBA", (64, 64), fill), bg)
            img.paste(flat, (i * 64, 0))
        else:
            paint_terrain_cell(img, i * 64, 0, kind, pavement)
    # toxic always procedural
    if sliced:
        paint_terrain_cell(img, 4 * 64, 0, "toxic", pavement)
    img.save(OUT / "terrain.png", optimize=True)
    print("Terrain sheet slices:", list(sliced.keys()) if sliced else "procedural-only")
    print("Forest: procedural canopy clumps (hero understory blended when present)")


def building_block(palette, label: str, state: str, w=64, h=64, faction="player") -> Image.Image:
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)
    cx, base = w // 2, int(h * 0.78)
    jagged = faction == "enemy"

    # ground pad
    draw_iso_diamond(d, cx, base + 2, w - 8, 20, shade(palette["dark"], 0.85), palette["trim"])
    hazard_strip(d, cx - 18, base - 1, cx + 18, base + 2, palette, 3)

    elev = 22 if h <= 64 else 34
    tw, th = 36, 20
    left = shade(palette["olive"], 0.75 if state != "damaged" else 0.5)
    right = shade(palette["metal"], 0.9 if state != "damaged" else 0.55)
    top = palette["olive_lit"] if state != "disabled" else shade(palette["metal"], 0.55)
    if state == "construction":
        left = (*palette["metal"][:3], 150)
        right = (*palette["metal_lit"][:3], 150)
        top = (*palette["secondary"][:3], 140)

    if label == "HQ":
        tw, th, elev = 44, 24, elev + 4
        draw_iso_box(d, cx, base - 4, tw, th, elev, left, right, top, palette["trim"])
        # banners
        for sx in (-18, 18):
            d.line([(cx + sx, base - elev - 18), (cx + sx, base - elev - 2)], fill=palette["trim"], width=1)
            flag = palette["primary"] if not jagged else palette["glow"]
            d.polygon(
                [(cx + sx, base - elev - 18), (cx + sx + 8, base - elev - 14), (cx + sx, base - elev - 10)],
                fill=flag,
            )
        # command windows
        d.rectangle([cx - 6, base - elev - 8, cx + 6, base - elev + 2], fill=palette["glass"])
        if jagged:
            for sx in (-14, 0, 14):
                d.polygon(
                    [(cx + sx, base - elev - 22), (cx + sx + 4, base - elev - 10), (cx + sx - 4, base - elev - 10)],
                    fill=palette["secondary"],
                )
    elif label == "ENERGY":
        draw_iso_box(d, cx, base - 2, 30, 16, 16, left, right, top, palette["trim"])
        d.ellipse([cx - 12, base - 28, cx + 12, base - 6], outline=palette["glow"], width=2)
        d.ellipse([cx - 7, base - 24, cx + 7, base - 10], fill=palette["glass"])
        d.line([(cx, base - 30), (cx, base - 36)], fill=palette["secondary"], width=2)
    elif label in ("MISSILE", "ICBM"):
        draw_iso_box(d, cx, base - 2, 28, 14, 12, left, right, top, palette["trim"])
        silo_h = 36 if label == "ICBM" else 26
        d.rectangle([cx - 5, base - silo_h - 4, cx + 5, base - 6], fill=palette["metal_lit"], outline=palette["trim"])
        d.ellipse([cx - 7, base - silo_h - 12, cx + 7, base - silo_h + 2], fill=palette["secondary"])
        d.ellipse([cx - 3, base - silo_h - 10, cx + 3, base - silo_h - 4], fill=palette["glow"])
    elif label == "RADAR":
        draw_iso_box(d, cx, base - 2, 24, 14, 10, left, right, top, palette["trim"])
        d.line([(cx, base - 14), (cx, base - 40)], fill=palette["metal_lit"], width=2)
        if jagged:
            d.ellipse([cx - 12, base - 48, cx + 12, base - 28], fill=palette["glow"])
        else:
            d.arc([cx - 14, base - 48, cx + 14, base - 26], 200, 340, fill=palette["secondary"], width=3)
            d.ellipse([cx - 3, base - 38, cx + 3, base - 32], fill=palette["primary"])
    elif label in ("AA", "TURRET", "GUNPOD"):
        draw_iso_box(d, cx, base - 2, 28, 16, 10, left, right, top, palette["trim"])
        d.ellipse([cx - 12, base - 22, cx + 12, base - 6], fill=shade(palette["metal"], 1.1), outline=palette["trim"])
        barrel = palette["secondary"] if not jagged else palette["glow"]
        d.rectangle([cx - 2, base - 36, cx + 2, base - 18], fill=barrel)
        if label != "GUNPOD":
            d.rectangle([cx + 4, base - 32, cx + 8, base - 18], fill=barrel)
        if jagged:
            d.polygon([(cx - 14, base - 14), (cx - 18, base - 22), (cx - 8, base - 18)], fill=palette["secondary"])
    elif label == "FACTORY":
        draw_iso_box(d, cx, base - 2, 40, 20, 18, left, right, top, palette["trim"])
        for i in range(3):
            d.rectangle([cx - 14 + i * 10, base - 16, cx - 8 + i * 10, base - 6], fill=palette["dark"])
        d.rectangle([cx - 10, base - 28, cx + 10, base - 20], fill=palette["glass"])
    elif label == "MECHBAY":
        draw_iso_box(d, cx, base - 2, 38, 20, 16, left, right, top, palette["trim"])
        d.polygon([(cx - 12, base - 6), (cx, base - 28), (cx + 12, base - 6)], fill=palette["glow"])
        d.rectangle([cx - 14, base - 12, cx + 14, base - 4], fill=shade(palette["dark"], 1.1))
    elif label in ("DUMMY", "DUMMYCOVER"):
        draw_iso_box(d, cx, base - 2, 34, 18, 14, (*top[:3], 100), (*right[:3], 100), (*left[:3], 100), palette["secondary"])
        d.line([(cx - 12, base - 24), (cx + 12, base - 6)], fill=palette["secondary"], width=2)
        d.line([(cx + 12, base - 24), (cx - 12, base - 6)], fill=palette["secondary"], width=2)
    elif label == "SUPPLY":
        draw_iso_box(d, cx, base - 2, 34, 18, 14, left, right, top, palette["trim"])
        for i in range(2):
            d.rectangle([cx - 12, base - 20 + i * 6, cx + 12, base - 16 + i * 6], fill=palette["secondary"])
    elif label == "MINE":
        d.ellipse([cx - 14, base - 10, cx + 14, base + 4], fill=shade(palette["trim"], 0.9), outline=palette["primary"])
        d.ellipse([cx - 5, base - 6, cx + 5, base], fill=palette["glow"])
    else:
        # generic systems building
        draw_iso_box(d, cx, base - 2, 32, 18, 16, left, right, top, palette["trim"])
        d.ellipse([cx - 10, base - 28, cx + 10, base - 10], fill=palette["glass"], outline=palette["glow"])
        if jagged:
            d.polygon([(cx, base - 34), (cx + 5, base - 26), (cx - 5, base - 26)], fill=palette["secondary"])

    if state == "construction":
        d.line([(cx - 20, base - elev - 4), (cx + 20, base + 2)], fill=(120, 200, 255, 200), width=2)
    if state == "damaged":
        d.line([(cx - 12, base - elev), (cx + 10, base - 4)], fill=(15, 15, 20, 230), width=2)
        d.line([(cx + 8, base - elev + 4), (cx - 8, base - 2)], fill=(40, 20, 20, 200), width=1)
        for _ in range(4):
            pass
        d.ellipse([cx + 6, base - 10, cx + 14, base - 4], fill=(40, 40, 40, 180))
    if state == "disabled":
        d.rectangle([cx - 8, base - elev // 2 - 6, cx + 8, base - elev // 2 + 2], fill=(80, 80, 90, 180))
    return img


BUILDING_ROWS = [
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


def tint_state(cell: Image.Image, state: str) -> Image.Image:
    if state == "idle":
        return cell
    out = cell.copy()
    if state == "damaged":
        out = ImageEnhance.Brightness(out).enhance(0.72)
        d = ImageDraw.Draw(out)
        d.line([(8, 12), (52, 50)], fill=(20, 20, 25, 200), width=2)
    elif state == "construction":
        out = ImageEnhance.Color(out).enhance(0.5)
        d = ImageDraw.Draw(out)
        d.line([(6, 10), (56, 54)], fill=(120, 200, 255, 180), width=2)
    elif state == "disabled":
        out = ImageEnhance.Brightness(out).enhance(0.55)
        out = ImageEnhance.Color(out).enhance(0.35)
    return out


def make_buildings(
    path: Path,
    palette,
    faction: str,
    heroes: dict[str, Image.Image],
    export_icons: bool = False,
):
    row_heights = [h for _, h in BUILDING_ROWS]
    width = 64 * 4
    height = sum(row_heights)
    img = new_rgba(width, height)
    idle_by_label: dict[str, Image.Image] = {}
    y = 0
    for (label, h), rh in zip(BUILDING_ROWS, row_heights):
        hero = heroes.get(label)
        for si, state in enumerate(STATES):
            if hero is not None:
                cell = tint_state(fit_rgba(hero, 64, h, pad=1), state)
            else:
                cell = building_block(palette, label, state, 64, h, faction=faction)
            if state == "idle":
                idle_by_label[label] = cell.copy()
            img.paste(cell, (si * 64, y), cell)
        y += rh
    img.save(path, optimize=True)

    if export_icons:
        icon_dir = OUT / "icons"
        icon_dir.mkdir(parents=True, exist_ok=True)
        for building_type, label in ICON_EXPORT.items():
            src = idle_by_label.get(label)
            if src is None:
                src = building_block(palette, label, "idle", 64, 64, faction=faction)
            icon = fit_rgba(src, 48, 48, pad=2)
            icon.save(icon_dir / f"{building_type}.png", optimize=True)


def mech_frame(palette, pose: str, jagged: bool = False) -> Image.Image:
    img = new_rgba(40, 48)
    d = ImageDraw.Draw(img)
    leg_off = 0
    if pose == "walking":
        leg_off = 4
    elif pose == "fighting":
        leg_off = -2
    # feet
    d.rectangle([10, 40 + max(0, leg_off), 18, 45 + max(0, leg_off)], fill=palette["metal"])
    d.rectangle([22, 40 - min(0, leg_off), 30, 45 - min(0, leg_off)], fill=palette["metal"])
    # legs
    d.rectangle([12, 28, 17, 42 + leg_off], fill=palette["olive"])
    d.rectangle([23, 28, 28, 42 - leg_off], fill=palette["olive"])
    d.line([(12, 34), (17, 34)], fill=palette["primary"], width=1)
    d.line([(23, 34), (28, 34)], fill=palette["primary"], width=1)
    # torso
    d.rectangle([10, 12, 30, 30], fill=palette["olive_lit"], outline=palette["trim"])
    d.rectangle([12, 14, 28, 18], fill=palette["primary"])
    d.rectangle([14, 20, 20, 26], fill=palette["secondary"])
    # head / sensor
    if jagged:
        d.polygon([(14, 12), (26, 12), (24, 4), (16, 4)], fill=palette["metal"])
        d.ellipse([17, 5, 23, 11], fill=palette["glow"])
    else:
        d.rectangle([15, 4, 25, 13], fill=palette["metal"], outline=palette["trim"])
        d.rectangle([17, 6, 23, 11], fill=palette["glass"])
    # arms / weapon
    if pose == "fighting":
        d.rectangle([28, 14, 38, 19], fill=palette["metal_lit"])
        d.ellipse([34, 12, 40, 20], fill=palette["glow"])
    else:
        d.rectangle([6, 16, 11, 26], fill=shade(palette["olive"], 0.85))
        d.rectangle([29, 16, 34, 26], fill=shade(palette["olive"], 0.85))
    if pose == "dead":
        d.line([(6, 8), (34, 40)], fill=(15, 15, 20, 230), width=2)
    if pose == "boarding":
        d.rectangle([8, 1, 32, 8], fill=palette["glow"])
    return img


def make_units(hero_player: Image.Image | None, hero_enemy: Image.Image | None):
    poses = ["idle", "walking", "fighting", "boarding", "dead"]
    img = new_rgba(40 * 5, 48 * 2)
    heroes = [hero_player, hero_enemy]
    pals = [PLAYER, ENEMY]
    for oi, (pal, hero) in enumerate(zip(pals, heroes)):
        for pi, pose in enumerate(poses):
            if hero is not None and pose == "idle":
                frame = fit_rgba(hero, 40, 48, pad=1)
            elif hero is not None and pose != "dead":
                frame = tint_state(fit_rgba(hero, 40, 48, pad=1), "damaged" if pose == "fighting" else "idle")
                if pose == "walking":
                    frame = frame.rotate(4 if oi == 0 else -4, resample=Image.Resampling.BICUBIC, expand=False)
            else:
                frame = mech_frame(pal, pose, jagged=(oi == 1))
            img.paste(frame, (pi * 40, oi * 48), frame)
    img.save(OUT / "units.png", optimize=True)


def make_projectiles():
    specs = [
        ("icbm", 24, 48, (245, 245, 240, 255)),
        ("emp", 32, 32, (120, 210, 255, 255)),
        ("transport_pod", 32, 24, (196, 40, 40, 255)),
        ("tunnel_buster", 24, 40, (250, 200, 60, 255)),
        ("dummy", 20, 36, (148, 163, 184, 255)),
        ("aa", 16, 28, (80, 200, 120, 255)),
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
                outline=(40, 40, 40, 255),
            )
            hazard_strip(d, x + 6, cy - 2, x + w - 6, cy + 2, PLAYER, 3)
        else:
            d.polygon(
                [
                    (x + w // 2, cy - h // 2 + 2),
                    (x + w - 2, cy + h // 2 - 4),
                    (x + w // 2, cy + h // 2 - 2),
                    (x + 2, cy + h // 2 - 4),
                ],
                fill=color,
                outline=(30, 30, 30, 255),
            )
            d.ellipse(
                [x + w // 2 - 3, cy - h // 2, x + w // 2 + 3, cy - h // 2 + 8],
                fill=(251, 146, 60, 255),
            )
        x += w
    img.save(OUT / "projectiles.png", optimize=True)


def make_fx():
    frame = 48
    cols = 8
    img = new_rgba(frame * cols, frame * 3)
    d = ImageDraw.Draw(img)
    for i in range(8):
        cx, cy = i * frame + 24, 24
        r = 5 + i * 3
        alpha = max(50, 230 - i * 24)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(251, 146, 60, alpha))
        d.ellipse([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2], fill=(254, 243, 199, alpha))
        if i > 1:
            for a in range(8):
                ang = a * math.pi / 4 + i * 0.1
                dx = int(math.cos(ang) * r)
                dy = int(math.sin(ang) * r)
                d.line([(cx, cy), (cx + dx, cy + dy)], fill=(239, 68, 68, alpha), width=2)
    for i in range(6):
        cx, cy = i * frame + 24, frame + 24
        r = 7 + i * 2
        d.ellipse([cx - r, cy - r - i, cx + r, cy + r - i], fill=(100, 116, 139, max(30, 170 - i * 22)))
        d.ellipse(
            [cx - r + 4, cy - r - 4 - i, cx + r - 2, cy + r - 6 - i],
            fill=(71, 85, 105, max(20, 130 - i * 18)),
        )
    for i in range(4):
        cx, cy = i * frame + 24, frame * 2 + 24
        d.ellipse([cx - 4 - i, cy - 3, cx + 8 + i * 2, cy + 3], fill=(254, 249, 195, 220 - i * 40))
        d.polygon(
            [(cx - 2, cy), (cx + 14 + i * 3, cy - 4 - i), (cx + 14 + i * 3, cy + 4 + i)],
            fill=(251, 191, 36, 200),
        )
    img.save(OUT / "fx.png", optimize=True)


def make_ui():
    img = new_rgba(128, 64)
    d = ImageDraw.Draw(img)
    d.ellipse([4, 4, 60, 60], outline=(196, 40, 40, 230), width=3)
    d.ellipse([10, 10, 54, 54], outline=(245, 245, 240, 120), width=1)
    d.ellipse([68, 4, 124, 60], outline=(217, 140, 60, 230), width=3)
    d.ellipse([74, 10, 118, 54], outline=(168, 85, 247, 140), width=1)
    img.save(OUT / "ui.png", optimize=True)


def main():
    player_heroes: dict[str, Image.Image] = {}
    for label, stem in HERO_BUILDINGS.items():
        hero = load_hero(stem)
        if hero is not None:
            player_heroes[label] = hero
    # dedicated enemy HQ if present; else recolor
    enemy_heroes: dict[str, Image.Image] = {}
    hq_e = load_hero("hq-enemy")
    for label, hero in player_heroes.items():
        if label == "HQ" and hq_e is not None:
            enemy_heroes[label] = hq_e
        else:
            enemy_heroes[label] = to_enemy_faction(hero)

    mech_p = load_hero("mech-player")
    mech_e = load_hero("mech-enemy") or (to_enemy_faction(mech_p) if mech_p else None)
    # Pavement hero crops poorly (selection diamond). Use procedural platform pads.
    pavement = None

    print("Player hero buildings:", sorted(player_heroes.keys()))
    print("Mechs:", {"player": bool(mech_p), "enemy": bool(mech_e)}, "pavement:", bool(pavement))

    make_terrain(pavement)
    make_buildings(OUT / "buildings-player.png", PLAYER, "player", player_heroes, export_icons=True)
    make_buildings(OUT / "buildings-enemy.png", ENEMY, "enemy", enemy_heroes, export_icons=False)
    make_units(mech_p, mech_e)
    make_projectiles()
    make_fx()
    make_ui()

    theater_src = HERO_DIR / "theater.webp"
    campaign_dir = ROOT / "artifacts/metal-marines/public/campaign"
    campaign_dir.mkdir(parents=True, exist_ok=True)
    if theater_src.exists():
        t = Image.open(theater_src).convert("RGB")
        t = ImageEnhance.Contrast(t).enhance(1.08)
        t = ImageEnhance.Color(t).enhance(1.05)
        t.save(campaign_dir / "theater.jpg", quality=88, optimize=True)
        print("Wrote campaign theater backdrop")

    print(f"Wrote atlases to {OUT}")
    for p in sorted(OUT.glob("*.png")):
        print(f"  {p.name}: {p.stat().st_size} bytes {Image.open(p).size}")
    icons = list((OUT / "icons").glob("*.png")) if (OUT / "icons").exists() else []
    print(f"  icons/: {len(icons)} files")


if __name__ == "__main__":
    main()
