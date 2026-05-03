import { create } from "zustand";
import type {
  BuildingType,
  MissionDef,
  ProjectileType,
  RuntimeState,
  Tile,
} from "./types";
import { buildBuilding, launchMissile, stepGame, uid } from "./engine";
import { GRID_H, GRID_W } from "./constants";
import { getMission, MISSIONS } from "@/data/missions";

const PROGRESS_KEY = "mm2026.progress.v1";
const SAVE_KEY = "mm2026.save.v1";

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
  tryBuild: (x: number, y: number) => boolean;
  tryFire: (wx: number, wy: number) => boolean;
  markCleared: (id: string) => void;

  saveSnapshot: () => void;
  loadSnapshot: () => string | null;
}

const initRuntime = (mission: MissionDef): RuntimeState => {
  const fogPlayer = new Array<boolean>(GRID_W * GRID_H).fill(true);
  const fogEnemy = new Array<boolean>(GRID_W * GRID_H).fill(false);

  const buildings: RuntimeState["buildings"] = [];
  // Player HQ
  buildings.push({
    id: uid("b"),
    type: "HQ",
    owner: "PLAYER",
    side: "PLAYER",
    pos: mission.playerStartHQ,
    hp: 1200,
    maxHp: 1200,
    buildTimeRemaining: 0,
    buildTimeTotal: 0,
    cooldown: 0,
  });
  // Enemy HQ
  buildings.push({
    id: uid("b"),
    type: "HQ",
    owner: "ENEMY",
    side: "ENEMY",
    pos: mission.enemyStartHQ,
    hp: 1200,
    maxHp: 1200,
    buildTimeRemaining: 0,
    buildTimeTotal: 0,
    cooldown: 0,
  });

  // Give the AI a head-start of basic eco
  const aiSeed = (type: BuildingType, x: number, y: number) => {
    buildings.push({
      id: uid("b"),
      type,
      owner: "ENEMY",
      side: "ENEMY",
      pos: { x, y },
      hp: 220,
      maxHp: 220,
      buildTimeRemaining: 0,
      buildTimeTotal: 0,
      cooldown: 0,
    });
  };
  aiSeed("ENERGY_PLANT", mission.enemyStartHQ.x - 2, mission.enemyStartHQ.y);
  aiSeed("SUPPLY_DEPOT", mission.enemyStartHQ.x + 2, mission.enemyStartHQ.y);
  aiSeed("AA_GUN", mission.enemyStartHQ.x, mission.enemyStartHQ.y - 2);

  return {
    status: "PLAYING",
    missionId: mission.id,
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
    particles: [],
    fogPlayer,
    fogEnemy,
    alerts: [],
    selectedBuild: null,
    selectedWeapon: null,
    aiState: {
      phase: "ECO",
      nextActionAt: mission.difficulty <= 1 ? 8 : mission.difficulty <= 2 ? 5 : 3,
      builtCount: 0,
    },
    stats: {
      missilesFired: 0,
      marinesDeployed: 0,
      buildingsLost: 0,
      buildingsDestroyed: 0,
    },
    shake: 0,
    playerIsland: mission.playerIsland as Tile[],
    enemyIsland: mission.enemyIsland as Tile[],
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
    stepGame(runtime, mission, dt);
    // Throttle React re-renders to ~10Hz; canvas reads runtime directly via getState()
    const now = performance.now();
    // @ts-expect-error attach throttle marker
    if (!s._lastPush || now - s._lastPush > 100 || runtime.status !== "PLAYING") {
      // @ts-expect-error
      s._lastPush = now;
      set({ runtime: { ...runtime } });
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

  tryBuild: (x, y) => {
    const { runtime } = get();
    if (!runtime || !runtime.selectedBuild) return false;
    const ok = buildBuilding(runtime, "PLAYER", runtime.selectedBuild, x, y);
    if (ok) {
      set({ runtime: { ...runtime } });
    }
    return ok;
  },

  tryFire: (wx, wy) => {
    const { runtime } = get();
    if (!runtime || !runtime.selectedWeapon) return false;
    const ok = launchMissile(runtime, "PLAYER", runtime.selectedWeapon, wx, wy);
    if (ok) set({ runtime: { ...runtime } });
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
      set({ runtime: parsed.runtime, mission: m, paused: false });
      return parsed.missionId as string;
    } catch {
      return null;
    }
  },
}));

export const isMissionUnlocked = (missionIndex: number, cleared: string[]) => {
  if (missionIndex === 1) return true;
  const prev = MISSIONS[missionIndex - 2];
  return prev ? cleared.includes(prev.id) : false;
};
