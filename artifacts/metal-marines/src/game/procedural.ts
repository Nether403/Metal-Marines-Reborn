import { GRID_H, GRID_W } from "./constants";
import { findPath } from "./pathfinding";
import { createRng, hashSeed } from "./rng";
import type { MissionDef, Position, TerrainType, Tile } from "./types";

interface ProceduralOptions {
  seed: string;
  difficulty: number;
  title?: string;
}

interface IslandResult {
  tiles: Tile[];
  hq: Position;
  validation: string[];
}

const tileIndex = (x: number, y: number): number => y * GRID_W + x;

const buildTiles = (terrain: TerrainType[]): Tile[] =>
  terrain.map((t, i) => ({ x: i % GRID_W, y: Math.floor(i / GRID_W), terrain: t }));

const isEdge = (x: number, y: number): boolean =>
  x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;

const countTerrain = (tiles: Tile[], terrain: TerrainType): number =>
  tiles.filter((t) => t.terrain === terrain).length;

const nearestBuildable = (tiles: Tile[], origin: Position): Position => {
  const candidates = tiles
    .filter((t) => t.terrain === "GRASS")
    .map((t) => ({ x: t.x, y: t.y, d: Math.abs(t.x - origin.x) + Math.abs(t.y - origin.y) }))
    .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const first = candidates[0] ?? { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) };
  return { x: first.x, y: first.y };
};

const validateIsland = (tiles: Tile[], hq: Position): string[] => {
  const notes: string[] = [];
  const buildable = tiles.filter((t) => t.terrain === "GRASS" || t.terrain === "FOREST").length;
  if (buildable >= 52) notes.push("buildable-area-ok");
  const water = countTerrain(tiles, "WATER");
  if (water >= GRID_W * 2 + GRID_H * 2 - 4) notes.push("coastline-ok");
  const probes: Position[] = [
    { x: 2, y: 2 },
    { x: GRID_W - 3, y: 2 },
    { x: 2, y: GRID_H - 3 },
    { x: GRID_W - 3, y: GRID_H - 3 },
  ].map((p) => nearestBuildable(tiles, p));
  const reachable = probes.filter((p) => findPath(tiles, [], "PLAYER", hq, [p]).length > 0).length;
  if (reachable >= 3) notes.push("routes-ok");
  if (countTerrain(tiles, "MOUNTAIN") <= 11) notes.push("chokepoints-ok");
  return notes;
};

const generateIsland = (seed: number, mirror = false): IslandResult => {
  const rng = createRng(seed);
  const randInt = (min: number, maxExclusive: number): number =>
    min + Math.floor(rng.next() * Math.max(0, maxExclusive - min));
  const terrain = new Array<TerrainType>(GRID_W * GRID_H).fill("GRASS");

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (isEdge(x, y)) terrain[tileIndex(x, y)] = "WATER";
    }
  }

  const hillCount = 5 + randInt(0, 5);
  for (let i = 0; i < hillCount; i++) {
    const x = randInt(2, GRID_W - 2);
    const y = randInt(2, GRID_H - 2);
    terrain[tileIndex(x, y)] = rng.next() < 0.45 ? "MOUNTAIN" : "FOREST";
    if (rng.next() < 0.35) {
      const nx = Math.max(1, Math.min(GRID_W - 2, x + (rng.next() < 0.5 ? -1 : 1)));
      terrain[tileIndex(nx, y)] = "FOREST";
    }
  }

  for (let i = 0; i < 6; i++) {
    const x = randInt(1, GRID_W - 1);
    const y = randInt(1, GRID_H - 1);
    if (rng.next() < 0.22) terrain[tileIndex(x, y)] = "WATER";
  }

  const center = mirror ? { x: 6, y: 5 } : { x: 5, y: 5 };
  for (let y = center.y - 1; y <= center.y + 1; y++) {
    for (let x = center.x - 1; x <= center.x + 1; x++) {
      if (x > 0 && y > 0 && x < GRID_W - 1 && y < GRID_H - 1) terrain[tileIndex(x, y)] = "GRASS";
    }
  }

  const tiles = buildTiles(terrain);
  const hq = nearestBuildable(tiles, center);
  return { tiles, hq, validation: validateIsland(tiles, hq) };
};

export const createProceduralMission = ({ seed, difficulty, title }: ProceduralOptions): MissionDef => {
  const baseSeed = hashSeed(seed);
  let player = generateIsland(baseSeed, false);
  let enemy = generateIsland(baseSeed ^ 0x9e3779b9, true);

  for (let attempts = 1; attempts < 16; attempts++) {
    if (player.validation.length >= 4 && enemy.validation.length >= 4) break;
    player = generateIsland(baseSeed + attempts * 101, false);
    enemy = generateIsland((baseSeed ^ 0x9e3779b9) + attempts * 211, true);
  }

  return {
    id: `skirmish-${seed}`,
    index: 7,
    title: title ?? "Procedural Skirmish",
    commanderId: "null_",
    objective: "Win a generated island war. Destroy the enemy Headquarters.",
    briefing:
      `Generated battlefield seed ${seed}. Terrain validation: ` +
      [...player.validation, ...enemy.validation].join(", "),
    difficulty,
    playerIsland: player.tiles,
    enemyIsland: enemy.tiles,
    playerStartHQ: player.hq,
    enemyStartHQ: enemy.hq,
    enemyAggression: Math.min(1, 0.45 + difficulty * 0.08),
    enemyEcoBias: Math.min(0.8, 0.45 + difficulty * 0.04),
    startFunds: 1200 + difficulty * 80,
    startEnergy: 520 + difficulty * 35,
    isProcedural: true,
    proceduralMeta: {
      seed,
      validation: [...player.validation, ...enemy.validation],
    },
  };
};
