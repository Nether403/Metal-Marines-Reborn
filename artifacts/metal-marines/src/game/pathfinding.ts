import { GRID_H, GRID_W } from "./constants";
import type { Building, Owner, Position, Tile, TileLayer } from "./types";

const SURFACE_TERRAIN_COST: Record<Tile["terrain"], number> = {
  GRASS: 1,
  FOREST: 1.5,
  MOUNTAIN: Infinity,
  WATER: Infinity,
  TOXIC_SLUDGE: Infinity,
};

const UNDERGROUND_TERRAIN_COST: Record<Tile["terrain"], number> = {
  GRASS: 1,
  FOREST: 1.1,
  MOUNTAIN: 2.4,
  WATER: Infinity,
  TOXIC_SLUDGE: Infinity,
};

const NEIGHBORS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const pathTileIndex = (x: number, y: number): number => y * GRID_W + x;

const getPathTile = (tiles: Tile[], x: number, y: number): Tile | undefined =>
  tiles[pathTileIndex(x, y)];

interface PathNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: PathNode;
}

export const isTileInBounds = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;

export const terrainMoveCost = (
  tiles: Tile[],
  x: number,
  y: number,
  layer: TileLayer = "SURFACE",
  now = 0
): number => {
  const tile = getPathTile(tiles, x, y);
  if (!tile) return Infinity;
  if (layer === "UNDERGROUND") {
    if (!tile.tunnel?.open) return Infinity;
    if ((tile.tunnel.collapsedUntil ?? 0) > now) return Infinity;
    return UNDERGROUND_TERRAIN_COST[tile.terrain];
  }
  return SURFACE_TERRAIN_COST[tile.terrain];
};

export const isTileOccupied = (
  buildings: Building[],
  side: Owner,
  x: number,
  y: number,
  ignoreBuildingId?: string
): boolean =>
  buildings.some(
    (b) =>
      b.side === side &&
      b.id !== ignoreBuildingId &&
      b.hp > 0 &&
      b.pos.x === x &&
      b.pos.y === y
  );

export const isPathableTile = (
  tiles: Tile[],
  buildings: Building[],
  side: Owner,
  x: number,
  y: number,
  options: {
    ignoreBuildingId?: string;
    allowOccupiedStart?: boolean;
    start?: Position;
    layer?: TileLayer;
    now?: number;
  } = {}
): boolean => {
  if (!isTileInBounds(x, y)) return false;
  const layer = options.layer ?? "SURFACE";
  const cost = terrainMoveCost(tiles, x, y, layer, options.now ?? 0);
  if (!Number.isFinite(cost)) return false;
  const isStart = options.start?.x === x && options.start?.y === y;
  if (layer === "SURFACE" && (!options.allowOccupiedStart || !isStart)) {
    if (isTileOccupied(buildings, side, x, y, options.ignoreBuildingId)) return false;
  }
  return true;
};

const heuristicToAnyGoal = (x: number, y: number, goals: Position[]): number =>
  goals.reduce((best, g) => Math.min(best, Math.abs(g.x - x) + Math.abs(g.y - y)), Infinity);

const reconstructPath = (node: PathNode): Position[] => {
  const path: Position[] = [];
  let cur: PathNode | undefined = node;
  while (cur) {
    path.push({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  return path.reverse();
};

export const findPath = (
  tiles: Tile[],
  buildings: Building[],
  side: Owner,
  start: Position,
  goals: Position[],
  options: { maxIterations?: number; ignoreBuildingId?: string; layer?: TileLayer; now?: number } = {}
): Position[] => {
  const layer = options.layer ?? "SURFACE";
  const validGoals = goals.filter((g) =>
    isPathableTile(tiles, buildings, side, g.x, g.y, {
      ignoreBuildingId: options.ignoreBuildingId,
      layer,
      now: options.now,
    })
  );
  if (!validGoals.length) return [];

  const goalKeys = new Set(validGoals.map((g) => `${g.x},${g.y}`));
  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    f: heuristicToAnyGoal(start.x, start.y, validGoals),
  };
  const open: PathNode[] = [startNode];
  const bestG = new Map<string, number>([[`${start.x},${start.y}`, 0]]);
  const closed = new Set<string>();
  const maxIterations = options.maxIterations ?? GRID_W * GRID_H * 4;

  for (let iterations = 0; open.length && iterations < maxIterations; iterations++) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.y - b.y || a.x - b.x);
    const current = open.shift()!;
    const currentKey = `${current.x},${current.y}`;
    if (closed.has(currentKey)) continue;
    if (goalKeys.has(currentKey)) return reconstructPath(current);
    closed.add(currentKey);

    for (const n of NEIGHBORS) {
      const nx = current.x + n.x;
      const ny = current.y + n.y;
      const key = `${nx},${ny}`;
      if (closed.has(key)) continue;
      if (
        !isPathableTile(tiles, buildings, side, nx, ny, {
          ignoreBuildingId: options.ignoreBuildingId,
          allowOccupiedStart: true,
          start,
          layer,
          now: options.now,
        })
      ) {
        continue;
      }
      const moveCost = terrainMoveCost(tiles, nx, ny, layer, options.now ?? 0);
      const g = current.g + moveCost;
      if (g >= (bestG.get(key) ?? Infinity)) continue;
      bestG.set(key, g);
      open.push({
        x: nx,
        y: ny,
        g,
        f: g + heuristicToAnyGoal(nx, ny, validGoals),
        parent: current,
      });
    }
  }

  return [];
};

export const adjacentTiles = (pos: Position): Position[] =>
  NEIGHBORS.map((n) => ({ x: pos.x + n.x, y: pos.y + n.y })).filter((p) => isTileInBounds(p.x, p.y));

export const findPathToAdjacentBuilding = (
  tiles: Tile[],
  buildings: Building[],
  side: Owner,
  start: Position,
  target: Building,
  options: { layer?: TileLayer; now?: number } = {}
): Position[] => findPath(tiles, buildings, side, start, adjacentTiles(target.pos), options);
