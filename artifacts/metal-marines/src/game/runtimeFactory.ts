import type { BuildingType, MissionDef, RuntimeState, Tile } from "./types";
import { BUILDINGS, GRID_H, GRID_W, MECH_HP } from "./constants";
import { resetEntityIds, tileToWorld, uid } from "./engine";
import { hashSeed } from "./rng";

/** Keep in sync with DEFAULT_REPLAY_TICK_DT in replay.ts (avoid circular import). */
const MISSION_REPLAY_TICK_DT = 1 / 30;

/** Build a fresh runtime for a mission (shared by store + idle-survival tests). */
export const createMissionRuntime = (mission: MissionDef): RuntimeState => {
  // Shared counter with engine.uid so replay verify reproduces the same entity ids.
  resetEntityIds();
  const fogPlayer = new Array<boolean>(GRID_W * GRID_H).fill(true);
  const fogEnemy = new Array<boolean>(GRID_W * GRID_H).fill(false);

  const buildings: RuntimeState["buildings"] = [];
  const pushBuilding = (
    type: BuildingType,
    side: "PLAYER" | "ENEMY",
    pos: { x: number; y: number },
    ready = true
  ) => {
    const spec = BUILDINGS[type];
    buildings.push({
      id: uid("b"),
      type,
      owner: side,
      side,
      pos,
      footprintW: spec.footprintW ?? 1,
      footprintH: spec.footprintH ?? 1,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      buildTimeRemaining: ready ? 0 : spec.buildTime,
      buildTimeTotal: ready ? 0 : spec.buildTime,
      cooldown: 0,
    });
  };

  pushBuilding("HQ", "PLAYER", mission.playerStartHQ);
    pushBuilding("HQ", "ENEMY", mission.enemyStartHQ);

    // Denser starting bases — classic Metal Marines reads as fortresses, not empty lawns.
    const p = mission.playerStartHQ;
    const e = mission.enemyStartHQ;
    const ring = (
      side: "PLAYER" | "ENEMY",
      hq: { x: number; y: number },
      extraDefense: boolean
    ) => {
      pushBuilding("ENERGY_PLANT", side, { x: hq.x - 2, y: hq.y });
      pushBuilding("SUPPLY_DEPOT", side, { x: hq.x + 2, y: hq.y });
      pushBuilding("MISSILE_LAUNCHER", side, { x: hq.x, y: hq.y - 2 });
      pushBuilding("GUN_TURRET", side, { x: hq.x - 2, y: hq.y - 2 });
      pushBuilding("RADAR", side, { x: hq.x + 2, y: hq.y - 2 });
      if (extraDefense) {
        pushBuilding("AA_GUN", side, { x: hq.x - 2, y: hq.y + 2 });
        pushBuilding("GUN_POD", side, { x: hq.x + 2, y: hq.y + 2 });
        pushBuilding("METAL_MARINE_BASE", side, { x: hq.x, y: hq.y + 2 });
      }
    };
    ring("PLAYER", p, true);
    ring("ENEMY", e, mission.difficulty >= 2);
    if (mission.difficulty >= 3) {
      pushBuilding("FACTORY", "ENEMY", { x: e.x, y: e.y + 2 });
    }

    // Full enemy-island intel for opening clarity (classic MM often shows both theaters).
    // Radar gameplay still expands fog further via engine; start readable, not empty black.
    for (let i = 0; i < fogEnemy.length; i++) fogEnemy[i] = true;

  const withTunnels = (tiles: Tile[], hq: { x: number; y: number }): Tile[] =>
    tiles.map((t) => {
      const interior = t.x > 0 && t.y > 0 && t.x < GRID_W - 1 && t.y < GRID_H - 1;
      const hqSpine = t.x === hq.x || t.y === hq.y;
      const open = interior && t.terrain !== "WATER" && (hqSpine || (t.x + t.y) % 3 !== 0);
      return { ...t, tunnel: t.tunnel ?? { open } };
    });
  const playerIsland = withTunnels(mission.playerIsland as Tile[], mission.playerStartHQ);
  const enemyIsland = withTunnels(mission.enemyIsland as Tile[], mission.enemyStartHQ);
  const seed = hashSeed(`${mission.id}:${mission.index}:${mission.difficulty}`);

  return {
    status: "PLAYING",
    missionId: mission.id,
    rngSeed: seed,
    startedAt: 0,
    elapsed: 0,
    playerFunds: mission.startFunds,
    playerEnergy: mission.startEnergy,
    enemyFunds: mission.startFunds,
    enemyEnergy: mission.startEnergy,
    playerFundsRate: 2,
    playerEnergyRate: 0,
    buildings,
        projectiles: [],
        mechs: [
          {
            id: uid("m"),
            owner: "PLAYER",
            side: "PLAYER",
            pos: tileToWorld("PLAYER", p.x - 1, p.y + 1),
            hp: MECH_HP,
            maxHp: MECH_HP,
            state: "WALKING",
            attackCooldown: 0,
            tier: "GUNNER_I",
            weaponMode: "NORMAL",
          },
          {
            id: uid("m"),
            owner: "PLAYER",
            side: "PLAYER",
            pos: tileToWorld("PLAYER", p.x + 1, p.y + 1),
            hp: MECH_HP,
            maxHp: MECH_HP,
            state: "WALKING",
                        attackCooldown: 0,
                        tier: "GUNNER_I",
                        weaponMode: "NORMAL",
                      },
                      {
                        id: uid("m"),
                        owner: "ENEMY",
            side: "ENEMY",
            pos: tileToWorld("ENEMY", e.x, e.y + 1),
            hp: MECH_HP,
            maxHp: MECH_HP,
            state: "WALKING",
            attackCooldown: 0,
            tier: "GUNNER_I",
            weaponMode: "NORMAL",
          },
        ],
        vehicles: [],
        aircraft: [],
        particles: [],
    fogPlayer,
    fogEnemy,
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
      // Longer opening delay on easier missions so players can place first economy.
      nextActionAt: mission.difficulty <= 1 ? 16 : mission.difficulty <= 2 ? 14 : mission.difficulty <= 3 ? 10 : 6,
      builtCount: 0,
      memory: {
        seenPlayerBuildings: {},
        aaProbeScore: 0,
        lastProbeAt: -999,
      },
    },
    stats: {
      missilesFired: 0,
      marinesDeployed: 0,
      buildingsLost: 0,
      buildingsDestroyed: 0,
      environmentalActions: 0,
    },
    replay: {
      frame: 0,
      seed,
      tickDt: MISSION_REPLAY_TICK_DT,
      commands: [],
      hashes: [],
    },
    shake: 0,
    playerIsland,
    enemyIsland,
  };
};
