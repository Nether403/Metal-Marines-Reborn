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
  BuildingType,
  Mech,
  Owner,
  Particle,
  Projectile,
  RuntimeState,
  Tile,
} from "./types";
import { islandOriginX, isBuildable, projectileCurrentPos, tileToWorld } from "./engine";
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
  // Dense canopy clumps that read as trees at combat zoom (fallback path).
  const canopy = [
    [0.16, 0.18, 8],
    [0.42, 0.14, 9],
    [0.7, 0.2, 8],
    [0.28, 0.38, 10],
    [0.56, 0.36, 11],
    [0.8, 0.42, 9],
    [0.14, 0.58, 9],
    [0.4, 0.62, 10],
    [0.66, 0.58, 11],
    [0.22, 0.82, 9],
    [0.5, 0.84, 10],
    [0.78, 0.8, 9],
  ] as const;
  for (const [rx, ry, r] of canopy) {
    const jitter = terrainHash(x, y, rx + ry);
    const cx = px + TILE_PX * rx + (jitter - 0.5) * 4;
    const cy = py + TILE_PX * ry + (jitter - 0.5) * 3;
    // shadow / trunk stub
    ctx.fillStyle = "rgba(6,18,10,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.45, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(62,44,28,0.75)";
    ctx.fillRect(cx - 1, cy + r * 0.15, 2, r * 0.35);
    // silhouette + lit crown
    const grad = ctx.createRadialGradient(cx - 3, cy - 4, 1.5, cx, cy, r);
    grad.addColorStop(0, "#86efac");
    grad.addColorStop(0.35, "#22c55e");
    grad.addColorStop(0.7, "#166534");
    grad.addColorStop(1, "#052e16");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // scallop lobes so crowns aren't soft discs
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + jitter;
      const lx = cx + Math.cos(ang) * r * 0.55;
      const ly = cy + Math.sin(ang) * r * 0.48;
      ctx.fillStyle = i % 2 === 0 ? "rgba(34,102,48,0.85)" : "rgba(20,70,34,0.9)";
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(2.5, r * 0.38), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(187,247,208,0.55)";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - r * 0.45, Math.max(1.5, r * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
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
        terrain === "WATER" ? "rgba(224,242,254,0.55)" : "rgba(254,240,138,0.45)",
        terrain === "WATER" ? 2.5 : 5
      );
      // secondary foam line for remake shoreline read
      if (terrain !== "WATER") {
        drawEdgeLine(ctx, px, py, edge, "rgba(255,255,255,0.22)", 1.5);
      }
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

const mechSpriteKey = (m: Mech, time: number): string | null => {
  const owner = m.owner === "PLAYER" ? "player" : "enemy";
  const stateKey =
    m.state === "ATTACKING" ? "attacking" :
    m.state === "LANDING" ? "landing" :
    m.state === "WALKING" ? "walking" :
    "idle";
  const animated = spriteManager.animationFrame(`unit.mech.${owner}.${stateKey}`, time * 1000);
  if (animated) return animated;
  // Static fallbacks for state names that map onto atlas frames
  if (stateKey === "attacking") return `unit.mech.${owner}.fighting`;
  if (stateKey === "landing") return `unit.mech.${owner}.boarding`;
  return `unit.mech.${owner}.${stateKey}`;
};

