import assert from "node:assert/strict";
import { BUILDINGS, GRID_H, GRID_W } from "./constants";
import { aiAttackGraceSeconds, aiEcoPhaseEndsAt, stepGame } from "./engine";
import { findPath, terrainMoveCost } from "./pathfinding";
import {
  advanceFixedStepAccumulator,
  createReplayFrameHash,
  createReplaySnapshot,
  DEFAULT_REPLAY_TICK_DT,
  formatReplayCommandLine,
  hashRuntimeFrame,
  MAX_FIXED_STEPS_PER_FRAME,
  recordReplaySession,
  verifyReplaySnapshot,
} from "./replay";
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
  playerFactoryDoctrine: "AUTO",
  playerGunshipPriority: "AUTO",
  viewLayer: "SURFACE",
  terrainMutations: [],
  aiState: {
    phase: "ECO",
    nextActionAt: 0,
    builtCount: 0,
    memory: { seenPlayerBuildings: {}, aaProbeScore: 0, lastProbeAt: -999 },
  },
  stats: { missilesFired: 0, marinesDeployed: 0, buildingsLost: 0, buildingsDestroyed: 0, environmentalActions: 0 },
  replay: { frame: 0, seed: hashSeed("test"), tickDt: 1 / 30, commands: [], hashes: [] },
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

