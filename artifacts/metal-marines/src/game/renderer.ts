import {
  BUILDINGS,
  GRID_H,
  GRID_W,
  ISLAND_PX_H,
  ISLAND_PX_W,
  SKY_GAP_PX,
  TILE_PX,
  WORLD_H,
  WORLD_W,
} from "./constants";
import type {
  Building,
  Mech,
  Owner,
  Particle,
  Projectile,
  RuntimeState,
  Tile,
} from "./types";
import { islandOriginX, projectileCurrentPos, tileToWorld } from "./engine";
import { spriteManager } from "./sprites";

const terrainSpriteKey: Record<string, string> = {
  GRASS: "terrain.grass.base",
  FOREST: "terrain.forest.base",
  MOUNTAIN: "terrain.mountain.base",
  WATER: "terrain.water.base",
  TOXIC_SLUDGE: "terrain.toxic_sludge.base",
};

type TerrainKey = Tile["terrain"];

const TERRAIN_PALETTE: Record<
  TerrainKey,
  { base: string; mid: string; accent: string; shadow: string; line: string }
> = {
  GRASS: {
    base: "#0d3528",
    mid: "#14543a",
    accent: "#2dd06d",
    shadow: "#061d16",
    line: "rgba(74,222,128,0.16)",
  },
  FOREST: {
    base: "#08261c",
    mid: "#10482b",
    accent: "#22c55e",
    shadow: "#03150f",
    line: "rgba(34,197,94,0.18)",
  },
  MOUNTAIN: {
    base: "#17202c",
    mid: "#334155",
    accent: "#94a3b8",
    shadow: "#070b12",
    line: "rgba(203,213,225,0.12)",
  },
  WATER: {
    base: "#06142d",
    mid: "#0b3b68",
    accent: "#38bdf8",
    shadow: "#020817",
    line: "rgba(125,211,252,0.2)",
  },
  TOXIC_SLUDGE: {
    base: "#253806",
    mid: "#4d7c0f",
    accent: "#bef264",
    shadow: "#111904",
    line: "rgba(217,249,157,0.24)",
  },
};

const terrainHash = (x: number, y: number, salt = 0) => {
  const n = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

const isLandTerrain = (terrain: TerrainKey | null | undefined) =>
  !!terrain && terrain !== "WATER";

const terrainAt = (tiles: Tile[], x: number, y: number): TerrainKey | null => {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
  return tiles[y * GRID_W + x]?.terrain ?? null;
};

const drawTileGradient = (
  ctx: CanvasRenderingContext2D,
  terrain: TerrainKey,
  px: number,
  py: number,
  x: number,
  y: number
) => {
  const palette = TERRAIN_PALETTE[terrain];
  const shift = terrainHash(x, y, 3);
  const gradient = ctx.createLinearGradient(px, py, px + TILE_PX, py + TILE_PX);
  gradient.addColorStop(0, palette.mid);
  gradient.addColorStop(0.45 + shift * 0.15, palette.base);
  gradient.addColorStop(1, palette.shadow);
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, TILE_PX, TILE_PX);
};

const drawGrassDetails = (ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) => {
  for (let i = 0; i < 9; i++) {
    const n = terrainHash(x, y, i);
    const gx = px + 8 + ((n * 97 + i * 13) % (TILE_PX - 16));
    const gy = py + 9 + ((n * 53 + i * 17) % (TILE_PX - 18));
    ctx.strokeStyle = i % 3 === 0 ? "rgba(74,222,128,0.28)" : "rgba(20,83,45,0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy + 4);
    ctx.lineTo(gx + 3, gy);
    ctx.lineTo(gx + 7, gy + 5);
    ctx.stroke();
  }
};

const drawForestDetails = (ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) => {
  const canopy = [
    [0.26, 0.3, 10],
    [0.54, 0.25, 12],
    [0.74, 0.48, 10],
    [0.38, 0.62, 13],
    [0.62, 0.76, 9],
  ] as const;
  for (const [rx, ry, r] of canopy) {
    const jitter = terrainHash(x, y, rx + ry);
    const cx = px + TILE_PX * rx + (jitter - 0.5) * 5;
    const cy = py + TILE_PX * ry + (jitter - 0.5) * 4;
    const grad = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, r);
    grad.addColorStop(0, "#34d399");
    grad.addColorStop(0.55, "#166534");
    grad.addColorStop(1, "#052e1d");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(3,7,18,0.24)";
  ctx.fillRect(px + 6, py + TILE_PX - 8, TILE_PX - 12, 3);
};

