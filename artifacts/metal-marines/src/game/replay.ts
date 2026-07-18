import {
  buildBuilding,
  launchAAIntercept,
  launchMissile,
  stepGame,
} from "./engine";
import { createMissionRuntime } from "./runtimeFactory";
import type {
  BuildingType,
  FactoryDoctrine,
  GunshipStrikePriority,
  MechWeaponMode,
  MissionDef,
  ProjectileType,
  ReplayCommand,
  ReplayFrameHash,
  ReplaySnapshot,
  RuntimeState,
  TileLayer,
} from "./types";

export const REPLAY_HASH_INTERVAL = 60;
export const DEFAULT_REPLAY_TICK_DT = 1 / 30;

const stableNumber = (value: number): number => Math.round(value * 1000) / 1000;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
};

const hashText = (text: string): string => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export const runtimeDeterminismView = (state: RuntimeState) => ({
  status: state.status,
  missionId: state.missionId,
  rngSeed: state.rngSeed >>> 0,
  elapsed: stableNumber(state.elapsed),
  resources: {
    playerFunds: stableNumber(state.playerFunds),
    playerEnergy: stableNumber(state.playerEnergy),
    enemyFunds: stableNumber(state.enemyFunds),
    enemyEnergy: stableNumber(state.enemyEnergy),
  },
  buildings: state.buildings
    .map((b) => ({
      id: b.id,
      type: b.type,
      side: b.side,
      x: b.pos.x,
      y: b.pos.y,
      hp: stableNumber(b.hp),
      cooldown: stableNumber(b.cooldown),
      disabledUntil: stableNumber(b.disabledUntil ?? 0),
      buildTimeRemaining: stableNumber(b.buildTimeRemaining),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  projectiles: state.projectiles
    .map((p) => ({
      id: p.id,
      type: p.type,
      owner: p.owner,
      side: p.side,
      progress: stableNumber(p.progress),
      targetWX: stableNumber(p.targetWX),
      targetWY: stableNumber(p.targetWY),
      intercepted: !!p.intercepted,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  mechs: state.mechs
    .map((m) => ({
      id: m.id,
      owner: m.owner,
      side: m.side,
      x: stableNumber(m.pos.x),
      y: stableNumber(m.pos.y),
      hp: stableNumber(m.hp),
      layer: m.layer ?? "SURFACE",
      state: m.state,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  vehicles: state.vehicles
    .map((v) => ({
      id: v.id,
      owner: v.owner,
      side: v.side,
      x: stableNumber(v.pos.x),
      y: stableNumber(v.pos.y),
      hp: stableNumber(v.hp),
      state: v.state,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  aircraft: state.aircraft
    .map((a) => ({
      id: a.id,
      owner: a.owner,
      side: a.side,
      x: stableNumber(a.pos.x),
      y: stableNumber(a.pos.y),
      hp: stableNumber(a.hp),
      state: a.state,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  weather: state.weatherActive
    ? {
        type: state.weatherActive.type,
        startedAt: stableNumber(state.weatherActive.startedAt),
        duration: stableNumber(state.weatherActive.duration),
        sourceSide: state.weatherActive.sourceSide,
      }
    : null,
  terrainMutations: state.terrainMutations
    .map((m) => ({
      id: m.id,
      side: m.side,
      x: m.position.x,
      y: m.position.y,
      original: m.original,
      mutated: m.mutated,
      expiresAt: stableNumber(m.expiresAt),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
});

export const hashRuntimeFrame = (state: RuntimeState): string => hashText(stableStringify(runtimeDeterminismView(state)));

export const createReplayFrameHash = (state: RuntimeState, frame: number): ReplayFrameHash => ({
  frame,
  elapsed: stableNumber(state.elapsed),
  hash: hashRuntimeFrame(state),
});

export const createReplaySnapshot = (
  state: RuntimeState,
  commands: ReplayCommand[] = [],
  hashes: ReplayFrameHash[] = [],
  tickDt: number = DEFAULT_REPLAY_TICK_DT
): ReplaySnapshot => ({
  version: 1,
  missionId: state.missionId,
  seed: state.replay.seed >>> 0,
  tickDt,
  commands: [...commands],
  hashes: [...hashes],
});

/** Apply one recorded player command to a runtime (no React / store). */
export const applyReplayCommand = (state: RuntimeState, command: ReplayCommand): boolean => {
  const { type, payload } = command;
  switch (type) {
    case "SELECT_BUILD": {
      const build = payload.type;
      state.selectedBuild =
        build === null || build === undefined || build === "" ? null : (String(build) as BuildingType);
      state.selectedWeapon = null;
      return true;
    }
    case "SELECT_WEAPON": {
      if (payload.mode != null && payload.mode !== "") {
        state.selectedMechWeapon = String(payload.mode) as MechWeaponMode;
        return true;
      }
      if (payload.type === null || payload.type === undefined || payload.type === "") {
        state.selectedWeapon = null;
        state.selectedBuild = null;
        return true;
      }
      state.selectedWeapon = String(payload.type) as ProjectileType;
      state.selectedBuild = null;
      return true;
    }
    case "SET_VIEW_LAYER": {
      if (payload.layer == null) return false;
      state.viewLayer = String(payload.layer) as TileLayer;
      return true;
    }
    case "SET_FACTORY_DOCTRINE": {
      if (payload.doctrine == null) return false;
      state.playerFactoryDoctrine = String(payload.doctrine) as FactoryDoctrine;
      return true;
    }
    case "SET_GUNSHIP_PRIORITY": {
      if (payload.priority == null) return false;
      state.playerGunshipPriority = String(payload.priority) as GunshipStrikePriority;
      for (const a of state.aircraft) {
        if (a.owner === "PLAYER") a.targetBuildingId = undefined;
      }
      return true;
    }
    case "BUILD": {
      const buildType = String(payload.type) as BuildingType;
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      state.selectedBuild = buildType;
      state.selectedWeapon = null;
      return buildBuilding(state, "PLAYER", buildType, x, y);
    }
    case "FIRE": {
      const weapon = String(payload.type) as ProjectileType;
      const wx = Number(payload.wx);
      const wy = Number(payload.wy);
      if (!Number.isFinite(wx) || !Number.isFinite(wy)) return false;
      state.selectedWeapon = weapon;
      state.selectedBuild = null;
      return launchMissile(state, "PLAYER", weapon, wx, wy);
    }
    case "INTERCEPT": {
      const targetId = payload.targetId != null ? String(payload.targetId) : null;
      let target = targetId ? state.projectiles.find((p) => p.id === targetId) : undefined;
      if (!target) {
        // Fallback: nearest hostile inbound (same heuristic as live click intercept).
        const wx = Number(payload.wx);
        const wy = Number(payload.wy);
        let bestD = Infinity;
        for (const p of state.projectiles) {
          if (p.owner !== "ENEMY" || p.side !== "PLAYER" || p.intercepted) continue;
          if (p.type === "AA") continue;
          const d = Math.hypot(p.targetWX - wx, p.targetWY - wy);
          if (d < bestD) {
            bestD = d;
            target = p;
          }
        }
      }
      if (!target) return false;
      return launchAAIntercept(state, "PLAYER", target);
    }
    default:
      return false;
  }
};

export interface ReplayVerifyResult {
  ok: boolean;
  framesChecked: number;
  firstMismatch: ReplayFrameHash | null;
  expected: ReplayFrameHash | null;
  actual: ReplayFrameHash | null;
  finalHash: string;
}

/**
 * Re-apply commands on a fresh mission runtime with a fixed tickDt and compare
 * recorded frame hashes. Snapshots must have been recorded with the same tickDt.
 */
export const verifyReplaySnapshot = (
  mission: MissionDef,
  snapshot: ReplaySnapshot,
  options?: { tickDt?: number; maxFrames?: number }
): ReplayVerifyResult => {
  const tickDt = options?.tickDt ?? snapshot.tickDt ?? DEFAULT_REPLAY_TICK_DT;
  const state = createMissionRuntime(mission);
  // Prefer recorded seed when present (matches createMissionRuntime for normal missions).
  if (snapshot.seed != null) state.rngSeed = snapshot.seed >>> 0;

  const byFrame = new Map<number, ReplayCommand[]>();
  for (const cmd of snapshot.commands) {
    const list = byFrame.get(cmd.frame) ?? [];
    list.push(cmd);
    byFrame.set(cmd.frame, list);
  }

  const hashByFrame = new Map(snapshot.hashes.map((h) => [h.frame, h]));
  const lastHashFrame = snapshot.hashes.reduce((m, h) => Math.max(m, h.frame), 0);
  const maxFrames = options?.maxFrames ?? Math.max(lastHashFrame, state.replay.frame);

  let framesChecked = 0;
  let firstMismatch: ReplayFrameHash | null = null;
  let expected: ReplayFrameHash | null = null;
  let actual: ReplayFrameHash | null = null;

  while (state.replay.frame < maxFrames && state.status === "PLAYING") {
    const cmds = byFrame.get(state.replay.frame);
    if (cmds) {
      for (const cmd of cmds) applyReplayCommand(state, cmd);
    }
    stepGame(state, mission, tickDt);
    state.replay.frame++;
    if (state.replay.frame % REPLAY_HASH_INTERVAL === 0) {
      const computed = createReplayFrameHash(state, state.replay.frame);
      state.replay.hashes.push(computed);
      const want = hashByFrame.get(state.replay.frame);
      if (want) {
        framesChecked++;
        if (want.hash !== computed.hash && !firstMismatch) {
          firstMismatch = computed;
          expected = want;
          actual = computed;
        }
      }
    }
  }

  return {
    ok: firstMismatch === null && (snapshot.hashes.length === 0 || framesChecked > 0),
    framesChecked,
    firstMismatch,
    expected,
    actual,
    finalHash: hashRuntimeFrame(state),
  };
};

/** Record a fixed-dt session (tests / tooling) into a verify-ready snapshot. */
export const recordReplaySession = (
  mission: MissionDef,
  options: {
    tickDt?: number;
    frames: number;
    /** Commands keyed by the frame at which they should fire (before that frame's step). */
    schedule?: ReplayCommand[];
  }
): { state: RuntimeState; snapshot: ReplaySnapshot } => {
  const tickDt = options.tickDt ?? DEFAULT_REPLAY_TICK_DT;
  const state = createMissionRuntime(mission);
  const byFrame = new Map<number, ReplayCommand[]>();
  for (const cmd of options.schedule ?? []) {
    const list = byFrame.get(cmd.frame) ?? [];
    list.push(cmd);
    byFrame.set(cmd.frame, list);
  }

  for (let i = 0; i < options.frames && state.status === "PLAYING"; i++) {
    const cmds = byFrame.get(state.replay.frame);
    if (cmds) {
      for (const cmd of cmds) {
        applyReplayCommand(state, cmd);
        state.replay.commands.push({ ...cmd, frame: state.replay.frame });
      }
    }
    stepGame(state, mission, tickDt);
    state.replay.frame++;
    if (state.replay.frame % REPLAY_HASH_INTERVAL === 0) {
      state.replay.hashes.push(createReplayFrameHash(state, state.replay.frame));
      if (state.replay.hashes.length > 240) state.replay.hashes.shift();
    }
  }

  return {
    state,
    snapshot: createReplaySnapshot(state, state.replay.commands, state.replay.hashes, tickDt),
  };
};
