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
    # Charcoal hull + brighter gold/purple so procedural fallbacks match hero recolor.
    "olive": (38, 30, 44, 255),
    "olive_lit": (78, 58, 52, 255),
    "metal": (44, 34, 54, 255),
    "metal_lit": (110, 78, 52, 255),
    "primary": (192, 96, 255, 255),
    "secondary": (240, 176, 64, 255),
    "trim": (14, 8, 18, 255),
    "dark": (14, 8, 16, 255),
    "glow": (210, 140, 255, 230),
    "glass": (140, 70, 190, 220),
    "hazard_a": (240, 176, 64, 255),
    "hazard_b": (36, 16, 48, 255),
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
    """Recolor olive/red player art toward charcoal / bronze / purple enemy identity.

    Muddy purple-grey does not read at 64px combat zoom. Hull stays charcoal with a
    clear purple cast; lit metal goes bronze/gold; red/cyan accents become vivid purple.
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = (r * 3 + g * 6 + b) // 10
            sat = max(r, g, b) - min(r, g, b)
            is_red = r > 135 and r > g + 35 and r > b + 35
            is_green = g > r + 10 and g > b + 6
            is_cyanish = b > r + 12 and b > g + 4 and lum > 70
            is_lit = lum > 128
            is_hi = lum > 175
            is_warm = r > g + 5 and r > b + 3 and lum > 60 and not is_red

            if is_red:
                nr, ng, nb = 198, 96, 255
            elif is_cyanish:
                nr, ng, nb = 168, 88, 235
            elif is_hi or (is_warm and is_lit):
                # Bright / warm metal -> gold / bronze (must survive combat zoom)
                t = min(1.0, (lum - 100) / 140.0)
                nr = int(175 + t * 65)
                ng = int(120 + t * 70)
                nb = int(42 + t * 40)
            elif is_green:
                t = lum / 255.0
                if is_lit:
                    nr, ng, nb = 158, 108, 48
                else:
                    nr = int(30 + t * 55)
                    ng = int(22 + t * 38)
                    nb = int(42 + t * 70)
            elif is_lit:
                t = (lum - 128) / 127.0
                nr = int(95 + t * 70)
                ng = int(55 + t * 45)
                nb = int(145 + t * 80)
            else:
                t = lum / 128.0 if lum < 128 else 1.0
                # Dark hull: charcoal with a combat-readable purple cast (not muddy grey)
                nr = int(28 + t * 70)
                ng = int(16 + t * 45)
                nb = int(48 + t * 115)
                if sat > 12 and lum > 40:
                    nr = min(255, nr + 18)
                    nb = min(255, nb + 35)
            px[x, y] = (min(255, nr), min(255, ng), min(255, nb), a)
    return im


def reinforce_enemy_hero(im: Image.Image) -> Image.Image:
    """Lift gold/purple on dedicated enemy heroes (e.g. hq-enemy) without full recolor."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = (r + g + b) // 3
            if b > r and b > g and lum > 50:
                px[x, y] = (
                    min(255, int(r * 0.85 + 40)),
                    min(255, int(g * 0.8 + 20)),
                    min(255, int(b * 0.7 + 90)),
                    a,
                )
            elif lum > 150 and r > g:
                px[x, y] = (
                    min(255, int(r * 0.5 + 200 * 0.5)),
                    min(255, int(g * 0.5 + 150 * 0.5)),
                    min(255, int(b * 0.4 + 50 * 0.6)),
                    a,
                )
    return im


