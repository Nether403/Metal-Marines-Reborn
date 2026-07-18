import { create } from "zustand";
import type {
  BuildingType,
  MechTier,
  MechWeaponMode,
  MissionDef,
  ProjectileType,
  RuntimeState,
  TileLayer,
  Tile,
  ReplayCommand,
} from "./types";
import {
  buildBuilding,
  launchAAIntercept,
  launchMissile,
  projectileCurrentPos,
  stepGame,
  uid,
} from "./engine";
import { BUILDINGS, GRID_H, GRID_W } from "./constants";
import { hashSeed } from "./rng";
import { createReplayFrameHash } from "./replay";
import { getMission, MISSIONS } from "@/data/missions";

const PROGRESS_KEY = "mm2026.progress.v1";
const SAVE_KEY = "mm2026.save.v1";
const REPLAY_HASH_INTERVAL = 60;

interface Progress {
  cleared: string[];
  bestTimes: Record<string, number>;
}

const loadProgress = (): Progress => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { cleared: [], bestTimes: {} };
    return JSON.parse(raw);
  } catch {
    return { cleared: [], bestTimes: {} };
  }
};

const saveProgress = (p: Progress) => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {}
};

const recordReplayCommand = (runtime: RuntimeState, command: Omit<ReplayCommand, "frame">) => {
  runtime.replay.commands.push({
    frame: runtime.replay.frame,
    ...command,
  });
};

interface Store {
  runtime: RuntimeState | null;
  mission: MissionDef | null;
  progress: Progress;
  paused: boolean;

  startMission: (id: string) => void;
  endMission: (resume?: boolean) => void;
  step: (dt: number) => void;
  setPaused: (v: boolean) => void;

  selectBuild: (t: BuildingType | null) => void;
  selectWeapon: (t: ProjectileType | null) => void;
  selectMechWeapon: (mode: MechWeaponMode) => void;
  selectMechTier: (tier: MechTier) => void;
  setViewLayer: (layer: TileLayer) => void;
  tryBuild: (x: number, y: number) => boolean;
  tryFire: (wx: number, wy: number) => boolean;
  tryInterceptAt: (wx: number, wy: number) => boolean;
  markCleared: (id: string) => void;

  saveSnapshot: () => void;
  loadSnapshot: () => string | null;
  hasSnapshot: () => { missionId: string; elapsed: number } | null;
  clearSnapshot: () => void;
}

const initRuntime = (mission: MissionDef): RuntimeState => {
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
  // Player + enemy starting HQs (free, already constructed)
  pushBuilding("HQ", "PLAYER", mission.playerStartHQ);
  pushBuilding("HQ", "ENEMY", mission.enemyStartHQ);

  // Give the AI a head-start of basic eco (gentler on easy missions)
  pushBuilding("ENERGY_PLANT", "ENEMY", {
    x: mission.enemyStartHQ.x - 2,
    y: mission.enemyStartHQ.y,
  });
  pushBuilding("SUPPLY_DEPOT", "ENEMY", {
    x: mission.enemyStartHQ.x + 2,
    y: mission.enemyStartHQ.y,
  });
  if (mission.difficulty >= 2) {
    pushBuilding("AA_GUN", "ENEMY", {
      x: mission.enemyStartHQ.x,
      y: mission.enemyStartHQ.y - 2,
    });
  }
  if (mission.difficulty >= 3) {
    pushBuilding("GUN_POD", "ENEMY", {
      x: mission.enemyStartHQ.x + 1,
      y: mission.enemyStartHQ.y + 1,
    });
  }

  const withTunnels = (tiles: Tile[], hq: { x: number; y: number }): Tile[] =>
    tiles.map((t) => {
      const interior = t.x > 0 && t.y > 0 && t.x < GRID_W - 1 && t.y < GRID_H - 1;
      const hqSpine = t.x === hq.x || t.y === hq.y;
      const open = interior && t.terrain !== "WATER" && (hqSpine || (t.x + t.y) % 3 !== 0);
      return { ...t, tunnel: t.tunnel ?? { open } };
    });
  const playerIsland = withTunnels(mission.playerIsland as Tile[], mission.playerStartHQ);
  const enemyIsland = withTunnels(mission.enemyIsland as Tile[], mission.enemyStartHQ);

  return {
    status: "PLAYING",
    missionId: mission.id,
    rngSeed: hashSeed(`${mission.id}:${mission.index}:${mission.difficulty}`),
    startedAt: Date.now(),
    elapsed: 0,
    playerFunds: mission.startFunds,
    playerEnergy: mission.startEnergy,
    enemyFunds: mission.startFunds,
    enemyEnergy: mission.startEnergy,
    playerFundsRate: 2,
    playerEnergyRate: 0,
    buildings,
    projectiles: [],
    mechs: [],
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
    viewLayer: "SURFACE",
    terrainMutations: [],
    aiState: {
      phase: "ECO",
      nextActionAt: mission.difficulty <= 1 ? 14 : mission.difficulty <= 2 ? 10 : 6,
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
      commands: [],
      hashes: [],
    },
    shake: 0,
    playerIsland,
    enemyIsland,
  };
};