const drawMountainDetails = (ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) => {
  const peak = terrainHash(x, y, 11) * 8 - 4;
  ctx.fillStyle = "#273449";
  ctx.beginPath();
  ctx.moveTo(px + 6, py + TILE_PX - 8);
  ctx.lineTo(px + TILE_PX * 0.44 + peak, py + 10);
  ctx.lineTo(px + TILE_PX - 7, py + TILE_PX - 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(px + TILE_PX * 0.44 + peak, py + 10);
  ctx.lineTo(px + TILE_PX * 0.58, py + TILE_PX - 8);
  ctx.lineTo(px + TILE_PX - 7, py + TILE_PX - 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(226,232,240,0.75)";
  ctx.beginPath();
  ctx.moveTo(px + TILE_PX * 0.44 + peak, py + 10);
  ctx.lineTo(px + TILE_PX * 0.36 + peak, py + 25);
  ctx.lineTo(px + TILE_PX * 0.52 + peak, py + 23);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(2,6,23,0.36)";
  ctx.beginPath();
  ctx.moveTo(px + TILE_PX * 0.35, py + TILE_PX * 0.5);
  ctx.lineTo(px + TILE_PX * 0.52, py + TILE_PX - 10);
  ctx.moveTo(px + TILE_PX * 0.57, py + TILE_PX * 0.35);
  ctx.lineTo(px + TILE_PX * 0.76, py + TILE_PX - 11);
  ctx.stroke();
};

const drawWaterDetails = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  t: number
) => {
  for (let i = 0; i < 4; i++) {
    const yy = py + 12 + i * 12 + Math.sin(t * 1.7 + x * 0.7 + y + i) * 2;
    const offset = Math.sin(t * 1.3 + i + x) * 4;
    ctx.strokeStyle = `rgba(125,211,252,${0.12 + i * 0.025})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(px + 7 + offset, yy);
    ctx.bezierCurveTo(px + 21 + offset, yy - 5, px + 38 + offset, yy + 5, px + TILE_PX - 7, yy - 1);
    ctx.stroke();
  }
};

const drawToxicDetails = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  t: number
) => {
  for (let i = 0; i < 3; i++) {
    const n = terrainHash(x, y, i + 21);
    const cx = px + TILE_PX * (0.25 + n * 0.5);
    const cy = py + TILE_PX * (0.25 + terrainHash(x, y, i + 34) * 0.5);
    const r = 7 + n * 8 + Math.sin(t * 3 + i + x) * 1.5;
    ctx.fillStyle = `rgba(190,242,100,${0.12 + i * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.62, Math.sin(n * 10), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(217,249,157,0.34)";
  ctx.beginPath();
  ctx.moveTo(px + 9, py + 38);
  ctx.bezierCurveTo(px + 19, py + 23, px + 34, py + 45, px + 52, py + 22);
  ctx.stroke();
};

const drawTerrainFallback = (
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  px: number,
  py: number,
  x: number,
  y: number,
  t: number
) => {
  drawTileGradient(ctx, tile.terrain, px, py, x, y);
  if (tile.terrain === "GRASS") drawGrassDetails(ctx, px, py, x, y);
  else if (tile.terrain === "FOREST") drawForestDetails(ctx, px, py, x, y);
  else if (tile.terrain === "MOUNTAIN") drawMountainDetails(ctx, px, py, x, y);
  else if (tile.terrain === "WATER") drawWaterDetails(ctx, px, py, x, y, t);
  else if (tile.terrain === "TOXIC_SLUDGE") drawToxicDetails(ctx, px, py, x, y, t);
};

const drawEdgeLine = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  edge: "top" | "right" | "bottom" | "left",
  color: string,
  width: number
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (edge === "top") {
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + TILE_PX - 3, py + 3);
  } else if (edge === "right") {
    ctx.moveTo(px + TILE_PX - 3, py + 3);
    ctx.lineTo(px + TILE_PX - 3, py + TILE_PX - 3);
  } else if (edge === "bottom") {
    ctx.moveTo(px + 3, py + TILE_PX - 3);
    ctx.lineTo(px + TILE_PX - 3, py + TILE_PX - 3);
  } else {
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + 3, py + TILE_PX - 3);
  }
  ctx.stroke();
};

const drawTerrainTransitions = (
  ctx: CanvasRenderingContext2D,
  tiles: Tile[],
  x: number,
  y: number,
  px: number,
  py: number,
  terrain: TerrainKey
) => {
  const edges = [
    ["top", terrainAt(tiles, x, y - 1)],
    ["right", terrainAt(tiles, x + 1, y)],
    ["bottom", terrainAt(tiles, x, y + 1)],
    ["left", terrainAt(tiles, x - 1, y)],
  ] as const;

  for (const [edge, neighbor] of edges) {
    const waterBoundary = terrain === "WATER" ? isLandTerrain(neighbor) : neighbor === "WATER" || neighbor === null;
    if (waterBoundary) {
      drawEdgeLine(
        ctx,
        px,
        py,
        edge,
        terrain === "WATER" ? "rgba(186,230,253,0.34)" : "rgba(250,204,21,0.28)",
        terrain === "WATER" ? 2 : 4
      );
      continue;
    }

    if (neighbor && neighbor !== terrain) {
      const color = terrain === "MOUNTAIN" || neighbor === "MOUNTAIN" ? "rgba(15,23,42,0.42)" : TERRAIN_PALETTE[terrain].line;
      drawEdgeLine(ctx, px, py, edge, color, 1.5);
    }
  }
};

const drawIslandShadow = (ctx: CanvasRenderingContext2D, side: Owner) => {
  const ox = islandOriginX(side);
  const shadow = ctx.createRadialGradient(
    ox + ISLAND_PX_W / 2,
    ISLAND_PX_H / 2,
    ISLAND_PX_W * 0.18,
    ox + ISLAND_PX_W / 2,
    ISLAND_PX_H / 2,
    ISLAND_PX_W * 0.7
  );
  shadow.addColorStop(0, "rgba(2,6,23,0.08)");
  shadow.addColorStop(0.72, "rgba(2,6,23,0.5)");
  shadow.addColorStop(1, "rgba(2,6,23,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(ox - 40, -24, ISLAND_PX_W + 80, ISLAND_PX_H + 70);
};

const buildingSpriteKey = (b: Building, now: number): string => {
  const owner = b.side === "PLAYER" ? "player" : "enemy";
  const type = b.type.toLowerCase();
  const state =
    b.buildTimeRemaining > 0
      ? "construction"
      : (b.disabledUntil ?? 0) > now
      ? "disabled"
      : b.hp / b.maxHp < 0.35
      ? "damaged"
      : "idle";
  return `building.${type}.${owner}.${state}`;
};

const drawIsland = (
  ctx: CanvasRenderingContext2D,
  side: Owner,
  tiles: Tile[],
  fog: boolean[] | null,
  t: number,
  underground: boolean,
  now: number
) => {
  const ox = islandOriginX(side);
  drawIslandShadow(ctx, side);

  // Backdrop / terrain bed
  const bed = ctx.createLinearGradient(ox, 0, ox + ISLAND_PX_W, ISLAND_PX_H);
  bed.addColorStop(0, "#07111f");
  bed.addColorStop(0.55, side === "PLAYER" ? "#06241e" : "#1d1231");
  bed.addColorStop(1, "#020617");
  ctx.fillStyle = bed;
  ctx.fillRect(ox - 8, -8, ISLAND_PX_W + 16, ISLAND_PX_H + 16);

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const tile = tiles[y * GRID_W + x];
      const px = ox + x * TILE_PX;
      const py = y * TILE_PX;
      const drewTerrain = spriteManager.draw(ctx, terrainSpriteKey[tile.terrain] ?? "", px + TILE_PX / 2, py + TILE_PX / 2, {
        scale: TILE_PX / 64,
      });
      if (!drewTerrain) {
        drawTerrainFallback(ctx, tile, px, py, x, y, t);
      }
      drawTerrainTransitions(ctx, tiles, x, y, px, py, tile.terrain);

      // Tile outline
      ctx.strokeStyle = tile.terrain === "WATER" ? "rgba(125,211,252,0.08)" : "rgba(34,197,94,0.055)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_PX - 1, TILE_PX - 1);

      if (underground) {
        const tunnelOpen = tile.tunnel?.open;
        const collapsed = (tile.tunnel?.collapsedUntil ?? 0) > now;
        ctx.fillStyle = tunnelOpen
          ? collapsed
            ? "rgba(127,29,29,0.55)"
            : "rgba(217,119,6,0.38)"
          : "rgba(2,6,23,0.68)";
        ctx.fillRect(px, py, TILE_PX, TILE_PX);
        if (tunnelOpen && !collapsed) {
          ctx.strokeStyle = "rgba(251,191,36,0.45)";
          ctx.beginPath();
          ctx.moveTo(px + 8, py + TILE_PX / 2);
          ctx.lineTo(px + TILE_PX - 8, py + TILE_PX / 2);
          ctx.moveTo(px + TILE_PX / 2, py + 8);
          ctx.lineTo(px + TILE_PX / 2, py + TILE_PX - 8);
          ctx.stroke();
        }
      }
    }
  }

  // Border
  ctx.strokeStyle = side === "PLAYER" ? "rgba(248,113,113,0.72)" : "rgba(216,180,254,0.58)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(ox + 1.5, 1.5, ISLAND_PX_W - 3, ISLAND_PX_H - 3);
  ctx.strokeStyle = "rgba(125,211,252,0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 7.5, 7.5, ISLAND_PX_W - 15, ISLAND_PX_H - 15);

  // Side label
  ctx.font = "11px 'Space Mono', ui-monospace, monospace";
  ctx.fillStyle = side === "PLAYER" ? "rgba(248,113,113,0.92)" : "rgba(250,204,21,0.86)";
  ctx.fillText(side === "PLAYER" ? "AO :: HOME ISLAND" : "AO :: HOSTILE ISLAND", ox + 8, ISLAND_PX_H + 16);

  // Fog
  if (fog) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!fog[y * GRID_W + x]) {
          const px = ox + x * TILE_PX;
          const py = y * TILE_PX;
          ctx.fillStyle = "rgba(2,6,23,0.86)";
          ctx.fillRect(px, py, TILE_PX, TILE_PX);
          ctx.strokeStyle = "rgba(56,189,248,0.07)";
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_PX - 1, TILE_PX - 1);
        }
      }
    }
  }
};