def stamp_enemy_faction_accents(cell: Image.Image) -> Image.Image:
    """Gold pad trim + purple crown punch so enemy buildings read at combat scale."""
    out = cell.copy()
    bbox = _opaque_bbox(out)
    if bbox is None:
        return out
    x0, y0, x1, y1 = bbox
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)

    # Lift muddy midtone hulls toward readable purple (dark metal otherwise stays grey).
    px = out.load()
    w, h = out.size
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            lum = (r + g + b) // 3
            if 35 <= lum <= 120 and b <= r + 25:
                px[x, y] = (
                    min(255, int(r * 0.72 + 70 * 0.28)),
                    min(255, int(g * 0.65 + 35 * 0.35)),
                    min(255, int(b * 0.45 + 150 * 0.55)),
                    a,
                )

    d = ImageDraw.Draw(out)
    hazard_strip(
        d,
        x0 + 1,
        min(out.height - 3, y1 - 1),
        x1 - 1,
        min(out.height - 1, y1 + 2),
        ENEMY,
        3,
    )
    for rx, ry in ((x0 + 1, y1 - 4), (x1 - 4, y1 - 4)):
        d.rectangle([rx, ry, rx + 2, ry + 2], fill=(240, 180, 70, 240))

    px = out.load()
    candidates: list[tuple[int, int, int]] = []
    for y in range(max(0, y0), min(h, y0 + max(4, bh // 2))):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, a = px[x, y]
            if a < 60:
                continue
            lum = (r + g + b) // 3
            if lum > 110:
                candidates.append((lum, x, y))
    candidates.sort(reverse=True)
    for lum, x, y in candidates[: max(8, bw * bh // 40)]:
        r, g, b, a = px[x, y]
        px[x, y] = (
            min(255, int(r * 0.35 + 200 * 0.65)),
            min(255, int(g * 0.35 + 100 * 0.65)),
            min(255, int(b * 0.25 + 255 * 0.75)),
            a,
        )

    if candidates:
        _, bx, by = candidates[0]
        rr = max(3, min(7, bw // 7))
        glow = Image.new("RGBA", out.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([bx - rr - 2, by - rr - 2, bx + rr + 2, by + rr + 2], fill=(140, 70, 220, 70))
        gd.ellipse([bx - rr, by - rr, bx + rr, by + rr], fill=(200, 130, 255, 110))
        out = Image.alpha_composite(out, glow)
        d = ImageDraw.Draw(out)
        hazard_strip(
            d,
            x0 + 1,
            min(out.height - 3, y1 - 1),
            x1 - 1,
            min(out.height - 1, y1 + 2),
            ENEMY,
            3,
        )

    px = out.load()
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] < 40:
                    edge = True
                    break
            if not edge:
                continue
            if y < y0 + bh * 0.40:
                px[x, y] = (
                    min(255, (r + 180) // 2),
                    min(255, (g + 90) // 2),
                    min(255, (b + 240) // 2),
                    a,
                )
            elif y > y0 + bh * 0.70:
                px[x, y] = (
                    min(255, (r + 220) // 2),
                    min(255, (g + 150) // 2),
                    min(255, (b + 55) // 2),
                    a,
                )
    return out


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
    # near-black understory so crowns pop against grass islands
    for y in range(64):
        t = y / 63
        c = mix((6, 22, 12, 255), (14, 40, 20, 255), t)
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
                nr = max(0, int(r * 0.18 + 4))
                ng = max(0, int(g * 0.28 + 8))
                nb = max(0, int(b * 0.16 + 4))
                upx[x, y] = (nr, ng, nb, min(a, 90))
        cell.alpha_composite(u)

    # brush / fern undergrowth between trunks
    for i in range(22):
        bx = (i * 11 + 3) % 60 + 2
        by = (i * 17 + 7) % 58 + 3
        cd.ellipse([bx, by, bx + 3, by + 2], fill=(14, 52, 24, 200))
        if i % 4 == 0:
            cd.line([(bx + 1, by + 1), (bx + 1, by - 3)], fill=(28, 80, 36, 160))

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

    # dark seams between crowns — critical for "trees not blobs" at distance
    for i in range(10):
        sx = (i * 19 + 8) % 56 + 4
        sy = (i * 13 + 10) % 54 + 5
        cd.ellipse([sx, sy, sx + 4, sy + 3], fill=(4, 14, 8, 160))

    # sparse litter / needles so the floor isn't a flat void in gaps
    for i in range(14):
        lx = (i * 13 + 5) % 62
        ly = (i * 19 + 9) % 62
        cd.point((lx, ly), fill=(70, 90, 40, 120))


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

# Priority P0 buildings get the richest state frames; others still get compositing.
PRIORITY_STATE_LABELS = {"HQ", "ENERGY", "MISSILE", "TURRET", "ICBM"}


def _opaque_bbox(cell: Image.Image) -> tuple[int, int, int, int] | None:
    """Return (x0,y0,x1,y1) covering opaque pixels, or None if empty."""
    px = cell.load()
    w, h = cell.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _punch_hole(cell: Image.Image, poly: list[tuple[int, int]], soft: int = 1) -> None:
    """Cut a jagged hole out of the silhouette (alpha → 0)."""
    mask = new_rgba(*cell.size)
    md = ImageDraw.Draw(mask)
    md.polygon(poly, fill=(0, 0, 0, 255))
    if soft > 0:
        # slightly expand for readable bite at 64px
        md.line(poly + [poly[0]], fill=(0, 0, 0, 255), width=soft)
    mp = mask.load()
    px = cell.load()
    w, h = cell.size
    for y in range(h):
        for x in range(w):
            if mp[x, y][3] > 0 and px[x, y][3] > 0:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0)


def _scorch_patch(cell: Image.Image, cx: int, cy: int, rx: int, ry: int, strength: float = 0.35) -> None:
    """Darken an elliptical burn patch in place."""
    px = cell.load()
    w, h = cell.size
    for y in range(max(0, cy - ry - 1), min(h, cy + ry + 2)):
        for x in range(max(0, cx - rx - 1), min(w, cx + rx + 2)):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            nx = (x - cx) / max(1, rx)
            ny = (y - cy) / max(1, ry)
            if nx * nx + ny * ny > 1.0:
                continue
            fall = 1.0 - math.sqrt(nx * nx + ny * ny)
            f = 1.0 - strength * fall
            px[x, y] = (
                max(0, int(r * f)),
                max(0, int(g * f * 0.92)),
                max(0, int(b * f * 0.85)),
                a,
            )


def hero_state_frame(
    cell: Image.Image,
    state: str,
    label: str,
    palette,
) -> Image.Image:
    """Compose distinct damaged / construction / disabled frames from a hero idle cell.

    Tint-only overlays are not enough at combat zoom — silhouettes and mass must change.
    """
    if state == "idle":
        return cell

    w, h = cell.size
    bbox = _opaque_bbox(cell)
    if bbox is None:
        return cell
    x0, y0, x1, y1 = bbox
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    rich = label in PRIORITY_STATE_LABELS
    out = cell.copy()

    if state == "damaged":
        # Scorch + crush brightness so hull reads wounded before we bite chunks.
        out = ImageEnhance.Brightness(out).enhance(0.78 if rich else 0.82)
        out = ImageEnhance.Color(out).enhance(0.85)
        _scorch_patch(out, x0 + bw // 3, y0 + bh // 3, max(6, bw // 5), max(5, bh // 6), 0.55)
        _scorch_patch(out, x0 + (2 * bw) // 3, y0 + bh // 2, max(5, bw // 6), max(4, bh // 7), 0.42)

        # Bite chunks out of the roof / upper mass — silhouette must change.
        bites = [
            [
                (x0 + int(bw * 0.55), y0 + 1),
                (x0 + int(bw * 0.78), y0 + int(bh * 0.08)),
                (x0 + int(bw * 0.92), y0 + int(bh * 0.22)),
                (x0 + int(bw * 0.70), y0 + int(bh * 0.28)),
                (x0 + int(bw * 0.52), y0 + int(bh * 0.18)),
            ],
            [
                (x0 + int(bw * 0.08), y0 + int(bh * 0.20)),
                (x0 + int(bw * 0.22), y0 + int(bh * 0.12)),
                (x0 + int(bw * 0.34), y0 + int(bh * 0.30)),
                (x0 + int(bw * 0.18), y0 + int(bh * 0.38)),
            ],
        ]
        if rich:
            bites.append(
                [
                    (x0 + int(bw * 0.40), y0 + int(bh * 0.02)),
                    (x0 + int(bw * 0.58), y0 + int(bh * 0.00)),
                    (x0 + int(bw * 0.62), y0 + int(bh * 0.14)),
                    (x0 + int(bw * 0.44), y0 + int(bh * 0.16)),
                ]
            )
        for poly in bites:
            _punch_hole(out, poly, soft=2 if rich else 1)

        d = ImageDraw.Draw(out)
        # Crack polylines through remaining mass
        cracks = [
            [
                (x0 + int(bw * 0.22), y0 + int(bh * 0.18)),
                (x0 + int(bw * 0.38), y0 + int(bh * 0.42)),
                (x0 + int(bw * 0.30), y0 + int(bh * 0.68)),
            ],
            [
                (x0 + int(bw * 0.62), y0 + int(bh * 0.25)),
                (x0 + int(bw * 0.78), y0 + int(bh * 0.48)),
                (x0 + int(bw * 0.70), y0 + int(bh * 0.72)),
            ],
        ]
        for pts in cracks:
            d.line(pts, fill=(18, 14, 16, 230), width=2)
            d.line([(p[0] + 1, p[1]) for p in pts], fill=(55, 30, 28, 160), width=1)

        # Rubble / debris at the pad
        rubble_y = min(h - 3, y1 - 2)
        for i, rx in enumerate((x0 + 4, x0 + bw // 2 - 3, x1 - 10)):
            rw = 5 + (i % 3)
            d.ellipse([rx, rubble_y - 3, rx + rw, rubble_y + 2], fill=(42, 40, 38, 210))
            d.rectangle([rx + 1, rubble_y - 5, rx + rw - 1, rubble_y - 1], fill=(60, 55, 50, 190))

        # Smoke puffs rising from the wound (priority buildings)
        if rich:
            for sx, sy, rr in (
                (x0 + int(bw * 0.72), y0 + int(bh * 0.10), 5),
                (x0 + int(bw * 0.80), y0 - 2, 4),
                (x0 + int(bw * 0.66), y0 - 4, 3),
            ):
                d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(70, 72, 78, 110))
                d.ellipse([sx - rr + 2, sy - rr - 2, sx + rr - 1, sy + rr - 2], fill=(90, 92, 98, 70))

    elif state == "construction":
        # Incomplete mass: keep only the lower portion of the hero, fade the rest.
        cut = y0 + int(bh * (0.42 if rich else 0.50))
        px = out.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 8:
                    continue
                if y < cut:
                    # upper mass gone / ghost scaffolding only
                    fade = max(0, int(a * (0.08 if y < cut - 6 else 0.22)))
                    px[x, y] = (r, g, b, fade)
                else:
                    # unfinished hull — desat + slight transparency
                    grey = (r + g + b) // 3
                    nr = int(r * 0.45 + grey * 0.35 + 40)
                    ng = int(g * 0.45 + grey * 0.35 + 45)
                    nb = int(b * 0.45 + grey * 0.35 + 55)
                    px[x, y] = (min(255, nr), min(255, ng), min(255, nb), min(255, int(a * 0.88)))

        d = ImageDraw.Draw(out)
        # Steel frame / rebar rising above the cut
        frame_top = max(2, y0 + 2)
        posts = [x0 + 6, x0 + bw // 2, x1 - 6]
        for px_ in posts:
            d.line([(px_, cut), (px_, frame_top)], fill=(150, 165, 180, 220), width=2)
        # Cross braces
        d.line([(posts[0], cut - 4), (posts[2], frame_top + 6)], fill=(120, 200, 255, 200), width=2)
        d.line([(posts[2], cut - 4), (posts[0], frame_top + 6)], fill=(120, 200, 255, 160), width=1)
        # Horizontal beams
        for by in (frame_top + 4, (frame_top + cut) // 2, cut - 2):
            d.line([(posts[0], by), (posts[2], by)], fill=(170, 180, 195, 200), width=1)

        # Hazard stripe pad at the base
        hazard_strip(d, x0 + 2, min(h - 4, y1 - 1), x1 - 2, min(h - 2, y1 + 2), palette, 4)
        # Crane hook / lifting triangle (reads “under construction” at 64px)
        if rich:
            hx = x0 + bw // 2
            d.polygon(
                [(hx, frame_top - 1), (hx - 5, frame_top + 7), (hx + 5, frame_top + 7)],
                fill=(245, 200, 60, 230),
            )
            d.line([(hx, frame_top + 7), (hx, cut - 8)], fill=(200, 200, 210, 180), width=1)

    elif state == "disabled":
        # Heavy desat + dim — systems offline
        out = ImageEnhance.Brightness(out).enhance(0.52)
        out = ImageEnhance.Color(out).enhance(0.28)
        # Crush remaining chroma toward cold steel
        px = out.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 8:
                    continue
                grey = (r + g + b) // 3
                nr = int(grey * 0.75 + 18)
                ng = int(grey * 0.78 + 22)
                nb = int(grey * 0.88 + 40)
                px[x, y] = (nr, ng, nb, a)

        d = ImageDraw.Draw(out)
        # Dark offline panel bolted on the facade
        panel_w = max(14, bw // 3)
        panel_h = max(8, bh // 5)
        pcx = x0 + bw // 2
        pcy = y0 + bh // 2
        d.rectangle(
            [pcx - panel_w // 2, pcy - panel_h // 2, pcx + panel_w // 2, pcy + panel_h // 2],
            fill=(28, 32, 40, 220),
            outline=(90, 100, 120, 230),
        )
        # Red “offline” LED + cyan EMP arcs for battle readability
        d.ellipse([pcx - 3, pcy - 3, pcx + 3, pcy + 3], fill=(200, 40, 50, 240))
        cyan = (80, 220, 240, 210) if faction_is_player_palette(palette) else (180, 140, 255, 210)
        # EMP lightning arcs that extend past the hull (silhouette change)
        arcs = [
            [
                (x0 - 2, y0 + bh // 3),
                (x0 + int(bw * 0.25), y0 + int(bh * 0.20)),
                (x0 + int(bw * 0.45), y0 + int(bh * 0.45)),
            ],
            [
                (x1 + 2, y0 + bh // 4),
                (x0 + int(bw * 0.75), y0 + int(bh * 0.35)),
                (x0 + int(bw * 0.55), y0 + int(bh * 0.55)),
            ],
        ]
        if rich:
            arcs.append(
                [
                    (pcx - 10, y0 - 3),
                    (pcx - 2, y0 + 8),
                    (pcx + 8, y0 + 2),
                    (pcx + 14, y0 + 14),
                ]
            )
        for pts in arcs:
            d.line(pts, fill=cyan, width=2)
            d.line([(p[0], p[1] + 1) for p in pts], fill=(*cyan[:3], 100), width=1)
        # Corner sparks
        for sx, sy in ((x0 + 2, y0 + 4), (x1 - 4, y0 + 6), (pcx, y0 - 1)):
            d.ellipse([sx, sy, sx + 3, sy + 3], fill=cyan)

    return out


def faction_is_player_palette(palette) -> bool:
    """Heuristic: player glow is warm/red; enemy glow is purple."""
    g = palette.get("glow", (0, 0, 0, 0))
    return g[0] > g[2]


def make_buildings(
    path: Path,
    palette,
    faction: str,
    heroes: dict[str, Image.Image],
    export_icons: bool = False,
    *,
    native_enemy_labels: set[str] | None = None,
):
    row_heights = [h for _, h in BUILDING_ROWS]
    width = 64 * 4
    height = sum(row_heights)
    img = new_rgba(width, height)
    idle_by_label: dict[str, Image.Image] = {}
    native = native_enemy_labels or set()
    y = 0
    for (label, h), rh in zip(BUILDING_ROWS, row_heights):
        hero = heroes.get(label)
        # Fit (+ enemy recolor/accents) once so all states share combat-scale identity.
        # Recolor AFTER fit — LANCZOS on a full-res recolor muddies gold/purple.
        base = None
        if hero is not None:
            base = fit_rgba(hero, 64, h, pad=1)
            if faction == "enemy":
                if label not in native:
                    base = to_enemy_faction(base)
                base = stamp_enemy_faction_accents(base)
        for si, state in enumerate(STATES):
            if base is not None:
                cell = hero_state_frame(base, state, label, palette)
            else:
                cell = building_block(palette, label, state, 64, h, faction=faction)
                if faction == "enemy" and state == "idle":
                    cell = stamp_enemy_faction_accents(cell)
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


def _sample_rgba(px, w: int, h: int, x: float, y: float):
    """Nearest-neighbor sample with transparent OOB."""
    ix, iy = int(round(x)), int(round(y))
    if ix < 0 or iy < 0 or ix >= w or iy >= h:
        return (0, 0, 0, 0)
    return px[ix, iy]


def hero_mech_pose_frame(
    idle: Image.Image,
    pose: str,
    palette,
    *,
    phase: int = 0,
) -> Image.Image:
    """Compose distinct walk/fight/board/dead poses from a fitted hero idle cell.

    Rotate/tint of idle is not enough at combat zoom — limb mass must move.
    Uses a continuous displacement field so silhouettes stay solid (no clear-holes).
    """
    if pose == "idle":
        return idle.copy()

    w, h = idle.size
    bbox = _opaque_bbox(idle)
    if bbox is None:
        return idle.copy()
    x0, y0, x1, y1 = bbox
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    mid_x = x0 + bw // 2
    leg_y = y0 + int(bh * 0.52)
    src_px = idle.load()

    if pose == "dead":
        # Tip the hero onto its side — fallen silhouette, not an X-tint on idle.
        fallen = idle.rotate(72, resample=Image.Resampling.BICUBIC, expand=True)
        fallen = ImageEnhance.Brightness(fallen).enhance(0.70)
        fallen = ImageEnhance.Color(fallen).enhance(0.72)
        fallen.thumbnail((w - 2, max(10, int(h * 0.72))), Image.Resampling.LANCZOS)
        out = new_rgba(w, h)
        ox = (w - fallen.width) // 2
        oy = h - fallen.height - 1
        out.paste(fallen, (ox, oy), fallen)
        d = ImageDraw.Draw(out)
        for sx, sy, rr, a in (
            (w // 2 - 6, h - 7, 4, 130),
            (w // 2 + 5, h - 9, 5, 95),
            (w // 2 - 1, h - 13, 3, 75),
        ):
            d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(55, 52, 48, a))
        d.line([(3, h - 5), (w - 4, h - 3)], fill=(18, 16, 14, 210), width=2)
        return out

    if pose == "boarding":
        # Crouch into drop-pod hatch: vertical squash + glow canopy.
        compact = idle.resize((w, max(10, int(h * 0.78))), Image.Resampling.LANCZOS)
        out = new_rgba(w, h)
        out.paste(compact, (0, h - compact.height - 1), compact)
        d = ImageDraw.Draw(out)
        glow = palette.get("glow", (125, 211, 252, 210))
        d.ellipse([x0 + 2, 0, x1 - 2, max(7, int(h * 0.18))], fill=(*glow[:3], 85))
        d.arc([x0 + 3, 1, x1 - 3, max(8, int(h * 0.20))], 200, 340, fill=glow, width=2)
        d.rectangle([mid_x - 4, 0, mid_x + 4, 3], fill=shade(palette["metal"], 1.05))
        return out

    # Continuous warp for walk / fight — sample source with limb displacements.
    out = new_rgba(w, h)
    out_px = out.load()

    walk = pose in ("walking", "walking2")
    fight = pose in ("fighting", "fighting2")
    sign = 1 if pose in ("walking", "fighting") else -1
    if phase:
        sign = -sign
    fire = pose == "fighting2" or (fight and phase == 1)

    stride = max(3.5, bh / 8.0)
    lean = max(2.0, bw / 14.0)
    gun_reach = max(4.0, bw / 5.5) if fight else 0.0
    gun_lift = max(2.5, bh / 11.0) if fire else (1.2 if fight else 0.0)
    plant = max(2.5, bw / 9.0) if fight else 0.0

    for y in range(h):
        for x in range(w):
            # Normalized position inside the opaque bbox
            ny = (y - y0) / bh
            nx = (x - x0) / bw
            sx = float(x)
            sy = float(y)

            if walk:
                if ny > 0.52:
                    # Legs: left/right opposite vertical stride + slight outward plant
                    side = -1.0 if x < mid_x else 1.0
                    t = min(1.0, (ny - 0.52) / 0.48)
                    # out[y]=src[y+d] moves mass upward when d>0
                    sy += side * sign * stride * t
                    sx -= side * lean * 0.55 * t
                elif ny > 0.18:
                    # Torso lean + arm swing
                    t = (ny - 0.18) / 0.34
                    sx -= sign * lean * (1.0 - t * 0.3)
                    sy += (0.9 if sign > 0 else -0.9) * (1.0 - t)
                    if x < mid_x:
                        sx += sign * lean * 1.2
                        sy -= sign * 1.4
                    else:
                        sx -= sign * lean * 1.0
                        sy += sign * 1.1
                else:
                    # Head / vents nod with lean
                    sx -= sign * lean * 0.55

            elif fight:
                if ny > 0.52:
                    # Wider plant
                    side = -1.0 if x < mid_x else 1.0
                    t = min(1.0, (ny - 0.52) / 0.48)
                    sx -= side * plant * t
                    sy -= 1.0 * t
                elif x < mid_x + bw * 0.15 and 0.12 < ny < 0.62:
                    # Weapon arm extends outward (image-left): pull mass from the right
                    t = 1.0 - abs(ny - 0.34) * 2.2
                    t = max(0.0, min(1.0, t))
                    sx += gun_reach * t
                    sy += gun_lift * t
                elif ny < 0.55:
                    # Torso leans into the shot
                    sx -= lean * 0.85
                    sy -= 1.4 if fire else 0.7

            out_px[x, y] = _sample_rgba(src_px, w, h, sx, sy)

    d = ImageDraw.Draw(out)
    if walk:
        # Dust kick under the planted foot
        plant_x = int(mid_x - sign * max(3, bw // 6))
        dust_y = min(h - 2, y1)
        for i, ox in enumerate((-3, 0, 3)):
            rr = 2 + (i % 2)
            d.ellipse(
                [plant_x + ox - rr, dust_y - rr, plant_x + ox + rr, dust_y + 1],
                fill=(90, 78, 55, 100 - i * 18),
            )

    if fight:
        # Orange muzzle bloom (not faction glow) — bigger on the fire phase.
        mx = max(1, x0 - (2 if fire else 0))
        my = y0 + int(bh * 0.30)
        rr = 5 if fire else 3
        d.ellipse([mx - rr, my - rr, mx + rr, my + rr], fill=(255, 140, 40, 220))
        if fire:
            d.ellipse([mx - rr - 2, my - 2, mx + 2, my + 2], fill=(255, 240, 170, 235))
            d.ellipse([mx - 2, my - rr - 2, mx + 2, my], fill=(255, 200, 70, 190))
            d.rectangle([mx, my - 1, mx + 5, my + 1], fill=(255, 250, 220, 245))

    return out


def mech_frame(palette, pose: str, jagged: bool = False, phase: int = 0) -> Image.Image:
    """Procedural fallback when hero art is missing — still distinct per pose."""
    img = new_rgba(40, 48)
    d = ImageDraw.Draw(img)
    leg_off = 0
    if pose in ("walking", "walking2"):
        leg_off = 5 if pose == "walking" else -5
        if phase:
            leg_off = -leg_off
    elif pose in ("fighting", "fighting2"):
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
    if pose in ("fighting", "fighting2"):
        reach = 38 if pose == "fighting2" else 36
        d.rectangle([28, 12, reach, 18], fill=palette["metal_lit"])
        glow_r = 5 if pose == "fighting2" else 3
        d.ellipse([reach - 4, 10, reach + glow_r, 20], fill=palette["glow"])
        if pose == "fighting2":
            d.ellipse([reach - 1, 8, reach + 6, 15], fill=(255, 220, 120, 220))
    else:
        swing = 0
        if pose in ("walking", "walking2"):
            swing = 2 if pose == "walking" else -2
        d.rectangle([6, 16 + swing, 11, 26 + swing], fill=shade(palette["olive"], 0.85))
        d.rectangle([29, 16 - swing, 34, 26 - swing], fill=shade(palette["olive"], 0.85))
    if pose == "dead":
        d.line([(6, 8), (34, 40)], fill=(15, 15, 20, 230), width=2)
        d.ellipse([8, 36, 20, 44], fill=(40, 38, 36, 180))
    if pose == "boarding":
        d.rectangle([8, 1, 32, 8], fill=palette["glow"])
        d.arc([6, 0, 34, 14], 200, 340, fill=palette["glow"], width=2)
    return img


def make_units(hero_player: Image.Image | None, hero_enemy: Image.Image | None):
    # walking2 / fighting2 give flipbooks distinct silhouettes (not idle↔tilt).
    poses = ["idle", "walking", "walking2", "fighting", "fighting2", "boarding", "dead"]
    cell_w, cell_h = 40, 48
    img = new_rgba(cell_w * len(poses), cell_h * 2)
    heroes = [hero_player, hero_enemy]
    pals = [PLAYER, ENEMY]
    for oi, (pal, hero) in enumerate(zip(pals, heroes)):
        idle_fit = fit_rgba(hero, cell_w, cell_h, pad=1) if hero is not None else None
        for pi, pose in enumerate(poses):
            if idle_fit is not None:
                frame = hero_mech_pose_frame(idle_fit, pose, pal)
            else:
                frame = mech_frame(pal, pose, jagged=(oi == 1))
            img.paste(frame, (pi * cell_w, oi * cell_h), frame)
    img.save(OUT / "units.png", optimize=True)


def _draw_missile_body(
    d: ImageDraw.ImageDraw,
    x: int,
    cy: int,
    w: int,
    h: int,
    body: tuple[int, int, int, int],
    accent: tuple[int, int, int, int],
    *,
    fins: bool = True,
    bands: int = 2,
    nose_glow: tuple[int, int, int, int] = (251, 146, 60, 255),
) -> None:
    """Thick nose-up missile silhouette (atlas top = flight forward)."""
    cx = x + w // 2
    top = cy - h // 2 + 1
    bot = cy + h // 2 - 1
    half = max(5, w // 2 - 2)
    # Outer hull — fat diamond/capsule so it reads at combat zoom
    hull = [
        (cx, top),
        (cx + half, top + int(h * 0.22)),
        (cx + half - 1, bot - 6),
        (cx, bot),
        (cx - half + 1, bot - 6),
        (cx - half, top + int(h * 0.22)),
    ]
    d.polygon(hull, fill=body, outline=(20, 22, 24, 255))
    # Lit center strip (thickness cue)
    strip_w = max(3, half // 2)
    d.polygon(
        [
            (cx, top + 3),
            (cx + strip_w, top + int(h * 0.28)),
            (cx + strip_w - 1, bot - 10),
            (cx - strip_w + 1, bot - 10),
            (cx - strip_w, top + int(h * 0.28)),
        ],
        fill=shade(body, 1.35),
    )
    # Accent bands
    for bi in range(bands):
        by = top + int(h * (0.38 + bi * 0.16))
        d.rectangle([cx - half + 2, by, cx + half - 2, by + 3], fill=accent)
    # Nose glow / warhead tip
    d.ellipse([cx - 4, top - 1, cx + 4, top + 9], fill=nose_glow)
    d.ellipse([cx - 2, top + 1, cx + 2, top + 5], fill=(255, 250, 220, 240))
    # Exhaust nozzle
    d.rectangle([cx - 4, bot - 5, cx + 4, bot], fill=(30, 30, 34, 255))
    d.ellipse([cx - 3, bot - 2, cx + 3, bot + 4], fill=(251, 146, 60, 200))
    if fins:
        fin_y = bot - int(h * 0.28)
        for side in (-1, 1):
            d.polygon(
                [
                    (cx + side * (half - 1), fin_y),
                    (cx + side * (half + 5), bot - 2),
                    (cx + side * (half - 1), bot - 6),
                ],
                fill=shade(body, 0.7),
                outline=(18, 18, 20, 255),
            )


def _draw_transport_pod(d: ImageDraw.ImageDraw, x: int, cy: int, w: int, h: int) -> None:
    """Capsule drop pod with visible mech silhouette in the hatch window."""
    cx = x + w // 2
    top = cy - h // 2 + 1
    bot = cy + h // 2 - 1
    half = max(8, w // 2 - 2)
    # Heat shield nose
    d.ellipse([cx - half + 2, top, cx + half - 2, top + 14], fill=(196, 40, 40, 255), outline=(40, 20, 20, 255))
    d.ellipse([cx - half + 6, top + 3, cx + half - 6, top + 11], fill=(245, 120, 80, 220))
    # Main capsule body
    body_top = top + 10
    body_bot = bot - 8
    d.rounded_rectangle(
        [cx - half, body_top, cx + half, body_bot],
        radius=6,
        fill=(55, 62, 70, 255),
        outline=(22, 26, 28, 255),
    )
    # Side ribs
    for ry in (body_top + 4, (body_top + body_bot) // 2, body_bot - 8):
        d.rectangle([cx - half + 1, ry, cx + half - 1, ry + 2], fill=(90, 98, 108, 230))
    # Hatch / viewport — mech reads through the glass
    vw = half - 3
    vh = max(14, (body_bot - body_top) // 2)
    vx0, vy0 = cx - vw, body_top + 6
    vx1, vy1 = cx + vw, body_top + 6 + vh
    d.rounded_rectangle([vx0, vy0, vx1, vy1], radius=3, fill=(30, 50, 58, 240), outline=(160, 200, 210, 220))
    # Chunk mech silhouette (helmet + torso + arms) inside the hatch
    d.ellipse([cx - 5, vy0 + 2, cx + 5, vy0 + 10], fill=(110, 122, 72, 255))  # head
    d.rectangle([cx - 6, vy0 + 9, cx + 6, vy0 + vh - 3], fill=(74, 84, 48, 255))  # torso
    d.rectangle([cx - 10, vy0 + 11, cx - 6, vy0 + vh - 5], fill=(90, 98, 108, 255))  # L arm
    d.rectangle([cx + 6, vy0 + 11, cx + 10, vy0 + vh - 5], fill=(90, 98, 108, 255))  # R arm
    d.rectangle([cx - 3, vy0 + 4, cx + 3, vy0 + 7], fill=(160, 200, 210, 230))  # visor
    # Hazard belt
    hazard_strip(d, cx - half + 2, body_bot - 7, cx + half - 2, body_bot - 3, PLAYER, 4)
    # Retros / thruster skirt
    d.rectangle([cx - half + 2, body_bot - 1, cx + half - 2, bot - 2], fill=(40, 44, 48, 255))
    for tx in (cx - 8, cx, cx + 8):
        d.ellipse([tx - 3, bot - 5, tx + 3, bot + 2], fill=(251, 146, 60, 210))
        d.ellipse([tx - 1, bot - 3, tx + 1, bot], fill=(254, 243, 199, 230))


def _draw_emp_orb(d: ImageDraw.ImageDraw, x: int, cy: int, w: int, h: int) -> None:
    cx = x + w // 2
    r = min(w, h) // 2 - 2
    cyan = (80, 210, 255, 255)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=cyan, width=4)
    d.ellipse([cx - r + 5, cy - r + 5, cx + r - 5, cy + r - 5], fill=(40, 120, 160, 90), outline=(120, 230, 255, 200))
    # Inner core
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(180, 250, 255, 180))
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(255, 255, 255, 230))
    # Lightning bolts past the rim (silhouette)
    bolts = [
        [(cx - r - 1, cy - 4), (cx - r // 2, cy - 10), (cx - 2, cy - 2), (cx + 6, cy - 12)],
        [(cx + r + 1, cy + 2), (cx + r // 2, cy + 8), (cx + 2, cy + 1), (cx - 4, cy + 10)],
    ]
    for pts in bolts:
        d.line(pts, fill=(120, 240, 255, 230), width=2)


def make_projectiles():
    # Thicker cells than the old 16–24px missiles; nose-up layout for rotation.
    # Uniform row height so manifest rects (y=0,h=56) match drawn content.
    specs = [
        ("icbm", 32),
        ("emp", 40),
        ("transport_pod", 40),
        ("tunnel_buster", 28),
        ("dummy", 26),
        ("aa", 22),
    ]
    row_h = 56
    width = sum(s[1] for s in specs)
    img = new_rgba(width, row_h)
    d = ImageDraw.Draw(img)
    x = 0
    for name, w in specs:
        cy = row_h // 2
        h = row_h - 2
        if name == "emp":
            _draw_emp_orb(d, x, cy, w, min(w, h))
        elif name == "transport_pod":
            _draw_transport_pod(d, x, cy, w, h)
        elif name == "icbm":
            _draw_missile_body(
                d, x, cy, w, h,
                body=(245, 245, 240, 255),
                accent=(196, 40, 40, 255),
                bands=3,
                nose_glow=(255, 120, 60, 255),
            )
        elif name == "tunnel_buster":
            _draw_missile_body(
                d, x, cy, w, h,
                body=(250, 200, 60, 255),
                accent=(120, 70, 20, 255),
                bands=2,
                nose_glow=(255, 220, 80, 255),
            )
            # Drill tip accent
            cx = x + w // 2
            tip = cy - h // 2 + 1
            d.polygon(
                [(cx, tip - 2), (cx + 5, tip + 8), (cx - 5, tip + 8)],
                fill=(80, 50, 20, 255),
            )
        elif name == "dummy":
            _draw_missile_body(
                d, x, cy, w, h,
                body=(148, 163, 184, 255),
                accent=(168, 85, 247, 255),
                bands=1,
                nose_glow=(200, 180, 255, 255),
            )
            # Dashed decoy outline
            cx = x + w // 2
            half = max(5, w // 2 - 2)
            top = cy - h // 2 + 4
            bot = cy + h // 2 - 8
            for y0 in range(top, bot, 6):
                d.line([(cx - half - 1, y0), (cx - half - 1, min(y0 + 3, bot))], fill=(216, 180, 254, 220), width=1)
                d.line([(cx + half + 1, y0), (cx + half + 1, min(y0 + 3, bot))], fill=(216, 180, 254, 220), width=1)
        else:  # aa
            _draw_missile_body(
                d, x, cy, w, h,
                body=(80, 200, 120, 255),
                accent=(245, 245, 240, 255),
                bands=1,
                fins=True,
                nose_glow=(180, 255, 160, 255),
            )
        x += w
    img.save(OUT / "projectiles.png", optimize=True)


def make_fx():
    # 64px frames (was 48) — bigger blast readable at combat zoom.
    frame = 64
    cols = 8
    img = new_rgba(frame * cols, frame * 3)
    d = ImageDraw.Draw(img)

    # Row 0: explosion flipbook — flash → fireball → shockwave → ember fade
    for i in range(8):
        cx, cy = i * frame + frame // 2, frame // 2
        t = i / 7.0
        # Outer shockwave ring (grows then fades)
        ring_r = int(8 + t * 26)
        ring_a = max(0, int(200 - t * 210))
        if ring_a > 20:
            d.ellipse(
                [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                outline=(255, 220, 160, ring_a),
                width=max(1, 4 - i // 2),
            )
        # Fireball body
        r = int(6 + t * 22)
        a = max(40, 250 - i * 28)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(239, 68, 68, a))
        d.ellipse(
            [cx - int(r * 0.72), cy - int(r * 0.72), cx + int(r * 0.72), cy + int(r * 0.72)],
            fill=(251, 146, 60, min(255, a + 20)),
        )
        core = max(2, int(r * (0.45 if i < 5 else 0.25)))
        d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=(254, 243, 199, min(255, a + 40)))
        # Debris / spark rays
        if 1 <= i <= 6:
            for a_i in range(10):
                ang = a_i * math.pi / 5 + i * 0.12
                length = int(r * (0.85 + (a_i % 3) * 0.15))
                dx = int(math.cos(ang) * length)
                dy = int(math.sin(ang) * length)
                col = (255, 200, 80, max(50, a - 30)) if a_i % 2 == 0 else (239, 68, 68, max(40, a - 40))
                d.line([(cx, cy), (cx + dx, cy + dy)], fill=col, width=2 if i < 4 else 1)
        # Late smoke wisps
        if i >= 5:
            for ox, oy, rr in ((-10, -8, 7), (12, -4, 6), (-4, 10, 8), (8, 8, 5)):
                sa = max(20, 140 - (i - 5) * 40)
                d.ellipse(
                    [cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr],
                    fill=(70, 78, 90, sa),
                )

    # Row 1: smoke — denser multi-puff columns
    for i in range(6):
        cx, cy = i * frame + frame // 2, frame + frame // 2
        lift = i * 3
        for j, (ox, oy, rr, a0) in enumerate(
            (
                (0, -lift, 10 + i * 2, 180),
                (-8, -lift - 4, 8 + i, 140),
                (9, -lift - 2, 7 + i, 130),
                (-3, -lift - 10, 6 + i, 100),
                (5, -lift - 14, 5 + i, 80),
            )
        ):
            a = max(18, a0 - i * 22 - j * 8)
            d.ellipse(
                [cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr],
                fill=(100, 116, 139, a),
            )
            d.ellipse(
                [cx + ox - rr + 3, cy + oy - rr - 2, cx + ox + rr - 2, cy + oy + rr - 4],
                fill=(71, 85, 105, max(12, a - 30)),
            )

    # Row 2: muzzle flash — thicker wedge + bloom
    for i in range(4):
        cx, cy = i * frame + frame // 2, frame * 2 + frame // 2
        bloom = 6 + i * 3
        d.ellipse([cx - bloom, cy - bloom // 2, cx + bloom, cy + bloom // 2], fill=(254, 249, 195, 200 - i * 35))
        d.ellipse([cx - 3, cy - 3, cx + 5 + i, cy + 3], fill=(255, 255, 255, 230 - i * 30))
        reach = 16 + i * 5
        d.polygon(
            [(cx - 2, cy), (cx + reach, cy - 5 - i), (cx + reach, cy + 5 + i)],
            fill=(251, 191, 36, 210 - i * 30),
        )
        d.polygon(
            [(cx, cy), (cx + reach - 4, cy - 2), (cx + reach - 4, cy + 2)],
            fill=(255, 250, 220, 200),
        )
        # Side sparks
        for sy in (-1, 1):
            d.line(
                [(cx + 4, cy), (cx + 10 + i * 2, cy + sy * (6 + i))],
                fill=(239, 68, 68, 180 - i * 30),
                width=2,
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
    # dedicated enemy HQ if present; else recolor at atlas fit (64px) for combat chroma.
    enemy_heroes: dict[str, Image.Image] = {}
    native_enemy_labels: set[str] = set()
    hq_e = load_hero("hq-enemy")
    for label, hero in player_heroes.items():
        if label == "HQ" and hq_e is not None:
            enemy_heroes[label] = reinforce_enemy_hero(hq_e)
            native_enemy_labels.add(label)
        else:
            # Keep player hero; to_enemy_faction runs after fit_rgba in make_buildings.
            enemy_heroes[label] = hero

    mech_p = load_hero("mech-player")
    mech_e = load_hero("mech-enemy") or (to_enemy_faction(mech_p) if mech_p else None)
    # Pavement hero crops poorly (selection diamond). Use procedural platform pads.
    pavement = None

    print("Player hero buildings:", sorted(player_heroes.keys()))
    print("Mechs:", {"player": bool(mech_p), "enemy": bool(mech_e)}, "pavement:", bool(pavement))

    make_terrain(pavement)
    make_buildings(OUT / "buildings-player.png", PLAYER, "player", player_heroes, export_icons=True)
    make_buildings(
        OUT / "buildings-enemy.png",
        ENEMY,
        "enemy",
        enemy_heroes,
        export_icons=False,
        native_enemy_labels=native_enemy_labels,
    )
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
