import assert from "node:assert/strict";
import { BUILDINGS, GRID_H, GRID_W } from "./constants";
import { aiAttackGraceSeconds, aiEcoPhaseEndsAt, stepGame } from "./engine";
import { findPath, terrainMoveCost } from "./pathfinding";
import { hashRuntimeFrame } from "./replay";
import { createMissionRuntime } from "./runtimeFactory";
import { hashSeed, randomFloatFromSeed } from "./rng";
import type { MissionDef, RuntimeState, Tile } from "./types";

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
  vehicles: [],
  aircraft: [],
  particles: [],
  fogPlayer: [],
  fogEnemy: [],
  alerts: [],
  selectedBuild: null,
  selectedWeapon: null,
  selectedMechWeapon: "NORMAL",
  selectedMechTier: "GUNNER_I",
  viewLayer: "SURFACE",
  terrainMutations: [],
  aiState: {
    phase: "ECO",
    nextActionAt: 0,
    builtCount: 0,
    memory: { seenPlayerBuildings: {}, aaProbeScore: 0, lastProbeAt: -999 },
  },
  stats: { missilesFired: 0, marinesDeployed: 0, buildingsLost: 0, buildingsDestroyed: 0, environmentalActions: 0 },
  replay: { frame: 0, commands: [], hashes: [] },
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

// Original-pillar constants smoke checks (no path-alias imports)
assert.equal(BUILDINGS.ICBM_SILO.footprintW, 3, "ICBM silo is 3 wide");
assert.equal(BUILDINGS.ICBM_SILO.footprintH, 3, "ICBM silo is 3 tall");
assert.equal((BUILDINGS.ICBM_SILO.footprintW ?? 1) * (BUILDINGS.ICBM_SILO.footprintH ?? 1), 9, "ICBM silo occupies 9 tiles");
assert.equal(BUILDINGS.HQ.maxPerSide, 3, "HQ capped at 3 bases");
assert.ok(BUILDINGS.GUN_POD, "Gun Pod building exists");
assert.ok(BUILDINGS.FACTORY, "Factory building exists");
assert.ok(BUILDINGS.DUMMY_BASE, "Dummy Base exists");
assert.ok(BUILDINGS.DUMMY_COVER, "Dummy Cover exists");
assert.equal(hashSeed("m1:1:1"), hashSeed("m1:1:1"), "mission seed hashing is stable");

// --- Idle survival: AI opening must not instantly erase an AFK HQ ---
assert.ok(aiAttackGraceSeconds(2) >= 70, "diff-2 attack grace leaves opening build window");
assert.ok(aiEcoPhaseEndsAt(2) >= 60, "diff-2 stays in ECO long enough to prioritize economy");

const grassIsland = (): Tile[] => {
  const out: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const edge = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
      out.push({ x, y, terrain: edge ? "WATER" : "GRASS" });
    }
  }
  return out;
};

const idleMission = (id: string, difficulty: number, aggression: number, eco: number): MissionDef => ({
  id,
  index: difficulty,
  title: `Idle ${id}`,
  commanderId: "voss",
  objective: "Survive idle",
  briefing: "Idle survival regression",
  difficulty,
  playerIsland: grassIsland(),
  enemyIsland: grassIsland(),
  playerStartHQ: { x: 5, y: 5 },
  enemyStartHQ: { x: 5, y: 5 },
  enemyAggression: aggression,
  enemyEcoBias: eco,
  startFunds: difficulty <= 1 ? 1400 : 1100,
  startEnergy: difficulty <= 1 ? 550 : 500,
});

const simulateIdle = (mission: MissionDef, seconds: number) => {
  const state = createMissionRuntime(mission);
  const dt = 0.25;
  for (let t = 0; t < seconds; t += dt) {
    stepGame(state, mission, dt);
    if (state.status !== "PLAYING") break;
  }
  return state;
};

const idleM1 = simulateIdle(idleMission("idle-m1", 1, 0.12, 0.75), 120);
assert.equal(idleM1.status, "PLAYING", "idle M1-like should still be playing at 120s");
assert.ok(
  idleM1.buildings.some((b) => b.side === "PLAYER" && b.type === "HQ" && b.hp > 0),
  "idle M1-like player HQ must survive 120s"
);

const m2Like = idleMission("idle-m2", 2, 0.35, 0.6);
const beforeGrace = simulateIdle(m2Like, aiAttackGraceSeconds(2) - 1);
assert.equal(beforeGrace.stats.marinesDeployed, 0, "no mech drops before attack grace");
assert.equal(
  beforeGrace.projectiles.filter((p) => p.owner === "ENEMY").length,
  0,
  "no enemy projectiles before attack grace"
);

const idleM2 = simulateIdle(m2Like, 90);
assert.equal(idleM2.status, "PLAYING", "idle M2-like should still be playing at 90s");
assert.ok(
  idleM2.buildings.some((b) => b.side === "PLAYER" && b.type === "HQ" && b.hp > 0),
  "idle M2-like player HQ must survive 90s (opening grace)"
);

// --- Factory vehicles / aircraft gameplay ---
{
  const mission = idleMission("factory-units", 1, 0.1, 0.8);
  const state = createMissionRuntime(mission);
  // Place an active player Factory beside HQ
  state.buildings.push({
    id: "factory_test",
    type: "FACTORY",
    side: "PLAYER",
    owner: "PLAYER",
    pos: { x: 6, y: 5 },
    footprintW: 1,
    footprintH: 1,
    hp: BUILDINGS.FACTORY.maxHp,
    maxHp: BUILDINGS.FACTORY.maxHp,
    buildTimeRemaining: 0,
    buildTimeTotal: 0,
    cooldown: 0,
  });
  state.playerFunds = 2000;
  state.playerEnergy = 800;
  for (let t = 0; t < 20; t += 0.25) stepGame(state, mission, 0.25);
  assert.ok(state.vehicles.some((v) => v.owner === "PLAYER" && v.hp > 0), "Factory should spawn a garrison APC");
  assert.ok(state.aircraft.some((a) => a.owner === "PLAYER" && a.hp > 0), "Factory should launch a gunship");
  const hashes = [hashRuntimeFrame(state), hashRuntimeFrame(state)];
  assert.equal(hashes[0], hashes[1], "vehicle/aircraft state hashes stably");
}

console.log("game determinism checks passed");
