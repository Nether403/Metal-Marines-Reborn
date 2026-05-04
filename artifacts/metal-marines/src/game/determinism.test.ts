import assert from "node:assert/strict";
import { findPath, terrainMoveCost } from "./pathfinding";
import { hashRuntimeFrame } from "./replay";
import { hashSeed, randomFloatFromSeed } from "./rng";
import { GRID_H, GRID_W } from "./constants";
import type { RuntimeState, Tile } from "./types";

const makeTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      tiles.push({ x, y, terrain: "GRASS", tunnel: { open: x > 0 && y > 0 && x < GRID_W - 1 && y < GRID_H - 1 } });
    }
  }
  return tiles;
};

const makeState = (): RuntimeState => ({
  status: "PLAYING",
  missionId: "test",
  rngSeed: hashSeed("test"),
  startedAt: 0,
  elapsed: 10,
  playerFunds: 100,
  playerEnergy: 50,
  enemyFunds: 100,
  enemyEnergy: 50,
  playerFundsRate: 2,
  playerEnergyRate: 0,
  buildings: [],
  projectiles: [],
  mechs: [],
  particles: [],
  fogPlayer: [],
  fogEnemy: [],
  alerts: [],
  selectedBuild: null,
  selectedWeapon: null,
  viewLayer: "SURFACE",
  terrainMutations: [],
  aiState: {
    phase: "ECO",
    nextActionAt: 0,
    builtCount: 0,
    memory: { seenPlayerBuildings: {}, aaProbeScore: 0, lastProbeAt: -999 },
  },
  stats: { missilesFired: 0, marinesDeployed: 0, buildingsLost: 0, buildingsDestroyed: 0, environmentalActions: 0 },
  shake: 0,
  playerIsland: makeTiles(),
  enemyIsland: makeTiles(),
});

const tiles = makeTiles();
assert.equal(randomFloatFromSeed(hashSeed("alpha")), randomFloatFromSeed(hashSeed("alpha")), "seeded RNG must be repeatable");
assert.equal(terrainMoveCost([{ x: 0, y: 0, terrain: "TOXIC_SLUDGE" }], 0, 0), Infinity, "toxic sludge blocks surface movement");
assert.equal(terrainMoveCost(tiles, 1, 1, "UNDERGROUND", 0), 1, "open tunnels are underground pathable");

tiles[1 * GRID_W + 2].tunnel = { open: true, collapsedUntil: 99 };
assert.equal(terrainMoveCost(tiles, 2, 1, "UNDERGROUND", 10), Infinity, "collapsed tunnels block underground movement");

const pathA = findPath(makeTiles(), [], "PLAYER", { x: 1, y: 1 }, [{ x: 4, y: 1 }], { layer: "UNDERGROUND" });
const pathB = findPath(makeTiles(), [], "PLAYER", { x: 1, y: 1 }, [{ x: 4, y: 1 }], { layer: "UNDERGROUND" });
assert.deepEqual(pathA, pathB, "pathfinding should be deterministic for identical inputs");

const stateA = makeState();
const stateB = makeState();
assert.equal(hashRuntimeFrame(stateA), hashRuntimeFrame(stateB), "replay frame hash should be deterministic for identical states");
stateB.playerFunds += 1;
assert.notEqual(hashRuntimeFrame(stateA), hashRuntimeFrame(stateB), "replay frame hash should detect state changes");

console.log("game determinism checks passed");