const factionVisuals: Record<Owner, { primary: string; secondary: string; trim: string; glow: string; glass: string }> = {
  PLAYER: {
    primary: "#ef4444",
    secondary: "#f8fafc",
    trim: "#991b1b",
    glow: "rgba(248,113,113,0.55)",
    glass: "#bae6fd",
  },
  ENEMY: {
    primary: "#d97706",
    secondary: "#7c3aed",
    trim: "#451a03",
    glow: "rgba(216,180,254,0.48)",
    glass: "#fde68a",
  },
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
      // Per-tile grass micro-variation so the island doesn't read as flat green paper
      if (tile.terrain === "GRASS") {
        const n = ((x * 17 + y * 31) % 7) / 7;
        ctx.fillStyle = `rgba(20,60,30,${0.04 + n * 0.07})`;
        ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
      }
      // Animated water shimmer / foam (battlefeel without new assets)
      if (tile.terrain === "WATER") {
        const phase = t * 2.2 + x * 0.7 + y * 0.55;
        ctx.fillStyle = `rgba(186,230,253,${0.08 + 0.07 * (0.5 + 0.5 * Math.sin(phase))})`;
        ctx.fillRect(px + 6, py + 10 + ((Math.sin(phase) + 1) * 6), TILE_PX - 18, 2);
        ctx.fillStyle = `rgba(125,211,252,${0.06 + 0.05 * (0.5 + 0.5 * Math.cos(phase * 1.3))})`;
        ctx.fillRect(px + 10, py + 28 + ((Math.cos(phase) + 1) * 5), TILE_PX - 22, 2);
      }
      drawTerrainTransitions(ctx, tiles, x, y, px, py, tile.terrain);

      // Soft seams — quieter than old neon grid
      ctx.strokeStyle =
        tile.terrain === "WATER"
          ? "rgba(125,211,252,0.1)"
          : tile.terrain === "GRASS"
            ? "rgba(15,23,42,0.16)"
            : "rgba(34,197,94,0.08)";
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
          // Softer fog — keeps hostile island shape readable like classic MM radar fog
          ctx.fillStyle = "rgba(2,6,23,0.72)";
          ctx.fillRect(px, py, TILE_PX, TILE_PX);
          ctx.strokeStyle = "rgba(56,189,248,0.1)";
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_PX - 1, TILE_PX - 1);
        }
      }
    }
  }
};

const buildingFill: Record<BuildingType, string> = {
  HQ: "#ef4444",
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
  ICBM_SILO: "#fb7185",
  EMP_CANNON: "#22d3ee",
  METAL_MARINE_BASE: "#ef4444",
  AA_GUN: "#a3e635",
  GUN_TURRET: "#fb923c",
  GUN_POD: "#f87171",
  LAND_MINE: "#64748b",
  FACTORY: "#eab308",
  DUMMY_BASE: "#94a3b8",
  DUMMY_COVER: "#64748b",
};

const buildingGlyph: Record<BuildingType, string> = {
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
  ICBM_SILO: "ICB",
  EMP_CANNON: "EMP",
  METAL_MARINE_BASE: "B",
  AA_GUN: "A",
  GUN_TURRET: "T",
  GUN_POD: "GP",
  LAND_MINE: "*",
  FACTORY: "F",
  DUMMY_BASE: "DB",
  DUMMY_COVER: "DC",
};

const drawRectCentered = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string | CanvasGradient | CanvasPattern,
  stroke = "rgba(2,6,23,0.72)"
) => {
  ctx.fillStyle = fill;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
};

