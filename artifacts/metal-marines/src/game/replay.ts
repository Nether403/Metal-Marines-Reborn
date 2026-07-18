import type { ReplayCommand, ReplayFrameHash, ReplaySnapshot, RuntimeState } from "./types";

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
  hashes: ReplayFrameHash[] = []
): ReplaySnapshot => ({
  version: 1,
  missionId: state.missionId,
  seed: state.rngSeed >>> 0,
  commands: [...commands],
  hashes: [...hashes],
});