// --- Factory doctrine: HOLD / APC preference ---
{
  const mission = idleMission("factory-doctrine", 1, 0.1, 0.8);
  const hold = createMissionRuntime(mission);
  hold.buildings.push({
    id: "factory_hold",
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
  hold.playerFunds = 2000;
  hold.playerEnergy = 800;
  hold.playerFactoryDoctrine = "HOLD";
  for (let t = 0; t < 30; t += 0.25) stepGame(hold, mission, 0.25);
  assert.equal(hold.vehicles.length, 0, "HOLD doctrine must not spawn APCs");
  assert.equal(hold.aircraft.length, 0, "HOLD doctrine must not spawn gunships");

  const apcOnly = createMissionRuntime(mission);
  apcOnly.buildings.push({
    id: "factory_apc",
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
  apcOnly.playerFunds = 2000;
  apcOnly.playerEnergy = 800;
  apcOnly.playerFactoryDoctrine = "APC";
  for (let t = 0; t < 45; t += 0.25) stepGame(apcOnly, mission, 0.25);
  assert.ok(apcOnly.vehicles.some((v) => v.owner === "PLAYER" && v.hp > 0), "APC doctrine should spawn garrison APCs");
  assert.equal(apcOnly.aircraft.length, 0, "APC doctrine must not launch gunships");
}

// --- Gunship strike priority (ENERGY) ---
{
  const mission = idleMission("gunship-priority", 1, 0.1, 0.8);
  const state = createMissionRuntime(mission);
  state.buildings.push({
    id: "factory_gs",
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
  state.buildings.push({
    id: "enemy_energy",
    type: "ENERGY_PLANT",
    side: "ENEMY",
    owner: "ENEMY",
    pos: { x: 2, y: 2 },
    footprintW: 1,
    footprintH: 1,
    hp: BUILDINGS.ENERGY_PLANT.maxHp,
    maxHp: BUILDINGS.ENERGY_PLANT.maxHp,
    buildTimeRemaining: 0,
    buildTimeTotal: 0,
    cooldown: 0,
  });
  state.playerFunds = 3000;
  state.playerEnergy = 1200;
  state.playerFactoryDoctrine = "GUNSHIP";
  state.playerGunshipPriority = "ENERGY";
  for (let t = 0; t < 50; t += 0.25) stepGame(state, mission, 0.25);
  const gunship = state.aircraft.find((a) => a.owner === "PLAYER" && a.hp > 0);
  assert.ok(gunship, "GUNSHIP doctrine should launch a player gunship");
  const locked = state.buildings.find((b) => b.id === gunship!.targetBuildingId);
  assert.ok(locked, "gunship should lock a building target");
  assert.equal(locked!.type, "ENERGY_PLANT", "ENERGY priority should lock onto an Energy Plant");
  assert.equal(locked!.side, "ENEMY", "gunship should target the enemy island");
}

// --- AA↔gunship readability FX (tracers + sparks, deterministic) ---
{
  const mission = idleMission("aa-gunship-fx", 1, 0.1, 0.8);
  const state = createMissionRuntime(mission);
  state.buildings.push({
    id: "aa_home",
    type: "AA_GUN",
    side: "PLAYER",
    owner: "PLAYER",
    pos: { x: 5, y: 4 },
    footprintW: 1,
    footprintH: 1,
    hp: BUILDINGS.AA_GUN.maxHp,
    maxHp: BUILDINGS.AA_GUN.maxHp,
    buildTimeRemaining: 0,
    buildTimeTotal: 0,
    cooldown: 0,
  });
  const hq = state.buildings.find((b) => b.type === "HQ" && b.side === "PLAYER");
  // Hostile gunship already over the player island (world coords)
  state.aircraft.push({
    id: "hostile_gs",
    owner: "ENEMY",
    side: "PLAYER",
    pos: { x: 5 * 64 + 32, y: 4 * 64 + 32 },
    hp: 95,
    maxHp: 95,
    state: "FLYING",
    facing: 0,
    attackCooldown: 99,
    targetBuildingId: hq?.id,
  });
  const hpBefore = state.aircraft[0].hp;
  const h0 = hashRuntimeFrame(state);
  // Short steps so tracers (maxLife ~0.22s) are still alive when we inspect
  for (let t = 0; t < 0.35; t += 0.05) stepGame(state, mission, 0.05);
  const tracers = state.particles.filter((p) => p.kind === "tracer" || p.kind === "spark");
  assert.ok(
    tracers.length > 0 || state.buildings.find((b) => b.id === "aa_home")!.cooldown > 0,
    "AA should engage hostile gunship (tracers/sparks or cooldown)"
  );
  assert.ok(
    state.aircraft[0].hp < hpBefore || state.buildings.find((b) => b.id === "aa_home")!.cooldown > 0,
    "AA engagement should damage gunship or put AA on cooldown"
  );
  // Continue until alert fires (detectIncoming has its own cadence)
  for (let t = 0; t < 3; t += 0.25) stepGame(state, mission, 0.25);
  assert.ok(
    state.alerts.some((a) => a.text.includes("HOSTILE GUNSHIP")),
    "hostile gunship over base should raise a combat alert"
  );
  const h1 = hashRuntimeFrame(state);
  assert.equal(h1, hashRuntimeFrame(state), "post-AA gunship hash stays stable");
  assert.notEqual(h0, h1, "AA engagement should change runtime hash (damage/cooldown)");
}

// --- Replay export + hash-verify stub (partial multiplayer/replay foundation) ---
{
  const mission = idleMission("replay-verify", 1, 0.1, 0.8);
  const tickDt = 1 / 30;
  const { snapshot } = recordReplaySession(mission, {
    tickDt,
    frames: 180,
    schedule: [
      { frame: 5, type: "SET_FACTORY_DOCTRINE", payload: { doctrine: "HOLD" } },
      { frame: 10, type: "BUILD", payload: { type: "ENERGY_PLANT", x: 4, y: 5 } },
      { frame: 20, type: "BUILD", payload: { type: "SUPPLY_DEPOT", x: 6, y: 5 } },
      { frame: 40, type: "SET_VIEW_LAYER", payload: { layer: "UNDERGROUND" } },
      { frame: 50, type: "SET_VIEW_LAYER", payload: { layer: "SURFACE" } },
      { frame: 60, type: "SET_GUNSHIP_PRIORITY", payload: { priority: "AA" } },
    ],
  });
  assert.ok(snapshot.commands.length >= 4, "session should record scheduled player commands");
  assert.ok(snapshot.hashes.length >= 2, "session should record periodic frame hashes");
  assert.equal(snapshot.tickDt, tickDt, "snapshot stores tickDt for offline verify");

  const verified = verifyReplaySnapshot(mission, snapshot, { tickDt });
  assert.equal(verified.ok, true, "re-applied commands must match recorded frame hashes");
  assert.ok(verified.framesChecked >= 2, "verify should check multiple hash frames");

  // Tamper with a hash → verify must fail
  const tampered = {
    ...snapshot,
    hashes: snapshot.hashes.map((h, i) => (i === 0 ? { ...h, hash: "deadbeef" } : h)),
  };
  const failed = verifyReplaySnapshot(mission, tampered, { tickDt });
  assert.equal(failed.ok, false, "tampered hash must fail verify");
  assert.ok(failed.firstMismatch, "tamper should report first mismatch");
}

// --- Fixed-step live capture (Play rAF accumulator) ---
{
  const tickDt = DEFAULT_REPLAY_TICK_DT;
  // Nominal 60Hz display → two wall frames per sim tick at 30Hz
  let acc = 0;
  let totalSteps = 0;
  for (let i = 0; i < 60; i++) {
    const advanced = advanceFixedStepAccumulator(acc, 1 / 60, tickDt);
    acc = advanced.accumulator;
    totalSteps += advanced.steps;
  }
  assert.equal(totalSteps, 30, "60×(1/60) wall seconds should yield 30 fixed 1/30 steps");
  assert.ok(acc < tickDt, "remainder must stay below one tick");

  // Spiral guard: uncapped wall hitch must clamp to maxSteps and leave ≤1 tick remainder
  const hitch = advanceFixedStepAccumulator(0, 1.0, tickDt, MAX_FIXED_STEPS_PER_FRAME);
  assert.equal(hitch.steps, MAX_FIXED_STEPS_PER_FRAME, "long hitch must clamp to max steps/frame");
  assert.ok(hitch.accumulator <= tickDt, "post-cap remainder must not spiral");

  // Play clamps wallDt to 0.05 → at most one 1/30 step per rAF (display may be 60Hz)
  const framed = advanceFixedStepAccumulator(0, 0.05, tickDt);
  assert.equal(framed.steps, 1, "Play's 50ms wall clamp yields one fixed tick");
  assert.ok(framed.accumulator < tickDt);

  // Live-style: createMissionRuntime + fixed steps + export tickDt must verify
  const mission = idleMission("replay-fixed-live", 1, 0.1, 0.8);
  const state = createMissionRuntime(mission);
  assert.equal(state.replay.tickDt, tickDt, "mission runtime stores fixed tickDt for live capture");
  for (let i = 0; i < 120 && state.status === "PLAYING"; i++) {
    stepGame(state, mission, state.replay.tickDt);
    state.replay.frame++;
    if (state.replay.frame % 60 === 0) {
      state.replay.hashes.push(createReplayFrameHash(state, state.replay.frame));
    }
  }
  const snapshot = createReplaySnapshot(
    state,
    state.replay.commands,
    state.replay.hashes,
    state.replay.tickDt
  );
  const verified = verifyReplaySnapshot(mission, snapshot);
  assert.equal(verified.ok, true, "fixed-tickDt live capture must verify offline");
  assert.ok(verified.framesChecked >= 1, "verify should check at least one hash frame");
}

// --- EndScreen command-log formatter (readable lines, no scrubber) ---
{
  assert.equal(
    formatReplayCommandLine({ frame: 12, type: "BUILD", payload: { type: "ENERGY", x: 3, y: 4 } }),
    "f12 BUILD ENERGY @ 3,4"
  );
  assert.equal(
    formatReplayCommandLine({
      frame: 40,
      type: "FIRE",
      payload: { type: "MISSILE", wx: 10.1234, wy: 8.9876 },
    }),
    "f40 FIRE MISSILE → 10.123,8.988"
  );
  assert.equal(
    formatReplayCommandLine({
      frame: 5,
      type: "SELECT_WEAPON",
      payload: { mode: "ANTI_AIR" },
    }),
    "f5 MECH_MODE ANTI_AIR"
  );
  assert.equal(
    formatReplayCommandLine({
      frame: 99,
      type: "SET_FACTORY_DOCTRINE",
      payload: { doctrine: "GUNSHIP" },
    }),
    "f99 FACTORY GUNSHIP"
  );
  assert.equal(
    formatReplayCommandLine({
      frame: 1,
      type: "INTERCEPT",
      payload: { targetId: "p7", wx: 2, wy: 3 },
    }),
    "f1 INTERCEPT p7 ← 2,3"
  );
}

console.log("game determinism checks passed");