const drawIsoPlatform = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  visuals: (typeof factionVisuals)[Owner],
  accent: string
) => {
  const y = cy + 15;
  ctx.fillStyle = "rgba(2,6,23,0.42)";
  ctx.beginPath();
  ctx.ellipse(cx, y + 6, w * 0.58, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = visuals.trim;
  ctx.beginPath();
  ctx.moveTo(cx, y - h / 2);
  ctx.lineTo(cx + w / 2, y);
  ctx.lineTo(cx, y + h / 2);
  ctx.lineTo(cx - w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(203,213,225,0.22)";
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.globalAlpha *= 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, y - h / 2 + 4);
  ctx.lineTo(cx + w / 2 - 8, y);
  ctx.lineTo(cx, y + h / 2 - 4);
  ctx.lineTo(cx - w / 2 + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha /= 0.28;
};

const drawConstructionScaffold = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
  ctx.save();
  ctx.strokeStyle = "rgba(125,211,252,0.68)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(cx - 21, cy - 23, 42, 42);
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(56,189,248,${0.14 + progress * 0.18})`;
  ctx.fillRect(cx - 18, cy + 17 - 34 * progress, 36, 34 * progress);
  ctx.strokeStyle = "rgba(226,232,240,0.38)";
  ctx.beginPath();
  ctx.moveTo(cx - 23, cy + 19);
  ctx.lineTo(cx + 23, cy - 23);
  ctx.moveTo(cx + 23, cy + 19);
  ctx.lineTo(cx - 23, cy - 23);
  ctx.stroke();
  ctx.restore();
};

const drawBuildingLabel = (ctx: CanvasRenderingContext2D, cx: number, cy: number, type: BuildingType) => {
  ctx.fillStyle = "rgba(2,6,23,0.76)";
  ctx.fillRect(cx - 13, cy - 5, 26, 11);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 8px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(buildingGlyph[type] ?? "?", cx, cy + 1);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
};

const drawProceduralBuilding = (ctx: CanvasRenderingContext2D, b: Building, cx: number, cy: number, now: number) => {
  const visuals = factionVisuals[b.side];
  const accent = buildingFill[b.type] ?? visuals.primary;
  const damaged = b.hp / b.maxHp < 0.35;
  const constructing = b.buildTimeRemaining > 0 && b.buildTimeTotal > 0;
  const disabled = (b.disabledUntil ?? 0) > now;
  const progress = constructing ? 1 - b.buildTimeRemaining / b.buildTimeTotal : 1;

  ctx.save();
  if (damaged) ctx.globalAlpha *= 0.82;
  drawIsoPlatform(ctx, cx, cy, b.type === "HQ" ? 58 : 46, b.type === "HQ" ? 24 : 18, visuals, accent);

  const metal = ctx.createLinearGradient(cx - 20, cy - 28, cx + 20, cy + 20);
  metal.addColorStop(0, visuals.secondary);
  metal.addColorStop(0.36, accent);
  metal.addColorStop(1, "#020617");

  switch (b.type) {
    case "HQ":
      drawRectCentered(ctx, cx, cy - 7, 38, 32, metal, visuals.glow);
      drawRectCentered(ctx, cx, cy - 25, 22, 12, visuals.secondary, "rgba(2,6,23,0.7)");
      drawRectCentered(ctx, cx - 13, cy - 3, 7, 17, visuals.glass);
      drawRectCentered(ctx, cx + 13, cy - 3, 7, 17, visuals.glass);
      break;
    case "ENERGY_PLANT":
      drawRectCentered(ctx, cx - 10, cy - 5, 18, 31, metal);
      drawRectCentered(ctx, cx + 11, cy - 4, 15, 35, "#083344", "rgba(103,232,249,0.7)");
      ctx.strokeStyle = "rgba(103,232,249,0.85)";
      ctx.beginPath();
      ctx.arc(cx + 11, cy - 5, 11, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "SUPPLY_DEPOT":
      drawRectCentered(ctx, cx - 10, cy - 3, 20, 24, metal);
      drawRectCentered(ctx, cx + 11, cy - 1, 18, 20, "#713f12", "rgba(250,204,21,0.55)");
      drawRectCentered(ctx, cx, cy - 18, 34, 7, visuals.secondary);
      break;
    case "RADAR":
    case "RADAR_JAMMER":
      drawRectCentered(ctx, cx, cy + 1, 20, 24, metal);
      ctx.strokeStyle = b.type === "RADAR" ? "rgba(125,211,252,0.86)" : "rgba(216,180,254,0.86)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 18, 15, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 15);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();
      break;
    case "MISSILE_LAUNCHER":
    case "ICBM_SILO":
    case "EMP_CANNON":
      drawRectCentered(ctx, cx, cy + 1, b.type === "ICBM_SILO" ? 44 : 32, b.type === "ICBM_SILO" ? 28 : 20, metal);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 25);
      ctx.lineTo(cx + 8, cy - 2);
      ctx.lineTo(cx - 14, cy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(2,6,23,0.68)";
      ctx.stroke();
      break;
    case "METAL_MARINE_BASE":
    case "FACTORY":
      drawRectCentered(ctx, cx, cy + 1, 38, 22, metal);
      drawRectCentered(ctx, cx, cy - 13, 24, 12, "#111827", visuals.glow);
      drawRectCentered(ctx, cx - 10, cy + 4, 7, 13, visuals.secondary);
      drawRectCentered(ctx, cx + 10, cy + 4, 7, 13, visuals.secondary);
      break;
    case "AA_GUN":
    case "GUN_TURRET":
    case "GUN_POD":
      drawRectCentered(ctx, cx, cy + 2, 22, 18, metal);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "DUMMY_BASE":
      drawRectCentered(ctx, cx, cy - 7, 38, 32, "rgba(148,163,184,0.35)", visuals.secondary);
      drawBuildingLabel(ctx, cx, cy - 4, b.type);
      break;
    case "DUMMY_COVER":
      ctx.strokeStyle = visuals.secondary;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 18, cy - 18, 36, 28);
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 12);
      ctx.lineTo(cx + 14, cy + 6);
      ctx.moveTo(cx + 14, cy - 12);
      ctx.lineTo(cx - 14, cy + 6);
      ctx.stroke();
      break;
    case "LAND_MINE":
      ctx.fillStyle = b.side === "PLAYER" ? "rgba(148,163,184,0.76)" : "rgba(15,23,42,0.36)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    default:
      drawRectCentered(ctx, cx, cy, 31, 29, metal);
      drawRectCentered(ctx, cx, cy - 18, 16, 8, accent, visuals.glow);
      break;
  }

  if (constructing) drawConstructionScaffold(ctx, cx, cy, progress);
  if (damaged) {
    ctx.strokeStyle = "rgba(2,6,23,0.85)";
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 18);
    ctx.lineTo(cx - 2, cy - 8);
    ctx.lineTo(cx - 7, cy + 5);
    ctx.moveTo(cx + 12, cy - 13);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(71,85,105,0.36)";
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 20, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (disabled) {
    ctx.strokeStyle = "rgba(34,211,238,0.5)";
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 23);
    ctx.lineTo(cx + 18, cy + 15);
    ctx.moveTo(cx + 18, cy - 23);
    ctx.lineTo(cx - 18, cy + 15);
    ctx.stroke();
  }
  drawBuildingLabel(ctx, cx, cy + 8, b.type);
  ctx.restore();
};

const drawEntityShadow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) => {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawBuilding = (ctx: CanvasRenderingContext2D, b: Building, hidden: boolean, now: number) => {
  if (hidden) return;
  const { x: cx, y: cy } = tileToWorld(b.side, b.pos.x, b.pos.y);
  const spriteKey = buildingSpriteKey(b, now);
  // Classic Metal Marines pads under structures — sells "built base" density.
  drawEntityShadow(ctx, cx, cy, b.type === "HQ" || b.type === "ICBM_SILO" ? 22 : 16, 8);
  ctx.save();
  ctx.strokeStyle = b.side === "PLAYER" ? "rgba(248,113,113,0.35)" : "rgba(216,180,254,0.3)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - TILE_PX * 0.42, cy - TILE_PX * 0.2, TILE_PX * 0.84, TILE_PX * 0.55);
  ctx.restore();

  // HQ reads largest (classic MM command presence); other structures slightly overscale.
  const scale =
    (TILE_PX / 64) *
    (b.type === "HQ" || b.type === "ICBM_SILO" ? 1.75 : b.type === "METAL_MARINE_BASE" ? 1.6 : 1.52);
  if (spriteManager.draw(ctx, spriteKey, cx, cy, { scale })) {
    // Sprite rendered successfully; overlays below still show EMP/progress/HP.
  } else {
    drawProceduralBuilding(ctx, b, cx, cy, now);
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

const projectileColor = (p: Projectile): string =>
  p.type === "TRANSPORT_POD"
    ? "#fbbf24"
    : p.type === "EMP"
    ? "#22d3ee"
    : p.type === "TUNNEL_BUSTER"
    ? "#f59e0b"
    : p.type === "DUMMY"
    ? p.falseSignature
      ? "#a855f7"
      : "#94a3b8"
    : p.type === "AA"
    ? "#38bdf8"
    : p.owner === "PLAYER"
    ? "#ef4444"
    : "#f59e0b";

const drawOrientedProjectileBody = (
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  x: number,
  y: number,
  color: string
) => {
  const angle = Math.atan2(p.targetWY - p.startWY, p.targetWX - p.startWX);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (p.type === "TRANSPORT_POD") {
    const pod = ctx.createLinearGradient(-9, -13, 10, 15);
    pod.addColorStop(0, "#fde68a");
    pod.addColorStop(0.42, color);
    pod.addColorStop(1, "#7c2d12");
    ctx.fillStyle = pod;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(5, -10);
    ctx.lineTo(-12, -7);
    ctx.lineTo(-12, 7);
    ctx.lineTo(5, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(2,6,23,0.72)";
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-8, -4, 9, 8);
  } else if (p.type === "EMP") {
    ctx.fillStyle = "rgba(34,211,238,0.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.lineTo(-3, -5);
    ctx.lineTo(3, 5);
    ctx.lineTo(12, -3);
    ctx.stroke();
  } else {
    const body = ctx.createLinearGradient(-13, -5, 14, 5);
    body.addColorStop(0, "#0f172a");
    body.addColorStop(0.48, color);
    body.addColorStop(1, "#f8fafc");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(3, -5);
    ctx.lineTo(-13, -4);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-13, 4);
    ctx.lineTo(3, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(2,6,23,0.7)";
    ctx.stroke();
    if (p.type === "DUMMY") {
      ctx.strokeStyle = "rgba(216,180,254,0.9)";
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-9, -7, 16, 14);
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
};

const drawProjectile = (ctx: CanvasRenderingContext2D, p: Projectile) => {
  const cur = projectileCurrentPos(p);
  const color = projectileColor(p);
  const angle = Math.atan2(p.targetWY - p.startWY, p.targetWX - p.startWX);

  // Smoke trail
  for (let i = 0; i < 12; i++) {
    const tt = Math.max(0, p.progress - i * 0.025);
    const trail = projectileCurrentPos({ ...p, progress: tt });
    const drift = Math.sin(tt * Math.PI * 8 + i) * (i * 0.35);
    const radius = 2 + i * 0.55;
    const alpha = 0.11 * (1 - i / 12);
    const smoke = ctx.createRadialGradient(trail.x + drift, trail.y, 1, trail.x + drift, trail.y, radius * 2.6);
    smoke.addColorStop(0, `rgba(226,232,240,${alpha})`);
    smoke.addColorStop(0.55, `rgba(100,116,139,${alpha * 0.55})`);
    smoke.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = smoke;
    ctx.beginPath();
    ctx.arc(trail.x + drift, trail.y, radius * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const spriteKey =
    p.type === "ICBM" ? "projectile.icbm" :
    p.type === "EMP" ? "projectile.emp" :
    p.type === "TRANSPORT_POD" ? "projectile.transport_pod" :
    p.type === "TUNNEL_BUSTER" ? "projectile.tunnel_buster" :
    p.type === "DUMMY" ? "projectile.dummy" :
    p.type === "AA" ? "projectile.aa" :
    "";

  if (spriteKey && spriteManager.draw(ctx, spriteKey, cur.x, cur.y, { rotation: angle + Math.PI / 2, scale: 1 })) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = p.type === "EMP" ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.arc(cur.x, cur.y, p.type === "EMP" ? 17 : 10, 0, Math.PI * 2);
  ctx.stroke();
  drawOrientedProjectileBody(ctx, p, cur.x, cur.y, color);

  if (p.type !== "TRANSPORT_POD") {
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cur.x - Math.cos(angle) * 15, cur.y - Math.sin(angle) * 15);
    ctx.lineTo(cur.x - Math.cos(angle) * 25, cur.y - Math.sin(angle) * 25);
    ctx.stroke();
  }
  ctx.restore();
};

const drawProceduralMech = (ctx: CanvasRenderingContext2D, m: Mech) => {
  const visuals = factionVisuals[m.owner];
  const underground = (m.layer ?? "SURFACE") === "UNDERGROUND";
  const walkTick = m.state === "WALKING" ? Math.sin((m.pos.x + m.pos.y) * 0.12) : 0;
  const attackPose = m.state === "ATTACKING" ? 1 : 0;

  ctx.save();
  ctx.globalAlpha *= underground ? 0.62 : 1;
  if (underground) {
    ctx.strokeStyle = m.detectedUntil ? "#fbbf24" : "rgba(251,191,36,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.pos.x, m.pos.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(251,191,36,0.2)";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(m.pos.x - 17, m.pos.y + i * 6);
      ctx.lineTo(m.pos.x + 17, m.pos.y + i * 6);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(2,6,23,0.38)";
  ctx.beginPath();
  ctx.ellipse(m.pos.x, m.pos.y + 13, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(m.pos.x - 11, m.pos.y - 17, m.pos.x + 13, m.pos.y + 11);
  body.addColorStop(0, visuals.secondary);
  body.addColorStop(0.4, visuals.primary);
  body.addColorStop(1, visuals.trim);

  // legs
  drawRectCentered(ctx, m.pos.x - 6, m.pos.y + 8 + walkTick * 2, 5, 15, visuals.trim, "rgba(2,6,23,0.72)");
  drawRectCentered(ctx, m.pos.x + 6, m.pos.y + 8 - walkTick * 2, 5, 15, visuals.trim, "rgba(2,6,23,0.72)");
  drawRectCentered(ctx, m.pos.x - 7, m.pos.y + 17 + walkTick * 2, 9, 4, visuals.secondary, "rgba(2,6,23,0.72)");
  drawRectCentered(ctx, m.pos.x + 7, m.pos.y + 17 - walkTick * 2, 9, 4, visuals.secondary, "rgba(2,6,23,0.72)");

  // arms / weapon pods
  ctx.strokeStyle = visuals.trim;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(m.pos.x - 9, m.pos.y - 5);
  ctx.lineTo(m.pos.x - 18, m.pos.y + 2 + walkTick);
  ctx.moveTo(m.pos.x + 9, m.pos.y - 5);
  ctx.lineTo(m.pos.x + 20 + attackPose * 4, m.pos.y - 9 - attackPose * 5);
  ctx.stroke();

  ctx.fillStyle = body;
  ctx.fillRect(m.pos.x - 11, m.pos.y - 15, 22, 24);
  ctx.strokeStyle = "rgba(2,6,23,0.82)";
  ctx.lineWidth = 1.25;
  ctx.strokeRect(m.pos.x - 10.5, m.pos.y - 14.5, 21, 23);

  // cockpit/head
  drawRectCentered(ctx, m.pos.x, m.pos.y - 18, 13, 8, visuals.glass, "rgba(2,6,23,0.72)");
  ctx.fillStyle = visuals.secondary;
  ctx.fillRect(m.pos.x - 8, m.pos.y - 6, 16, 3);

  // weapon glow if attacking
  if (m.state === "ATTACKING") {
    ctx.fillStyle = visuals.glow;
    ctx.beginPath();
    ctx.arc(m.pos.x + 24, m.pos.y - 15, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = visuals.secondary;
    ctx.beginPath();
    ctx.moveTo(m.pos.x + 17, m.pos.y - 11);
    ctx.lineTo(m.pos.x + 28, m.pos.y - 17);
    ctx.stroke();
  }

  // hp
  if (m.hp < m.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(m.pos.x - 13, m.pos.y - 28, 26, 3);
    ctx.fillStyle = m.hp / m.maxHp > 0.35 ? "#22c55e" : "#ef4444";
    ctx.fillRect(m.pos.x - 13, m.pos.y - 28, 26 * (m.hp / m.maxHp), 3);
  }
  ctx.restore();
};

const drawMech = (ctx: CanvasRenderingContext2D, m: Mech, time: number) => {
  const spriteKey = mechSpriteKey(m, time);
  const underground = (m.layer ?? "SURFACE") === "UNDERGROUND";
  drawEntityShadow(ctx, m.pos.x, m.pos.y, 14, 6);
  const drew =
    spriteKey &&
    spriteManager.draw(ctx, spriteKey, m.pos.x, m.pos.y, {
      scale: (TILE_PX / 64) * 1.7,
      alpha: underground ? 0.62 : 1,
    });
  if (!drew) drawProceduralMech(ctx, m);

  // Original-game style unit callout
  ctx.save();
  ctx.font = "bold 8px 'Space Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(m.pos.x - 22, m.pos.y - 36, 44, 11);
  ctx.fillStyle = m.side === "PLAYER" ? "#fecaca" : "#fde68a";
  ctx.fillText("M.MARINE", m.pos.x, m.pos.y - 27);
  ctx.textAlign = "start";
  ctx.restore();

  if (m.hp < m.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(m.pos.x - 13, m.pos.y + 18, 26, 3);
    ctx.fillStyle = m.hp / m.maxHp > 0.35 ? "#22c55e" : "#ef4444";
    ctx.fillRect(m.pos.x - 13, m.pos.y + 18, 26 * (m.hp / m.maxHp), 3);
  }
};

const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
  if (p.fx) {
    const frame = spriteManager.animationFrame(`fx.${p.fx}`, p.life * 1000);
    if (frame && spriteManager.draw(ctx, frame, p.pos.x, p.pos.y, { scale: p.size / 48, alpha: Math.max(0, 1 - p.life / p.maxLife) })) {
      return;
    }
  }
  const lifeRatio = 1 - p.life / p.maxLife;
  const alpha = Math.max(0, lifeRatio);
  const radius = Math.max(1, p.size * lifeRatio);
  ctx.save();
  ctx.globalAlpha *= alpha;

  const blast = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, radius * 2.5);
  blast.addColorStop(0, "rgba(255,255,255,0.85)");
  blast.addColorStop(0.18, p.color);
  blast.addColorStop(0.58, "rgba(249,115,22,0.42)");
  blast.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = blast;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(248,250,252,${0.28 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, radius * 1.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(148,163,184,${0.18 * alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.256 + p.maxLife * 0.37;
    ctx.beginPath();
    ctx.moveTo(p.pos.x + Math.cos(angle) * radius * 0.6, p.pos.y + Math.sin(angle) * radius * 0.6);
    ctx.lineTo(p.pos.x + Math.cos(angle) * radius * 2.2, p.pos.y + Math.sin(angle) * radius * 2.2);
    ctx.stroke();
  }
  ctx.restore();
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
  // Vertical radar sweep across contested airspace
  const sweepX = x + ((t * 40) % SKY_GAP_PX);
  const sweep = ctx.createLinearGradient(sweepX - 24, 0, sweepX + 8, 0);
  sweep.addColorStop(0, "rgba(34,211,238,0)");
  sweep.addColorStop(0.7, "rgba(34,211,238,0.12)");
  sweep.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(x, 0, SKY_GAP_PX, ISLAND_PX_H);

  ctx.font = "10px 'Space Mono', monospace";
  ctx.fillStyle = "rgba(56,189,248,0.55)";
  ctx.textAlign = "center";
  ctx.fillText("- PACIFIC THEATER -", x + SKY_GAP_PX / 2, 16);
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
    const dust = ctx.createLinearGradient(0, 0, WORLD_W, ISLAND_PX_H);
    dust.addColorStop(0, `rgba(120,53,15,${0.05 * fade})`);
    dust.addColorStop(0.5, `rgba(251,191,36,${0.1 * fade})`);
    dust.addColorStop(1, `rgba(67,20,7,${0.09 * fade})`);
    ctx.fillStyle = dust;
    ctx.fillRect(0, 0, WORLD_W, ISLAND_PX_H);
    ctx.lineWidth = 1;
    for (let i = 0; i < 34; i++) {
      const y = ((i * 31 + t * 70) % ISLAND_PX_H);
      ctx.strokeStyle = `rgba(251,191,36,${(0.08 + (i % 5) * 0.018) * fade})`;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(WORLD_W + 40, y - 42 - (i % 4) * 6);
      ctx.stroke();
    }
  } else if (weather.type === "FLOOD") {
    ctx.fillStyle = `rgba(14,165,233,${0.1 * fade})`;
    ctx.fillRect(0, 0, WORLD_W, ISLAND_PX_H);
    for (let i = 0; i < 16; i++) {
      const y = ((i * 43 + t * 24) % ISLAND_PX_H);
      ctx.strokeStyle = `rgba(125,211,252,${(0.14 + (i % 3) * 0.04) * fade})`;
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(WORLD_W * 0.25, y + Math.sin(t + i) * 12, WORLD_W * 0.75, y - Math.cos(t + i) * 10, WORLD_W, y + Math.sin(t + i) * 8);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = `rgba(250,204,21,${0.025 * fade})`;
    ctx.fillRect(0, 0, WORLD_W, ISLAND_PX_H);
    for (let i = 0; i < 11; i++) {
      const x = ((i * 137 + t * 15) % WORLD_W);
      ctx.strokeStyle = `rgba(250,204,21,${(0.12 + (i % 3) * 0.04) * fade})`;
      ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(t * 6 + i) * 24, ISLAND_PX_H);
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
    const spec = BUILDINGS[state.selectedBuild];
    const fw = spec.footprintW ?? 1;
    const fh = spec.footprintH ?? 1;
    const px = islandOriginX("PLAYER") + hover.x * TILE_PX;
    const py = hover.y * TILE_PX;
    const ok = isBuildable(state.playerIsland, state.buildings, "PLAYER", state.selectedBuild, hover.x, hover.y);
    ctx.strokeStyle = ok ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(px + 4, py + 4, TILE_PX * fw - 8, TILE_PX * fh - 8);
    ctx.setLineDash([]);
    ctx.fillStyle = ok ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.16)";
    ctx.fillRect(px + 3, py + 3, TILE_PX * fw - 6, TILE_PX * fh - 6);
    ctx.strokeStyle = ok ? "rgba(125,211,252,0.48)" : "rgba(248,113,113,0.52)";
    for (let i = 0; i < 4; i++) {
      const sy = py + 10 + i * 11;
      ctx.beginPath();
      ctx.moveTo(px + 9, sy);
      ctx.lineTo(px + TILE_PX * fw - 9, sy);
      ctx.stroke();
    }
  }
  if (state.selectedWeapon && hover.side === "ENEMY") {
    const px = islandOriginX("ENEMY") + hover.x * TILE_PX;
    const py = hover.y * TILE_PX;
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
    ctx.setLineDash([]);
    // crosshair
    ctx.strokeStyle = "rgba(248,113,113,0.88)";
    ctx.beginPath();
    ctx.moveTo(px + TILE_PX / 2, py + 2);
    ctx.lineTo(px + TILE_PX / 2, py + TILE_PX - 2);
    ctx.moveTo(px + 2, py + TILE_PX / 2);
    ctx.lineTo(px + TILE_PX - 2, py + TILE_PX / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + TILE_PX / 2, py + TILE_PX / 2, TILE_PX * 0.28, 0, Math.PI * 2);
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
    if (!isUnderground || underground || (m.detectedUntil ?? 0) > state.elapsed) drawMech(ctx, m, time);
  }
  // Projectiles
  for (const p of state.projectiles) drawProjectile(ctx, p);
  // Particles on top
  for (const p of state.particles) drawParticle(ctx, p);

  drawWeatherOverlay(ctx, state, time);

  drawPlacementGhost(ctx, state, hover);

  ctx.restore();
};