const drawHQGlyph = (ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(cx - 16, cy - 14, 32, 26);
  ctx.fillStyle = "#020617";
  ctx.fillRect(cx - 12, cy - 10, 24, 12);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 4, cy + 2, 8, 10);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("HQ", cx, cy + 11);
  ctx.textAlign = "start";
};

const buildingFill: Record<string, string> = {
  HQ: "#22c55e",
  ENERGY_PLANT: "#06b6d4",
  SUPPLY_DEPOT: "#facc15",
  RADAR: "#8b5cf6",
  RADAR_JAMMER: "#a855f7",
  TUNNEL_ENTRANCE: "#d97706",
  SEISMIC_SENSOR: "#67e8f9",
  TERRAIN_DESTABILIZER: "#84cc16",
  WEATHER_CONTROL: "#38bdf8",
  BIOSPHERE_ENGINE: "#22c55e",
  MISSILE_LAUNCHER: "#f97316",
  EMP_CANNON: "#22d3ee",
  METAL_MARINE_BASE: "#ef4444",
  AA_GUN: "#a3e635",
  GUN_TURRET: "#fb923c",
  LAND_MINE: "#64748b",
};

const buildingGlyph: Record<string, string> = {
  HQ: "HQ",
  ENERGY_PLANT: "E",
  SUPPLY_DEPOT: "$",
  RADAR: "R",
  RADAR_JAMMER: "J",
  TUNNEL_ENTRANCE: "G",
  SEISMIC_SENSOR: "S",
  TERRAIN_DESTABILIZER: "D",
  WEATHER_CONTROL: "W",
  BIOSPHERE_ENGINE: "BIO",
  MISSILE_LAUNCHER: "M",
  EMP_CANNON: "EMP",
  METAL_MARINE_BASE: "B",
  AA_GUN: "A",
  GUN_TURRET: "T",
  LAND_MINE: "*",
};