export const useGame = create<Store>((set, get) => ({
  runtime: null,
  mission: null,
  progress: typeof window !== "undefined" ? loadProgress() : { cleared: [], bestTimes: {} },
  paused: false,

  startMission: (id: string) => {
    const m = getMission(id);
    if (!m) return;
    const rt = initRuntime(m);
    set({ runtime: rt, mission: m, paused: false });
  },

  endMission: () => {
    set({ runtime: null, mission: null, paused: false });
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  },

  step: (dt: number) => {
    const s = get();
    const { runtime, mission, paused } = s;
    if (!runtime || !mission || paused) return;
    if (runtime.status !== "PLAYING") return;
    const prevStatus = runtime.status;
    stepGame(runtime, mission, dt);
    runtime.replay.frame++;
    if (runtime.replay.frame % REPLAY_HASH_INTERVAL === 0) {
      runtime.replay.hashes.push(createReplayFrameHash(runtime, runtime.replay.frame));
      if (runtime.replay.hashes.length > 240) runtime.replay.hashes.shift();
    }
    // Throttle React re-renders to ~10Hz; canvas reads runtime directly via getState()
    const now = performance.now();
    // @ts-expect-error attach throttle marker
    if (!s._lastPush || now - s._lastPush > 100 || runtime.status !== "PLAYING") {
      // @ts-expect-error
      s._lastPush = now;
      set({ runtime: { ...runtime } });
    }
    // Auto-save every ~5 seconds during play; clear on win/loss.
    // @ts-expect-error attach autosave marker
    if (!s._lastSave || now - s._lastSave > 5000) {
      // @ts-expect-error
      s._lastSave = now;
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({ missionId: mission.id, runtime })
        );
      } catch {}
    }
    if (prevStatus === "PLAYING" && runtime.status !== "PLAYING") {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
    }
  },

  setPaused: (v: boolean) => set({ paused: v }),

  selectBuild: (t) => {
    const rt = get().runtime;
    if (!rt) return;
    rt.selectedBuild = t;
    rt.selectedWeapon = null;
    set({ runtime: { ...rt } });
  },

  selectWeapon: (t) => {
    const rt = get().runtime;
    if (!rt) return;
    rt.selectedWeapon = t;
    rt.selectedBuild = null;
    set({ runtime: { ...rt } });
  },

  selectMechWeapon: (mode) => {
    const rt = get().runtime;
    if (!rt) return;
    rt.selectedMechWeapon = mode;
    recordReplayCommand(rt, { type: "SELECT_WEAPON", payload: { mode } });
    set({ runtime: { ...rt } });
  },

  selectMechTier: (tier) => {
    const rt = get().runtime;
    if (!rt) return;
    rt.selectedMechTier = tier;
    set({ runtime: { ...rt } });
  },

  setViewLayer: (layer) => {
    const rt = get().runtime;
    if (!rt) return;
    if (rt.viewLayer !== layer) {
      recordReplayCommand(rt, { type: "SET_VIEW_LAYER", payload: { layer } });
    }
    rt.viewLayer = layer;
    set({ runtime: { ...rt } });
  },

  tryBuild: (x, y) => {
    const { runtime } = get();
    if (!runtime || !runtime.selectedBuild) return false;
    const ok = buildBuilding(runtime, "PLAYER", runtime.selectedBuild, x, y);
    if (ok) {
      recordReplayCommand(runtime, {
        type: "BUILD",
        payload: { type: runtime.selectedBuild, x, y },
      });
      set({ runtime: { ...runtime } });
    }
    return ok;
  },

  tryFire: (wx, wy) => {
    const { runtime } = get();
    if (!runtime || !runtime.selectedWeapon) return false;
    const ok = launchMissile(runtime, "PLAYER", runtime.selectedWeapon, wx, wy);
    if (ok) {
      recordReplayCommand(runtime, {
        type: "FIRE",
        payload: { type: runtime.selectedWeapon, wx, wy },
      });
      set({ runtime: { ...runtime } });
    }
    return ok;
  },

  tryInterceptAt: (wx, wy) => {
    const { runtime } = get();
    if (!runtime) return false;
    // Pick the nearest hostile incoming projectile to the click anywhere in the
    // world. The click is only a directional hint — selection is unrestricted so
    // the player can always engage the closest threat regardless of click site.
    let best = null as null | (typeof runtime.projectiles)[number];
    let bestD = Infinity;
    for (const p of runtime.projectiles) {
      if (p.owner !== "ENEMY" || p.side !== "PLAYER" || p.intercepted) continue;
      if (p.type === "AA") continue;
      const cur = projectileCurrentPos(p);
      const d = Math.hypot(cur.x - wx, cur.y - wy);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return false;
    const ok = launchAAIntercept(runtime, "PLAYER", best);
    if (ok) {
      recordReplayCommand(runtime, {
        type: "INTERCEPT",
        payload: { wx, wy, targetId: best.id },
      });
      set({ runtime: { ...runtime } });
    }
    return ok;
  },

  markCleared: (id: string) => {
    const p = get().progress;
    if (!p.cleared.includes(id)) p.cleared.push(id);
    saveProgress(p);
    set({ progress: { ...p } });
  },

  saveSnapshot: () => {
    const { runtime, mission } = get();
    if (!runtime || !mission) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ missionId: mission.id, runtime })
      );
    } catch {}
  },

  loadSnapshot: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const m = getMission(parsed.missionId);
      if (!m) return null;
      parsed.runtime.rngSeed ??= hashSeed(`${m.id}:${m.index}:${m.difficulty}`);
      parsed.runtime.viewLayer ??= "SURFACE";
      parsed.runtime.terrainMutations ??= [];
      parsed.runtime.stats ??= {};
      parsed.runtime.stats.environmentalActions ??= 0;
      parsed.runtime.replay ??= { frame: 0, commands: [], hashes: [] };
      parsed.runtime.replay.frame ??= 0;
      parsed.runtime.replay.commands ??= [];
      parsed.runtime.replay.hashes ??= [];
      parsed.runtime.playerIsland ??= m.playerIsland;
      parsed.runtime.enemyIsland ??= m.enemyIsland;
      parsed.runtime.playerIsland = parsed.runtime.playerIsland.map((t: Tile) => ({
        ...t,
        tunnel: t.tunnel ?? { open: t.x > 0 && t.y > 0 && t.x < GRID_W - 1 && t.y < GRID_H - 1 && t.terrain !== "WATER" },
      }));
      parsed.runtime.enemyIsland = parsed.runtime.enemyIsland.map((t: Tile) => ({
        ...t,
        tunnel: t.tunnel ?? { open: t.x > 0 && t.y > 0 && t.x < GRID_W - 1 && t.y < GRID_H - 1 && t.terrain !== "WATER" },
      }));
      parsed.runtime.aiState ??= { phase: "ECO", nextActionAt: 3, builtCount: 0 };
      parsed.runtime.aiState.memory ??= {
        seenPlayerBuildings: {},
        aaProbeScore: 0,
        lastProbeAt: -999,
      };
      set({ runtime: parsed.runtime, mission: m, paused: false });
      return parsed.missionId as string;
    } catch {
      return null;
    }
  },

  hasSnapshot: () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.missionId || !parsed?.runtime) return null;
      if (parsed.runtime.status !== "PLAYING") return null;
      return {
        missionId: parsed.missionId as string,
        elapsed: parsed.runtime.elapsed ?? 0,
      };
    } catch {
      return null;
    }
  },

  clearSnapshot: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  },
}));

export const isMissionUnlocked = (missionIndex: number, cleared: string[]) => {
  if (missionIndex === 1) return true;
  const prev = MISSIONS[missionIndex - 2];
  return prev ? cleared.includes(prev.id) : false;
};