const drawBuilding = (ctx: CanvasRenderingContext2D, b: Building, hidden: boolean, now: number) => {
  if (hidden) return;
  const { x: cx, y: cy } = tileToWorld(b.side, b.pos.x, b.pos.y);
  const color = buildingFill[b.type] ?? "#22c55e";
  const spriteKey = buildingSpriteKey(b, now);
  if (spriteManager.draw(ctx, spriteKey, cx, cy, { scale: TILE_PX / 64 })) {
    // Sprite rendered successfully; overlays below still show EMP/progress/HP.
  } else if (b.type === "HQ") {
    drawHQGlyph(ctx, cx, cy, color);
  } else if (b.type === "LAND_MINE") {
    if (b.side === "PLAYER") {
      ctx.fillStyle = "rgba(100,116,139,0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(cx - 14, cy - 14, 28, 28);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.strokeRect(cx - 14 + 0.5, cy - 14 + 0.5, 27, 27);
    ctx.fillStyle = "#020617";
    ctx.font = "bold 14px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(buildingGlyph[b.type] ?? "?", cx, cy + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  if ((b.disabledUntil ?? 0) > now) {
    ctx.strokeStyle = "rgba(34,211,238,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#67e8f9";
    ctx.font = "bold 7px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("EMP", cx, cy - 18);
    ctx.textAlign = "start";
  }

  // HP bar
  if (b.hp < b.maxHp) {
    const w = 28;
    const h = 3;
    const ratio = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(cx - w / 2, cy + 16, w, h);
    ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillRect(cx - w / 2, cy + 16, w * ratio, h);
  }
  // Build progress
  if (b.buildTimeRemaining > 0 && b.buildTimeTotal > 0) {
    const w = 28;
    const h = 3;
    const ratio = 1 - b.buildTimeRemaining / b.buildTimeTotal;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(cx - w / 2, cy + 21, w, h);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(cx - w / 2, cy + 21, w * ratio, h);
  }
};

const drawProjectile = (ctx: CanvasRenderingContext2D, p: Projectile) => {
  // Smoke trail
  for (let i = 0; i < 8; i++) {
    const tt = Math.max(0, p.progress - i * 0.025);
    const tx = p.startWX + (p.targetWX - p.startWX) * tt;
    const ty = p.startWY + (p.targetWY - p.startWY) * tt - Math.sin(tt * Math.PI) * 220;
    ctx.fillStyle = `rgba(148,163,184,${0.05 * (8 - i)})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 3 + i * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const cur = projectileCurrentPos(p);
  const color =
    p.type === "TRANSPORT_POD"
      ? "#fbbf24"
      : p.type === "EMP"
      ? "#22d3ee"
      : p.type === "TUNNEL_BUSTER"
      ? "#f59e0b"
      : p.type === "DUMMY"
      ? p.falseSignature ? "#a855f7" : "#94a3b8"
      : p.type === "AA"
      ? "#38bdf8"
      : p.owner === "PLAYER"
      ? "#22c55e"
      : "#f87171";
  ctx.fillStyle = color;
  ctx.beginPath();
  if (p.type === "TRANSPORT_POD") {
    ctx.fillRect(cur.x - 5, cur.y - 8, 10, 16);
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(cur.x - 3, cur.y - 6, 6, 4);
  } else {
    ctx.arc(cur.x, cur.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${color}99`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const drawMech = (ctx: CanvasRenderingContext2D, m: Mech) => {
  const c = m.owner === "PLAYER" ? "#22c55e" : "#f87171";
  const underground = (m.layer ?? "SURFACE") === "UNDERGROUND";
  ctx.globalAlpha = underground ? 0.62 : 1;
  if (underground) {
    ctx.strokeStyle = m.detectedUntil ? "#fbbf24" : "rgba(251,191,36,0.45)";
    ctx.beginPath();
    ctx.arc(m.pos.x, m.pos.y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = c;
  ctx.fillRect(m.pos.x - 6, m.pos.y - 8, 12, 12);
  ctx.fillRect(m.pos.x - 4, m.pos.y + 4, 3, 6);
  ctx.fillRect(m.pos.x + 1, m.pos.y + 4, 3, 6);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(m.pos.x - 2, m.pos.y - 5, 4, 2);
  // hp
  if (m.hp < m.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(m.pos.x - 8, m.pos.y - 14, 16, 2);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(m.pos.x - 8, m.pos.y - 14, 16 * (m.hp / m.maxHp), 2);
  }
  ctx.globalAlpha = 1;
};

const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
  const lifeRatio = 1 - p.life / p.maxLife;
  ctx.globalAlpha = Math.max(0, lifeRatio);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, p.size * lifeRatio, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawSeaBetween = (ctx: CanvasRenderingContext2D, t: number) => {
  const x = ISLAND_PX_W;
  const sea = ctx.createLinearGradient(x, 0, x + SKY_GAP_PX, ISLAND_PX_H);
  sea.addColorStop(0, "#020617");
  sea.addColorStop(0.22, "#062040");
  sea.addColorStop(0.52, "#082f55");
  sea.addColorStop(0.82, "#07162c");
  sea.addColorStop(1, "#020617");
  ctx.fillStyle = sea;
  ctx.fillRect(x, 0, SKY_GAP_PX, ISLAND_PX_H);

  ctx.fillStyle = "rgba(2,6,23,0.28)";
  ctx.fillRect(x, 0, 10, ISLAND_PX_H);
  ctx.fillRect(x + SKY_GAP_PX - 10, 0, 10, ISLAND_PX_H);

  for (let i = 0; i < 18; i++) {
    const yy = (i * 39 + ((t * 18) % 39)) % ISLAND_PX_H;
    const waveW = 36 + (i % 5) * 12;
    const waveX = x + 14 + ((i * 29 + t * 10) % Math.max(1, SKY_GAP_PX - waveW - 28));
    ctx.strokeStyle = `rgba(125,211,252,${0.08 + 0.04 * Math.sin(t * 1.4 + i)})`;
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(waveX, yy);
    ctx.bezierCurveTo(waveX + waveW * 0.3, yy - 7, waveX + waveW * 0.66, yy + 7, waveX + waveW, yy - 2);
    ctx.stroke();
  }

  const haze = ctx.createLinearGradient(0, 0, 0, ISLAND_PX_H);
  haze.addColorStop(0, "rgba(186,230,253,0.08)");
  haze.addColorStop(0.45, "rgba(14,165,233,0)");
  haze.addColorStop(1, "rgba(2,6,23,0.32)");
  ctx.fillStyle = haze;
  ctx.fillRect(x, 0, SKY_GAP_PX, ISLAND_PX_H);

  for (let i = 0; i < 24; i++) {
    const yy = (i * 23 + ((t * 28) % 46)) % ISLAND_PX_H;
    ctx.fillStyle = `rgba(56,189,248,${0.035 + 0.035 * Math.sin(t + i)})`;
    ctx.fillRect(x + 7 + ((i * 17) % Math.max(1, SKY_GAP_PX - 14)), yy, 2, 2);
  }
  ctx.font = "10px 'Space Mono', monospace";
  ctx.fillStyle = "rgba(56,189,248,0.45)";
  ctx.textAlign = "center";
  ctx.fillText("- SECTOR 7 ATLANTIC OPS -", x + SKY_GAP_PX / 2, 16);
  ctx.fillText("// CONTESTED AIRSPACE //", x + SKY_GAP_PX / 2, ISLAND_PX_H - 8);
  ctx.textAlign = "start";
};

const drawWeatherOverlay = (ctx: CanvasRenderingContext2D, state: RuntimeState, t: number) => {
  const weather = state.weatherActive;
  if (!weather) return;
  const age = state.elapsed - weather.startedAt;
  const fade = Math.min(1, age / 2, (weather.duration - age) / 2);
  if (fade <= 0) return;
  ctx.save();
  if (weather.type === "DUST_STORM") {
    ctx.fillStyle = `rgba(180,83,9,${0.08 * fade})`;
    ctx.fillRect(0, 0, WORLD_W, ISLAND_PX_H);
    ctx.strokeStyle = `rgba(251,191,36,${0.18 * fade})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = ((i * 31 + t * 70) % ISLAND_PX_H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y - 42);
      ctx.stroke();
    }
  } else if (weather.type === "FLOOD") {
    ctx.fillStyle = `rgba(14,165,233,${0.07 * fade})`;
    ctx.fillRect(0, 0, WORLD_W, ISLAND_PX_H);
    ctx.strokeStyle = `rgba(125,211,252,${0.2 * fade})`;
    for (let i = 0; i < 10; i++) {
      const y = ((i * 43 + t * 24) % ISLAND_PX_H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y + Math.sin(t + i) * 8);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = `rgba(250,204,21,${0.18 * fade})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 137 + t * 15) % WORLD_W);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(t * 6 + i) * 16, ISLAND_PX_H);
      ctx.stroke();
    }
  }
  ctx.restore();
};

const drawPlacementGhost = (
  ctx: CanvasRenderingContext2D,
  state: RuntimeState,
  hover: { side: Owner; x: number; y: number } | null
) => {
  if (!hover) return;
  if (state.selectedBuild && hover.side === "PLAYER") {
    const px = islandOriginX("PLAYER") + hover.x * TILE_PX;
    const py = hover.y * TILE_PX;
    const tile = state.playerIsland[hover.y * GRID_W + hover.x];
    const ok =
      tile &&
      tile.terrain !== "WATER" &&
      tile.terrain !== "MOUNTAIN" &&
      !(tile.terrain === "FOREST" && state.selectedBuild !== "LAND_MINE") &&
      !state.buildings.some(
        (b) => b.side === "PLAYER" && b.pos.x === hover.x && b.pos.y === hover.y && b.hp > 0
      );
    ctx.strokeStyle = ok ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
    ctx.fillStyle = ok ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
    ctx.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
  }
  if (state.selectedWeapon && hover.side === "ENEMY") {
    const px = islandOriginX("ENEMY") + hover.x * TILE_PX;
    const py = hover.y * TILE_PX;
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
    // crosshair
    ctx.beginPath();
    ctx.moveTo(px + TILE_PX / 2, py + 2);
    ctx.lineTo(px + TILE_PX / 2, py + TILE_PX - 2);
    ctx.moveTo(px + 2, py + TILE_PX / 2);
    ctx.lineTo(px + TILE_PX - 2, py + TILE_PX / 2);
    ctx.stroke();
  }
};

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  state: RuntimeState,
  hover: { side: Owner; x: number; y: number } | null,
  time: number
) => {
  // Shake
  ctx.save();
  if (state.shake > 0) {
    const sx = (Math.random() - 0.5) * 8 * state.shake;
    const sy = (Math.random() - 0.5) * 8 * state.shake;
    ctx.translate(sx, sy);
  }

  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const underground = state.viewLayer === "UNDERGROUND";
  drawIsland(ctx, "PLAYER", state.playerIsland, null, time, underground, state.elapsed);
  drawIsland(ctx, "ENEMY", state.enemyIsland, state.fogEnemy, time, underground, state.elapsed);
  drawSeaBetween(ctx, time);

  // Buildings
  for (const b of state.buildings) {
    const hidden =
      b.side === "ENEMY" && !state.fogEnemy[b.pos.y * GRID_W + b.pos.x];
    drawBuilding(ctx, b, hidden, state.elapsed);
  }
  // Mechs
  for (const m of state.mechs) {
    const isUnderground = (m.layer ?? "SURFACE") === "UNDERGROUND";
    if (!isUnderground || underground || (m.detectedUntil ?? 0) > state.elapsed) drawMech(ctx, m);
  }
  // Projectiles
  for (const p of state.projectiles) drawProjectile(ctx, p);
  // Particles on top
  for (const p of state.particles) drawParticle(ctx, p);

  drawWeatherOverlay(ctx, state, time);

  drawPlacementGhost(ctx, state, hover);

  ctx.restore();
};
