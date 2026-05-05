import {
  BUILDINGS,
  BIOSPHERE_ECONOMY_BONUS,
  BIOSPHERE_ENGINE_COOLDOWN,
  BIOSPHERE_REGEN_SECONDS,
  DUST_STORM_MECH_SPEED_MULTIPLIER,
  EMP_DISABLE_SECONDS,
  EMP_SPLASH,
  GRID_H,
  GRID_W,
  ICBM_DAMAGE,
  ICBM_SPLASH,
  ISLAND_PX_H,
  ISLAND_PX_W,
  MECH_ATTACK_COOLDOWN,
  MECH_DAMAGE,
  MECH_HP,
  MECH_SPEED,
  JAMMER_FALSE_SIGNATURE_INTERVAL,
  SEISMIC_DETECTION_SECONDS,
  SEISMIC_SENSOR_RANGE,
  SKY_GAP_PX,
  TERRAIN_DESTABILIZER_COOLDOWN,
  TOXIC_SLUDGE_SECONDS,
  TILE_PX,
  TREMOR_DEFENSE_PENALTY,
  TUNNEL_COLLAPSE_RADIUS,
  TUNNEL_COLLAPSE_SECONDS,
  TUNNEL_MOVE_MULTIPLIER,
  TUNNEL_TRANSITION_SECONDS,
  WEATHER_CONTROL_COOLDOWN,
  WEATHER_DURATION_SECONDS,
  WEAPON_COSTS,
  tileUnits,
} from "./constants";
import { getBuildingCost } from "./economy";
import { findPathToAdjacentBuilding, isPathableTile } from "./pathfinding";
import { randomFloatFromSeed, randomIntFromSeed, randomRangeFromSeed } from "./rng";
import type {
  Building,
  BuildingType,
  Mech,
  MissionDef,
  Owner,
  Particle,
  Position,
  Projectile,
  ProjectileType,
  RuntimeState,
  TerrainMutation,
  Tile,
  TileLayer,
  WeatherType,
} from "./types";
import { sfx } from "@/lib/sfx";

let _id = 0;
export const uid = (p = "x") => `${p}_${++_id}`;

const rng = (state: RuntimeState): number => {
  const value = randomFloatFromSeed(state.rngSeed);
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return value;
};

const rngRange = (state: RuntimeState, min: number, max: number): number => {
  const value = randomRangeFromSeed(state.rngSeed, min, max);
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return value;
};

const rngInt = (state: RuntimeState, min: number, maxExclusive: number): number => {
  const value = randomIntFromSeed(state.rngSeed, min, maxExclusive);
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return value;
};

export const tileIndex = (x: number, y: number) => y * GRID_W + x;

export const getTile = (tiles: Tile[], x: number, y: number): Tile | undefined =>
  tiles[tileIndex(x, y)];

export const islandOriginX = (side: Owner): number =>
  side === "PLAYER" ? 0 : ISLAND_PX_W + SKY_GAP_PX;

export const tileToWorld = (side: Owner, x: number, y: number): Position => ({
  x: islandOriginX(side) + x * TILE_PX + TILE_PX / 2,
  y: y * TILE_PX + TILE_PX / 2,
});

export const worldToTile = (side: Owner, wx: number, wy: number): Position => {
  const ox = islandOriginX(side);
  return {
    x: Math.floor((wx - ox) / TILE_PX),
    y: Math.floor(wy / TILE_PX),
  };
};

export const inIsland = (side: Owner, wx: number, wy: number): boolean => {
  const ox = islandOriginX(side);
  return wx >= ox && wx < ox + ISLAND_PX_W && wy >= 0 && wy < ISLAND_PX_H;
};

export const isBuildable = (
  tiles: Tile[],
  buildings: Building[],
  side: Owner,
  type: BuildingType,
  x: number,
  y: number
): boolean => {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  const t = getTile(tiles, x, y);
  if (!t) return false;
  if (t.terrain === "WATER") return false;
  if (t.terrain === "MOUNTAIN") return false;
  if (t.terrain === "TOXIC_SLUDGE") return false;
  if (t.terrain === "FOREST" && type !== "LAND_MINE") return false;
  // Footprint check (1x1 for simplicity)
  const occ = buildings.some(
    (b) => b.side === side && b.pos.x === x && b.pos.y === y && b.hp > 0
  );
  if (occ) return false;
  return true;
};

declare module "./types" {
  interface Building {
    side: Owner;
  }
}

export const buildBuilding = (
  state: RuntimeState,
  side: Owner,
  type: BuildingType,
  x: number,
  y: number
): boolean => {
  const spec = BUILDINGS[type];
  const cost = getBuildingCost(state.buildings, side, type);
  const fundsRef = side === "PLAYER" ? "playerFunds" : "enemyFunds";
  const energyRef = side === "PLAYER" ? "playerEnergy" : "enemyEnergy";
  if (state[fundsRef] < cost.funds) return false;
  if (state[energyRef] < cost.energy) return false;
  const tiles = side === "PLAYER" ? state.playerIsland : state.enemyIsland;
  if (!isBuildable(tiles, state.buildings, side, type, x, y)) return false;
  state[fundsRef] -= cost.funds;
  state[energyRef] -= cost.energy;
  state.buildings.push({
    id: uid("b"),
    type,
    owner: side,
    side,
    pos: { x, y },
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    buildTimeRemaining: spec.buildTime,
    buildTimeTotal: spec.buildTime,
    cooldown: 0,
  });
  if (type === "TUNNEL_ENTRANCE") carveTunnelAround(state, side, { x, y }, 2);
  if (side === "PLAYER") sfx("place_building");
  return true;
};

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

const MECH_ATTACK_RANGE = tileUnits(1.1);

const isBuildingActive = (b: Building, now: number): boolean =>
  b.hp > 0 && b.buildTimeRemaining <= 0 && (b.disabledUntil ?? 0) <= now;

const clearMechPath = (m: Mech) => {
  m.path = undefined;
  m.pathTargetId = undefined;
  m.waypointIndex = 0;
};

const islandTiles = (state: RuntimeState, side: Owner): Tile[] =>
  side === "PLAYER" ? state.playerIsland : state.enemyIsland;

const opposingSide = (side: Owner): Owner => (side === "PLAYER" ? "ENEMY" : "PLAYER");

const clearPathsOnSide = (state: RuntimeState, side: Owner) => {
  for (const m of state.mechs) {
    if (m.side === side) clearMechPath(m);
  }
};

const activeBuildingByType = (state: RuntimeState, side: Owner, type: BuildingType): Building[] =>
  state.buildings.filter((b) => b.side === side && b.type === type && isBuildingActive(b, state.elapsed));

const hasBiosphereSupport = (state: RuntimeState, b: Building): boolean =>
  activeBuildingByType(state, b.side, "BIOSPHERE_ENGINE").some((bio) => {
    const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
    const ew = tileToWorld(bio.side, bio.pos.x, bio.pos.y);
    return distance(bw.x, bw.y, ew.x, ew.y) <= (BUILDINGS.BIOSPHERE_ENGINE.range ?? 96);
  });

const weatherSpeedMultiplier = (state: RuntimeState, m: Mech): number => {
  const weather = state.weatherActive;
  if (!weather) return 1;
  if (weather.type === "DUST_STORM" && (m.layer ?? "SURFACE") === "SURFACE") return DUST_STORM_MECH_SPEED_MULTIPLIER;
  if (weather.type === "FLOOD" && (m.layer ?? "SURFACE") === "SURFACE") return 0.78;
  return 1;
};

const isTunnelOpen = (tiles: Tile[], pos: Position, now: number): boolean => {
  const tile = getTile(tiles, pos.x, pos.y);
  return !!tile?.tunnel?.open && (tile.tunnel.collapsedUntil ?? 0) <= now;
};

const hasActiveTunnelEntranceNear = (
  state: RuntimeState,
  side: Owner,
  pos: Position,
  radiusTiles = 2
): boolean =>
  state.buildings.some(
    (b) =>
      b.side === side &&
      b.type === "TUNNEL_ENTRANCE" &&
      isBuildingActive(b, state.elapsed) &&
      Math.abs(b.pos.x - pos.x) + Math.abs(b.pos.y - pos.y) <= radiusTiles
  );

const carveTunnelAround = (state: RuntimeState, side: Owner, center: Position, radiusTiles = 2) => {
  const tiles = islandTiles(state, side);
  for (let y = center.y - radiusTiles; y <= center.y + radiusTiles; y++) {
    for (let x = center.x - radiusTiles; x <= center.x + radiusTiles; x++) {
      if (x < 1 || y < 1 || x >= GRID_W - 1 || y >= GRID_H - 1) continue;
      if (Math.abs(x - center.x) + Math.abs(y - center.y) > radiusTiles + 1) continue;
      const tile = getTile(tiles, x, y);
      if (!tile || tile.terrain === "WATER") continue;
      tile.tunnel = { open: true, collapsedUntil: Math.max(0, tile.tunnel?.collapsedUntil ?? 0) };
    }
  }
};

const collapseTunnelsAt = (state: RuntimeState, side: Owner, wx: number, wy: number) => {
  const tiles = islandTiles(state, side);
  let collapsed = 0;
  for (const tile of tiles) {
    if (!tile.tunnel?.open) continue;
    const tw = tileToWorld(side, tile.x, tile.y);
    if (distance(tw.x, tw.y, wx, wy) <= TUNNEL_COLLAPSE_RADIUS) {
      tile.tunnel.collapsedUntil = state.elapsed + TUNNEL_COLLAPSE_SECONDS;
      collapsed++;
    }
  }
  for (const m of state.mechs) {
    if (m.side !== side || (m.layer ?? "SURFACE") !== "UNDERGROUND") continue;
    if (distance(m.pos.x, m.pos.y, wx, wy) <= TUNNEL_COLLAPSE_RADIUS) {
      m.hp = 0;
      clearMechPath(m);
    }
  }
  for (const m of state.mechs) {
    if (m.side === side) clearMechPath(m);
  }
  state.alerts.push({
    id: uid("a"),
    text: `TUNNEL COLLAPSE: ${collapsed} CELLS SEALED`,
    level: side === "PLAYER" ? "crit" : "info",
    ts: 3.5,
    category: "subterranean",
    side,
    worldPos: { x: wx, y: wy },
    suggestion: collapsed ? "Underground units in the blast zone are lost." : "No tunnel voids detected.",
  });
  spawnExplosion(state, side, wx, wy, true);
};

const setMechLayer = (m: Mech, layer: TileLayer) => {
  if ((m.layer ?? "SURFACE") === layer || (m.layerTransitionRemaining ?? 0) > 0) return;
  m.layer = layer;
  m.layerTransitionRemaining = TUNNEL_TRANSITION_SECONDS;
  clearMechPath(m);
};

export const launchMissile = (
  state: RuntimeState,
  side: Owner,
  type: ProjectileType,
  targetWX: number,
  targetWY: number,
  payload?: { mechId?: string }
): boolean => {
  const cost = WEAPON_COSTS[type];
  const fundsRef = side === "PLAYER" ? "playerFunds" : "enemyFunds";
  const energyRef = side === "PLAYER" ? "playerEnergy" : "enemyEnergy";
  if (state[fundsRef] < cost.funds || state[energyRef] < cost.energy) return false;

  // Need a launcher / mech bay alive on this side
  const requiresLauncher = type === "ICBM" || type === "DUMMY" || type === "AA" || type === "TUNNEL_BUSTER";
  const requiresMechBay = type === "TRANSPORT_POD";
  const requiresEmp = type === "EMP";
  const has = state.buildings.some(
    (b) =>
      b.side === side &&
      isBuildingActive(b, state.elapsed) &&
      ((requiresLauncher && b.type === "MISSILE_LAUNCHER") ||
        (requiresMechBay && b.type === "METAL_MARINE_BASE") ||
        (requiresEmp && b.type === "EMP_CANNON"))
  );
  if (!has) return false;

  state[fundsRef] -= cost.funds;
  state[energyRef] -= cost.energy;

  // Find the launcher to use as start position (or mech bay)
  const launcher = state.buildings.find(
    (b) =>
      b.side === side &&
      isBuildingActive(b, state.elapsed) &&
      ((requiresLauncher && b.type === "MISSILE_LAUNCHER") ||
        (requiresMechBay && b.type === "METAL_MARINE_BASE") ||
        (requiresEmp && b.type === "EMP_CANNON"))
  )!;
  const start = tileToWorld(side, launcher.pos.x, launcher.pos.y);
  const target = side === "PLAYER" ? "ENEMY" : "PLAYER";

  const speed =
    type === "TRANSPORT_POD"
      ? tileUnits(2)
      : type === "AA"
      ? tileUnits(6.4)
      : type === "EMP"
      ? tileUnits(3.65)
      : type === "TUNNEL_BUSTER"
      ? tileUnits(3.3)
      : tileUnits(2.95);
  const proj: Projectile = {
    id: uid("p"),
    type,
    owner: side,
    side: target,
    startWX: start.x,
    startWY: start.y,
    targetWX,
    targetWY,
    progress: 0,
    speed,
    payloadMechId: payload?.mechId,
  };
  state.projectiles.push(proj);
  if (side === "PLAYER") sfx("launch");
  if (type !== "AA") state.stats.missilesFired++;
  if (type === "TRANSPORT_POD") state.stats.marinesDeployed++;
  return true;
};

export const launchAAIntercept = (state: RuntimeState, side: Owner, target: Projectile): boolean => {
  const cost = WEAPON_COSTS.AA;
  const fundsRef = side === "PLAYER" ? "playerFunds" : "enemyFunds";
  const energyRef = side === "PLAYER" ? "playerEnergy" : "enemyEnergy";
  if (state[fundsRef] < cost.funds || state[energyRef] < cost.energy) return false;
  const launcher = state.buildings.find(
    (b) =>
      b.side === side &&
        isBuildingActive(b, state.elapsed) &&
      (b.type === "AA_GUN" || b.type === "MISSILE_LAUNCHER")
  );
  if (!launcher) return false;
  state[fundsRef] -= cost.funds;
  state[energyRef] -= cost.energy;
  const start = tileToWorld(side, launcher.pos.x, launcher.pos.y);
  const cur = projectileCurrentPos(target);
  const proj: Projectile = {
    id: uid("p"),
    type: "AA",
    owner: side,
    side: target.owner === side ? side : (side === "PLAYER" ? "ENEMY" : "PLAYER"),
    startWX: start.x,
    startWY: start.y,
    targetWX: cur.x,
    targetWY: cur.y,
    progress: 0,
    speed: tileUnits(7.25),
  };
  state.projectiles.push(proj);
  return true;
};

export const projectileCurrentPos = (p: Projectile): Position => {
  // Quadratic arc through midpoint with elevated peak.
  const t = p.progress;
  const x = p.startWX + (p.targetWX - p.startWX) * t;
  const baseY = p.startWY + (p.targetWY - p.startWY) * t;
  const arc = -Math.sin(t * Math.PI) * tileUnits(5);
  return { x, y: baseY + arc };
};

export const explodeAt = (
  state: RuntimeState,
  side: Owner,
  wx: number,
  wy: number,
  damage: number,
  splashRadius: number,
  big: boolean
) => {
  // Mark fog reveal
  const ti = worldToTile(side, wx, wy);
  revealAround(state, side, ti.x, ti.y, 1);

  // Damage buildings on that side
  for (const b of state.buildings) {
    if (b.side !== side) continue;
    const bw = tileToWorld(side, b.pos.x, b.pos.y);
    const d = distance(bw.x, bw.y, wx, wy);
    if (d <= splashRadius) {
      const falloff = 1 - d / Math.max(splashRadius, 1);
      const dmg = Math.max(0, damage * Math.max(0.25, falloff));
      b.hp -= dmg;
      if (b.hp <= 0 && b.type !== "LAND_MINE") {
        if (b.side === "PLAYER") state.stats.buildingsLost++;
        else state.stats.buildingsDestroyed++;
        spawnExplosion(state, side, bw.x, bw.y, true);
      }
    }
  }
  // Damage mechs on that side too (splash hits ground units)
  for (const m of state.mechs) {
    if (m.side !== side) continue;
    const d = distance(m.pos.x, m.pos.y, wx, wy);
    if (d <= splashRadius) {
      m.hp -= damage * 0.5;
    }
  }
  spawnExplosion(state, side, wx, wy, big);
  if (big) state.shake = Math.min(1, state.shake + 0.5);
  sfx("explosion");
};

export const spawnExplosion = (
  state: RuntimeState,
  side: Owner,
  wx: number,
  wy: number,
  big: boolean
) => {
  const n = big ? 36 : 18;
  const palette = big
    ? ["#fef3c7", "#fbbf24", "#f97316", "#dc2626", "#991b1b"]
    : ["#fde68a", "#fbbf24", "#f97316"];
  for (let i = 0; i < n; i++) {
    const a = rngRange(state, 0, Math.PI * 2);
    const sp = (big ? 100 : 60) * rngRange(state, 0.4, 1.2);
    state.particles.push({
      id: uid("pa"),
      side,
      pos: { x: wx, y: wy },
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0,
      maxLife: rngRange(state, 0.5, 1.1),
      color: palette[rngInt(state, 0, palette.length)],
      size: big ? rngRange(state, 2, 6) : rngRange(state, 1.5, 4),
    });
  }
};

export const revealAround = (
  state: RuntimeState,
  side: Owner,
  cx: number,
  cy: number,
  r: number
) => {
  if (side !== "ENEMY") return; // Player only sees enemy fog
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
      state.fogEnemy[tileIndex(x, y)] = true;
    }
  }
};

export const fullRevealRadar = (state: RuntimeState) => {
  const hasRadar = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "RADAR" && isBuildingActive(b, state.elapsed)
  );
  if (!hasRadar) return;
  // Radar reveals a wide swath but not entirely — center band of enemy island
  for (let y = 2; y < GRID_H - 2; y++) {
    for (let x = 2; x < GRID_W - 2; x++) {
      state.fogEnemy[tileIndex(x, y)] = true;
    }
  }
};

const computeRates = (state: RuntimeState) => {
  let f = 0;
  let e = 0;
  for (const b of state.buildings) {
    if (b.side !== "PLAYER" || !isBuildingActive(b, state.elapsed)) continue;
    const spec = BUILDINGS[b.type];
    const bonus = hasBiosphereSupport(state, b) ? 1 + BIOSPHERE_ECONOMY_BONUS : 1;
    f += (spec.fundsPerSec ?? 0) * bonus;
    e += (spec.energyPerSec ?? 0) * bonus;
  }
  state.playerFundsRate = f;
  state.playerEnergyRate = e;
};

const computeEnemyRates = (state: RuntimeState) => {
  let f = 0;
  let e = 0;
  for (const b of state.buildings) {
    if (b.side !== "ENEMY" || !isBuildingActive(b, state.elapsed)) continue;
    const spec = BUILDINGS[b.type];
    f += spec.fundsPerSec ?? 0;
    e += spec.energyPerSec ?? 0;
  }
  state.enemyFunds += f * 1; // applied per second below
  state.enemyEnergy += e * 1;
};
void computeEnemyRates;

const tickResources = (state: RuntimeState, dt: number) => {
  computeRates(state);
  state.playerFunds += state.playerFundsRate * dt;
  state.playerEnergy += state.playerEnergyRate * dt;

  let ef = 0;
  let ee = 0;
  for (const b of state.buildings) {
    if (b.side !== "ENEMY" || !isBuildingActive(b, state.elapsed)) continue;
    const spec = BUILDINGS[b.type];
    const bonus = hasBiosphereSupport(state, b) ? 1 + BIOSPHERE_ECONOMY_BONUS : 1;
    ef += (spec.fundsPerSec ?? 0) * bonus;
    ee += (spec.energyPerSec ?? 0) * bonus;
  }
  state.enemyFunds += ef * dt;
  state.enemyEnergy += ee * dt;
};

const tickBuildings = (state: RuntimeState, dt: number) => {
  for (const b of state.buildings) {
    if (b.buildTimeRemaining > 0) {
      b.buildTimeRemaining = Math.max(0, b.buildTimeRemaining - dt);
    }
    if (b.cooldown > 0) b.cooldown -= dt;
  }
  // Remove destroyed buildings (except HQ — kept to detect loss)
  for (let i = state.buildings.length - 1; i >= 0; i--) {
    const b = state.buildings[i];
    if (b.hp <= 0) {
      if (b.type === "HQ") continue; // Keep ruined HQ
      state.buildings.splice(i, 1);
    }
  }
};

const applyEmpAt = (state: RuntimeState, side: Owner, wx: number, wy: number) => {
  const ti = worldToTile(side, wx, wy);
  revealAround(state, side, ti.x, ti.y, 2);
  let disabled = 0;
  for (const b of state.buildings) {
    if (b.side !== side || b.hp <= 0 || b.type === "HQ" || b.type === "LAND_MINE") continue;
    const bw = tileToWorld(side, b.pos.x, b.pos.y);
    if (distance(bw.x, bw.y, wx, wy) <= EMP_SPLASH) {
      b.disabledUntil = Math.max(b.disabledUntil ?? 0, state.elapsed + EMP_DISABLE_SECONDS);
      b.cooldown = Math.max(b.cooldown, EMP_DISABLE_SECONDS * 0.35);
      disabled++;
    }
  }
  state.alerts.push({
    id: uid("a"),
    text: `${side === "PLAYER" ? "PLAYER" : "ENEMY"} GRID EMP: ${disabled} SYSTEMS DISABLED`,
    level: side === "PLAYER" ? "crit" : "info",
    ts: 3.5,
    category: "ewarfare",
    side,
    worldPos: { x: wx, y: wy },
    severity: disabled,
    suggestion: side === "PLAYER" ? "Protect power and radar assets." : "Exploit the disable window.",
  });
  spawnExplosion(state, side, wx, wy, false);
  state.shake = Math.min(1, state.shake + 0.25);
  sfx("intercept");
};

const mutateTerrain = (
  state: RuntimeState,
  side: Owner,
  pos: Position,
  sourceBuilding: string,
  duration = TOXIC_SLUDGE_SECONDS
): boolean => {
  const tiles = islandTiles(state, side);
  const tile = getTile(tiles, pos.x, pos.y);
  if (!tile || tile.terrain === "WATER" || tile.terrain === "MOUNTAIN" || tile.terrain === "TOXIC_SLUDGE") return false;
  if (state.buildings.some((b) => b.side === side && b.hp > 0 && b.pos.x === pos.x && b.pos.y === pos.y)) return false;
  const mutation: TerrainMutation = {
    id: uid("eco"),
    side,
    position: { ...pos },
    original: tile.terrain,
    mutated: "TOXIC_SLUDGE",
    expiresAt: state.elapsed + duration,
    sourceBuilding,
  };
  tile.terrain = mutation.mutated;
  state.terrainMutations.push(mutation);
  clearPathsOnSide(state, side);
  return true;
};

const startWeather = (state: RuntimeState, sourceSide: Owner, type: WeatherType) => {
  state.weatherActive = {
    type,
    startedAt: state.elapsed,
    duration: WEATHER_DURATION_SECONDS,
    intensity: type === "TREMOR" ? 0.85 : type === "FLOOD" ? 0.75 : 0.65,
    sourceSide,
  };
  state.stats.environmentalActions++;
  state.alerts.push({
    id: uid("a"),
    text: `${type.replace("_", " ")} FRONT ACTIVE`,
    level: sourceSide === "PLAYER" ? "info" : "warn",
    ts: 4,
    category: "ecology",
    side: opposingSide(sourceSide),
    suggestion: type === "TREMOR" ? "Defenses are less reliable during seismic instability." : "Movement and visibility are degraded.",
  });
};

const tickEcology = (state: RuntimeState) => {
  for (let i = state.terrainMutations.length - 1; i >= 0; i--) {
    const mutation = state.terrainMutations[i];
    if (mutation.expiresAt > state.elapsed) continue;
    const tile = getTile(islandTiles(state, mutation.side), mutation.position.x, mutation.position.y);
    if (tile && tile.terrain === mutation.mutated) tile.terrain = mutation.original;
    state.terrainMutations.splice(i, 1);
    clearPathsOnSide(state, mutation.side);
  }

  if (state.weatherActive && state.elapsed - state.weatherActive.startedAt >= state.weatherActive.duration) {
    state.weatherActive = undefined;
  }

  for (const b of state.buildings) {
    if (!isBuildingActive(b, state.elapsed) || b.cooldown > 0) continue;
    if (b.type === "TERRAIN_DESTABILIZER") {
      const targetSide = opposingSide(b.side);
      for (let tries = 0; tries < 18; tries++) {
        const pos = { x: rngInt(state, 1, GRID_W - 1), y: rngInt(state, 1, GRID_H - 1) };
        if (mutateTerrain(state, targetSide, pos, b.id)) {
          b.cooldown = TERRAIN_DESTABILIZER_COOLDOWN;
          state.stats.environmentalActions++;
          state.alerts.push({
            id: uid("a"),
            text: "TERRAIN DESTABILIZED",
            level: targetSide === "PLAYER" ? "warn" : "info",
            ts: 3.2,
            category: "ecology",
            side: targetSide,
            worldPos: tileToWorld(targetSide, pos.x, pos.y),
            suggestion: "Toxic sludge blocks surface movement and construction until it decays.",
          });
          break;
        }
      }
    } else if (b.type === "WEATHER_CONTROL" && !state.weatherActive) {
      const roll = rngInt(state, 0, 3);
      startWeather(state, b.side, roll === 0 ? "DUST_STORM" : roll === 1 ? "FLOOD" : "TREMOR");
      b.cooldown = WEATHER_CONTROL_COOLDOWN;
    } else if (b.type === "BIOSPHERE_ENGINE") {
      const nearby = state.buildings.find((other) => {
        if (other.side !== b.side || other.hp <= 0 || other.hp >= other.maxHp || other.type === "LAND_MINE") return false;
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        const ow = tileToWorld(other.side, other.pos.x, other.pos.y);
        return distance(bw.x, bw.y, ow.x, ow.y) <= (BUILDINGS.BIOSPHERE_ENGINE.range ?? 96);
      });
      if (nearby) {
        nearby.hp = Math.min(nearby.maxHp, nearby.hp + nearby.maxHp * 0.08);
        b.cooldown = BIOSPHERE_ENGINE_COOLDOWN;
      }
      const sludge = state.terrainMutations.find((m) => m.side === b.side && m.expiresAt > state.elapsed);
      if (sludge && state.elapsed + BIOSPHERE_REGEN_SECONDS < sludge.expiresAt) {
        sludge.expiresAt = state.elapsed + BIOSPHERE_REGEN_SECONDS;
      }
    }
  }
};

const tickJammers = (state: RuntimeState, dt: number) => {
  const ai = state.aiState;
  ai.jammerTick = (ai.jammerTick ?? JAMMER_FALSE_SIGNATURE_INTERVAL) - dt;
  if (ai.jammerTick > 0) return;
  ai.jammerTick = JAMMER_FALSE_SIGNATURE_INTERVAL;

  const enemyJammers = state.buildings.filter(
    (b) => b.side === "ENEMY" && b.type === "RADAR_JAMMER" && isBuildingActive(b, state.elapsed)
  );
  if (!enemyJammers.length) return;

  const x = rngInt(state, 1, GRID_W - 1);
  const y = rngInt(state, 1, GRID_H - 1);
  const target = tileToWorld("PLAYER", x, y);
  const source = tileToWorld("ENEMY", enemyJammers[0].pos.x, enemyJammers[0].pos.y);
  state.projectiles.push({
    id: uid("p"),
    type: "DUMMY",
    owner: "ENEMY",
    side: "PLAYER",
    startWX: source.x,
    startWY: source.y,
    targetWX: target.x,
    targetWY: target.y,
    progress: 0.72,
    speed: 95,
    falseSignature: true,
  });
};

const tickProjectiles = (state: RuntimeState, dt: number) => {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (p.intercepted) {
      const cur = projectileCurrentPos(p);
      spawnExplosion(state, p.side, cur.x, cur.y, false);
      state.projectiles.splice(i, 1);
      sfx("intercept");
      continue;
    }
    const dist = distance(p.startWX, p.startWY, p.targetWX, p.targetWY);
    p.progress += (p.speed * dt) / Math.max(dist, 1);

    // AA auto-intercept: any AA_GUN on landing side fires periodically
    if (p.type !== "AA") {
      // chance per tick proportional to dt
      const cur = projectileCurrentPos(p);
      // find nearest AA on the target side
      for (const b of state.buildings) {
        if (b.side !== p.side || b.type !== "AA_GUN") continue;
        if (!isBuildingActive(b, state.elapsed) || b.cooldown > 0) continue;
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        const r = BUILDINGS.AA_GUN.range ?? 220;
        if (distance(bw.x, bw.y, cur.x, cur.y) <= r) {
          // Fire interceptor
          b.cooldown = 1 / (BUILDINGS.AA_GUN.fireRate ?? 1.2);
          // 70% intercept chance for ICBMs/PODS, 100% for dummies
          const prob = p.type === "DUMMY" ? 1 : 0.7;
          if (rng(state) < prob) {
            p.intercepted = true;
          }
          break;
        }
      }
    }

    if (p.progress >= 1) {
      // Land
      if (p.type === "TRANSPORT_POD") {
        // Spawn mech at the target tile (if reachable)
        const ti = worldToTile(p.side, p.targetWX, p.targetWY);
        const tiles = p.side === "PLAYER" ? state.playerIsland : state.enemyIsland;
        const t = getTile(tiles, ti.x, ti.y);
        if (t && t.terrain !== "WATER") {
          revealAround(state, p.side, ti.x, ti.y, 2);
          const wp = tileToWorld(p.side, ti.x, ti.y);
          state.mechs.push({
            id: uid("m"),
            owner: p.owner,
            side: p.side,
            pos: { x: wp.x, y: wp.y },
            hp: MECH_HP,
            maxHp: MECH_HP,
            state: "WALKING",
            attackCooldown: 0,
          });
          sfx("land");
        } else {
          spawnExplosion(state, p.side, p.targetWX, p.targetWY, false);
        }
      } else if (p.type === "ICBM") {
        explodeAt(state, p.side, p.targetWX, p.targetWY, ICBM_DAMAGE, ICBM_SPLASH, true);
      } else if (p.type === "EMP") {
        applyEmpAt(state, p.side, p.targetWX, p.targetWY);
      } else if (p.type === "TUNNEL_BUSTER") {
        collapseTunnelsAt(state, p.side, p.targetWX, p.targetWY);
      } else if (p.type === "DUMMY") {
        spawnExplosion(state, p.side, p.targetWX, p.targetWY, false);
        const ti = worldToTile(p.side, p.targetWX, p.targetWY);
        revealAround(state, p.side, ti.x, ti.y, 1);
      } else if (p.type === "AA") {
        // Try to intercept any nearby projectile
        let best: Projectile | null = null;
        let bestD = Infinity;
        for (const q of state.projectiles) {
          if (q === p || q.type === "AA" || q.intercepted) continue;
          const cq = projectileCurrentPos(q);
          const d = distance(cq.x, cq.y, p.targetWX, p.targetWY);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
        if (best && bestD < 80) best.intercepted = true;
        spawnExplosion(state, p.side, p.targetWX, p.targetWY, false);
      }
      state.projectiles.splice(i, 1);
    }
  }
};

const tickMechs = (state: RuntimeState, dt: number) => {
  for (let i = state.mechs.length - 1; i >= 0; i--) {
    const m = state.mechs[i];
    m.layer ??= "SURFACE";
    if ((m.layerTransitionRemaining ?? 0) > 0) {
      m.layerTransitionRemaining = Math.max(0, (m.layerTransitionRemaining ?? 0) - dt);
      continue;
    }
    if (m.hp <= 0) {
      spawnExplosion(state, m.side, m.pos.x, m.pos.y, true);
      state.mechs.splice(i, 1);
      continue;
    }
    const currentTile = worldToTile(m.side, m.pos.x, m.pos.y);
    const tiles = m.side === "PLAYER" ? state.playerIsland : state.enemyIsland;
    const layer = m.layer ?? "SURFACE";
    if (layer === "UNDERGROUND" && !isTunnelOpen(tiles, currentTile, state.elapsed)) {
      m.hp = 0;
      clearMechPath(m);
      continue;
    }

    const shouldGoUnderground =
      layer === "SURFACE" &&
      isTunnelOpen(tiles, currentTile, state.elapsed) &&
      hasActiveTunnelEntranceNear(state, m.side, currentTile) &&
      (m.owner === "PLAYER" || state.elapsed > 50);
    const shouldSurface =
      layer === "UNDERGROUND" &&
      hasActiveTunnelEntranceNear(state, m.side, currentTile, 1) &&
      state.buildings.some((b) => b.side === m.side && b.hp > 0 && distance(tileToWorld(b.side, b.pos.x, b.pos.y).x, tileToWorld(b.side, b.pos.x, b.pos.y).y, m.pos.x, m.pos.y) <= MECH_ATTACK_RANGE * 1.5);
    if (shouldGoUnderground) setMechLayer(m, "UNDERGROUND");
    if (shouldSurface) setMechLayer(m, "SURFACE");

    // Find nearest enemy building on this side
    let target: Building | undefined;
    let bestD = Infinity;
    for (const b of state.buildings) {
      if (b.side !== m.side) continue;
      if (b.hp <= 0) continue;
      const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
      const d = distance(bw.x, bw.y, m.pos.x, m.pos.y);
      if (d < bestD) {
        bestD = d;
        target = b;
      }
    }

    // Land mines: detonate beneath us
    for (const b of state.buildings) {
      if (layer === "SURFACE" && b.side === m.side && b.type === "LAND_MINE" && b.hp > 0) {
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        if (distance(bw.x, bw.y, m.pos.x, m.pos.y) < 18) {
          const dmg = BUILDINGS.LAND_MINE.damage ?? 60;
          m.hp -= dmg;
          b.hp = 0;
          spawnExplosion(state, b.side, bw.x, bw.y, true);
          sfx("explosion");
        }
      }
    }

    // Gun turrets shoot at us
    for (const b of state.buildings) {
      if (b.side !== m.side || b.type !== "GUN_TURRET" || b.hp <= 0) continue;
      if (layer === "UNDERGROUND" && (m.detectedUntil ?? 0) <= state.elapsed) continue;
      if (!isBuildingActive(b, state.elapsed) || b.cooldown > 0) continue;
      const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
      const r = BUILDINGS.GUN_TURRET.range ?? 110;
      if (distance(bw.x, bw.y, m.pos.x, m.pos.y) <= r) {
        b.cooldown = 1 / (BUILDINGS.GUN_TURRET.fireRate ?? 0.6);
        const weatherPenalty = state.weatherActive?.type === "TREMOR" ? 1 - TREMOR_DEFENSE_PENALTY : 1;
        m.hp -= (BUILDINGS.GUN_TURRET.damage ?? 14) * weatherPenalty;
        // Tracer particle
        state.particles.push({
          id: uid("pa"),
          side: b.side,
          pos: { x: bw.x, y: bw.y },
          vx: (m.pos.x - bw.x) * 6,
          vy: (m.pos.y - bw.y) * 6,
          life: 0,
          maxLife: 0.12,
          color: "#fde68a",
          size: 1.5,
        });
      }
    }

    if (!target) continue;
    const tw = tileToWorld(target.side, target.pos.x, target.pos.y);
    const dx = tw.x - m.pos.x;
    const dy = tw.y - m.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > MECH_ATTACK_RANGE) {
      m.state = "WALKING";
      const nextWaypoint = m.path?.[m.waypointIndex ?? 0];
      const waypointBlocked = nextWaypoint
        ? !isPathableTile(tiles, state.buildings, m.side, nextWaypoint.x, nextWaypoint.y, {
            allowOccupiedStart: true,
            start: currentTile,
            layer,
            now: state.elapsed,
          })
        : false;
      const pathExhausted = !!m.path?.length && (m.waypointIndex ?? 0) >= m.path.length;
      if (m.pathTargetId !== target.id || !m.path?.length || waypointBlocked || pathExhausted) {
        m.path = findPathToAdjacentBuilding(tiles, state.buildings, m.side, currentTile, target, {
          layer,
          now: state.elapsed,
        });
        m.pathTargetId = target.id;
        m.waypointIndex = m.path.length > 1 ? 1 : 0;
      }

      const waypoint = m.path?.[m.waypointIndex ?? 0];
      if (waypoint) {
        const ww = tileToWorld(m.side, waypoint.x, waypoint.y);
        const wdx = ww.x - m.pos.x;
        const wdy = ww.y - m.pos.y;
        const wd = Math.hypot(wdx, wdy);
        const step = MECH_SPEED * (layer === "UNDERGROUND" ? TUNNEL_MOVE_MULTIPLIER : 1) * weatherSpeedMultiplier(state, m) * dt;
        if (wd <= step || wd < 1) {
          m.pos.x = ww.x;
          m.pos.y = ww.y;
          m.waypointIndex = Math.min((m.waypointIndex ?? 0) + 1, m.path.length);
        } else {
          m.pos.x += (wdx / wd) * step;
          m.pos.y += (wdy / wd) * step;
        }
      } else {
        clearMechPath(m);
      }
    } else {
      m.state = "ATTACKING";
      clearMechPath(m);
      m.attackCooldown -= dt;
      if (m.attackCooldown <= 0) {
        m.attackCooldown = MECH_ATTACK_COOLDOWN;
        target.hp -= MECH_DAMAGE;
        state.particles.push({
          id: uid("pa"),
          side: target.side,
          pos: { x: m.pos.x, y: m.pos.y },
          vx: (tw.x - m.pos.x) * 4,
          vy: (tw.y - m.pos.y) * 4,
          life: 0,
          maxLife: 0.18,
          color: "#fca5a5",
          size: 2,
        });
        if (target.hp <= 0) {
          spawnExplosion(state, target.side, tw.x, tw.y, true);
          if (target.side === "PLAYER") state.stats.buildingsLost++;
          else state.stats.buildingsDestroyed++;
        }
      }
    }
  }
};

const tickSeismicSensors = (state: RuntimeState) => {
  const sensors = state.buildings.filter(
    (b) => b.type === "SEISMIC_SENSOR" && isBuildingActive(b, state.elapsed)
  );
  if (!sensors.length) return;
  for (const m of state.mechs) {
    if ((m.layer ?? "SURFACE") !== "UNDERGROUND") continue;
    for (const sensor of sensors) {
      if (sensor.side !== m.side) continue;
      const sw = tileToWorld(sensor.side, sensor.pos.x, sensor.pos.y);
      if (distance(sw.x, sw.y, m.pos.x, m.pos.y) <= SEISMIC_SENSOR_RANGE) {
        m.detectedUntil = Math.max(m.detectedUntil ?? 0, state.elapsed + SEISMIC_DETECTION_SECONDS);
        if (sensor.side === "PLAYER") {
          const t = worldToTile(sensor.side, m.pos.x, m.pos.y);
          state.alerts.push({
            id: uid("a"),
            text: "SEISMIC CONTACT BELOW GRID",
            level: "warn",
            ts: 2.5,
            category: "subterranean",
            side: sensor.side,
            worldPos: { ...m.pos },
            suggestion: `Target tile ${t.x + 1},${t.y + 1} with a tunnel buster.`,
          });
        }
        break;
      }
    }
  }
};

const tickParticles = (state: RuntimeState, dt: number) => {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dt;
    p.pos.x += p.vx * dt;
    p.pos.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.life >= p.maxLife) state.particles.splice(i, 1);
  }
};

const tickShake = (state: RuntimeState, dt: number) => {
  state.shake = Math.max(0, state.shake - dt * 1.5);
};

const checkWinLoss = (state: RuntimeState) => {
  const playerHQ = state.buildings.find((b) => b.side === "PLAYER" && b.type === "HQ");
  const enemyHQ = state.buildings.find((b) => b.side === "ENEMY" && b.type === "HQ");
  if (!playerHQ || playerHQ.hp <= 0) {
    state.status = "DEFEAT";
    sfx("defeat");
  } else if (!enemyHQ || enemyHQ.hp <= 0) {
    state.status = "VICTORY";
    sfx("victory");
  }
};

// ----------------- Enemy AI -----------------
type AiAction =
  | { kind: "build"; building: BuildingType; score: number; reason: string }
  | { kind: "attack"; projectile: ProjectileType; target: Building; score: number; reason: string };

const countBuildingsByType = (buildings: Building[], side: Owner): Record<BuildingType, number> => {
  const counts: Record<BuildingType, number> = {
    HQ: 0,
    ENERGY_PLANT: 0,
    SUPPLY_DEPOT: 0,
    RADAR: 0,
    RADAR_JAMMER: 0,
    TUNNEL_ENTRANCE: 0,
    SEISMIC_SENSOR: 0,
    TERRAIN_DESTABILIZER: 0,
    WEATHER_CONTROL: 0,
    BIOSPHERE_ENGINE: 0,
    MISSILE_LAUNCHER: 0,
    EMP_CANNON: 0,
    METAL_MARINE_BASE: 0,
    AA_GUN: 0,
    GUN_TURRET: 0,
    LAND_MINE: 0,
  };
  for (const b of buildings) {
    if (b.side === side && b.hp > 0) counts[b.type]++;
  }
  return counts;
};

const updateAiMemory = (state: RuntimeState) => {
  const memory = state.aiState.memory;
  const radarOnline = state.buildings.some(
    (b) => b.side === "ENEMY" && b.type === "RADAR" && isBuildingActive(b, state.elapsed)
  );
  for (const b of state.buildings) {
    if (b.side !== "PLAYER" || b.hp <= 0) continue;
    if (radarOnline || b.type === "HQ" || b.buildTimeRemaining <= 0) {
      memory.seenPlayerBuildings[b.id] = { type: b.type, pos: b.pos, lastSeenAt: state.elapsed };
    }
  }
  for (const [id, sighting] of Object.entries(memory.seenPlayerBuildings)) {
    if (state.elapsed - sighting.lastSeenAt > 90) delete memory.seenPlayerBuildings[id];
  }
  const recentIntercepts = state.projectiles.filter(
    (p) => p.owner === "ENEMY" && p.side === "PLAYER" && p.intercepted
  ).length;
  memory.aaProbeScore = Math.max(0, memory.aaProbeScore * 0.98 + recentIntercepts * 0.04);
};

const scoreAiActions = (
  state: RuntimeState,
  mission: MissionDef,
  counts: Record<BuildingType, number>
): AiAction[] => {
  const memory = state.aiState.memory;
  const agg = mission.enemyAggression;
  const eco = mission.enemyEcoBias;
  const actions: AiAction[] = [];
  const playerTargets = state.buildings.filter((b) => b.side === "PLAYER" && b.hp > 0);
  const hq = playerTargets.find((b) => b.type === "HQ") ?? playerTargets[0];
  const playerAa = playerTargets.filter((b) => b.type === "AA_GUN").length;
  const playerPower = playerTargets.find((b) => b.type === "ENERGY_PLANT") ?? hq;
  const playerRadar = playerTargets.find((b) => b.type === "RADAR") ?? hq;

  const addBuild = (building: BuildingType, score: number, reason: string) => {
    const cost = getBuildingCost(state.buildings, "ENEMY", building);
    if (state.enemyFunds >= cost.funds && state.enemyEnergy >= cost.energy) {
      actions.push({ kind: "build", building, score, reason });
    }
  };
  const addAttack = (projectile: ProjectileType, target: Building | undefined, score: number, reason: string) => {
    if (!target) return;
    const cost = WEAPON_COSTS[projectile];
    if (state.enemyFunds >= cost.funds && state.enemyEnergy >= cost.energy) {
      actions.push({ kind: "attack", projectile, target, score, reason });
    }
  };

  addBuild("ENERGY_PLANT", 80 * eco - counts.ENERGY_PLANT * 18 + Math.max(0, 180 - state.enemyEnergy) * 0.12, "power-growth");
  addBuild("SUPPLY_DEPOT", 72 * eco - counts.SUPPLY_DEPOT * 16 + Math.max(0, 350 - state.enemyFunds) * 0.08, "funds-growth");
  addBuild("AA_GUN", 48 + state.stats.missilesFired * 2 - counts.AA_GUN * 18, "anti-missile-screen");
  addBuild("MISSILE_LAUNCHER", counts.MISSILE_LAUNCHER ? 15 : 75 + agg * 20, "unlock-strikes");
  addBuild("METAL_MARINE_BASE", counts.METAL_MARINE_BASE ? 8 : 52 + agg * 45 - playerAa * 4, "ground-assault");
  addBuild("GUN_TURRET", 32 + state.mechs.filter((m) => m.side === "ENEMY").length * 25 - counts.GUN_TURRET * 14, "base-defense");
  addBuild("RADAR", counts.RADAR ? 8 : 45 + Object.keys(memory.seenPlayerBuildings).length * 2, "target-intel");
  addBuild("RADAR_JAMMER", counts.RADAR_JAMMER ? 12 : 42 + playerAa * 9 + agg * 20, "jam-defense");
  addBuild("EMP_CANNON", counts.EMP_CANNON ? 10 : 48 + playerAa * 6 + (playerPower ? 12 : 0), "disable-grid");
  addBuild("TUNNEL_ENTRANCE", counts.TUNNEL_ENTRANCE ? 14 : 44 + agg * 25 - counts.SEISMIC_SENSOR * 4, "subsurface-maneuver");
  addBuild("SEISMIC_SENSOR", counts.SEISMIC_SENSOR ? 10 : 36 + state.stats.marinesDeployed * 3, "tunnel-watch");
  addBuild("TERRAIN_DESTABILIZER", counts.TERRAIN_DESTABILIZER ? 12 : 36 + agg * 18 + Object.keys(memory.seenPlayerBuildings).length * 2, "terrain-denial");
  addBuild("WEATHER_CONTROL", counts.WEATHER_CONTROL ? 9 : 34 + agg * 16 + playerAa * 4, "weather-control");
  addBuild("BIOSPHERE_ENGINE", counts.BIOSPHERE_ENGINE ? 10 : 28 + eco * 18, "eco-resilience");

  if (counts.MISSILE_LAUNCHER > 0) {
    addAttack("DUMMY", hq, state.elapsed - memory.lastProbeAt > 20 ? 50 + playerAa * 12 : 12, "aa-probe");
    addAttack("ICBM", hq, 44 + agg * 45 - memory.aaProbeScore * 12 - playerAa * 3, "hq-strike");
    const weakTarget = playerTargets
      .filter((b) => b.type !== "HQ")
      .sort((a, b) => a.hp - b.hp || a.pos.y - b.pos.y)[0];
    addAttack("ICBM", weakTarget, 32 + agg * 20, "finish-weak-asset");
  }
  if (counts.METAL_MARINE_BASE > 0) {
    addAttack("TRANSPORT_POD", playerAa > 2 ? playerRadar : hq, 45 + agg * 50 - playerAa * 5 + memory.aaProbeScore * 5, "mech-drop");
  }
  if (counts.EMP_CANNON > 0) {
    addAttack("EMP", playerPower, 52 + playerAa * 7, "power-disable");
    addAttack("EMP", playerRadar, 44 + counts.RADAR_JAMMER * 10, "blind-radar");
  }
  if (counts.MISSILE_LAUNCHER > 0 && counts.SEISMIC_SENSOR > 0) {
    addAttack("TUNNEL_BUSTER", hq, 34 + state.mechs.filter((m) => m.side === "PLAYER" && (m.layer ?? "SURFACE") === "UNDERGROUND").length * 35, "collapse-tunnels");
  }

  return actions.sort((a, b) => b.score - a.score || a.reason.localeCompare(b.reason));
};

const aiTick = (state: RuntimeState, mission: MissionDef, dt: number) => {
  const ai = state.aiState;
  ai.nextActionAt -= dt;
  if (ai.nextActionAt > 0) return;

  // Update phase based on count and time
  if (state.elapsed > 25 && ai.phase === "ECO") ai.phase = "ARMY";
  if (state.elapsed > 60 && ai.phase === "ARMY") ai.phase = "ASSAULT";

  const agg = mission.enemyAggression;
  const counts = countBuildingsByType(state.buildings, "ENEMY");
  updateAiMemory(state);
  const action = scoreAiActions(state, mission, counts)[0];
  if (action?.kind === "build") {
    for (let i = 0; i < 24; i++) {
      const spread = i < 10 ? 2 : 1;
      const x = rngInt(state, spread, GRID_W - spread);
      const y = rngInt(state, spread, GRID_H - spread);
      if (buildBuilding(state, "ENEMY", action.building, x, y)) {
        ai.builtCount++;
        ai.memory.lastDecision = `build:${action.building}:${action.reason}:${action.score.toFixed(1)}`;
        break;
      }
    }
  } else if (action?.kind === "attack") {
    const w = tileToWorld("PLAYER", action.target.pos.x, action.target.pos.y);
    if (launchMissile(state, "ENEMY", action.projectile, w.x, w.y)) {
      if (action.projectile === "DUMMY") ai.memory.lastProbeAt = state.elapsed;
      ai.memory.lastDecision = `attack:${action.projectile}:${action.reason}:${action.score.toFixed(1)}`;
    }
  }

  // Schedule next action
  const base = ai.phase === "ECO" ? 4.5 : ai.phase === "ARMY" ? 3.2 : 2.0;
  ai.nextActionAt = base * rngRange(state, 0.7, 1.3) * (1.2 - agg * 0.4);

  // AI defensively launches AA when something inbound
  for (const p of state.projectiles) {
    if (p.owner === "PLAYER" && p.side === "ENEMY" && !p.intercepted) {
      if (rng(state) < 0.25 * agg) {
        launchAAIntercept(state, "ENEMY", p);
      }
    }
  }
};

// Player auto AA: AA_GUNs auto-fire (handled in tickProjectiles).

const tickAlerts = (state: RuntimeState, dt: number) => {
  for (let i = state.alerts.length - 1; i >= 0; i--) {
    state.alerts[i].ts -= dt;
    if (state.alerts[i].ts <= 0) state.alerts.splice(i, 1);
  }
};

let alertCooldown = 0;
const detectIncoming = (state: RuntimeState, dt: number) => {
  alertCooldown -= dt;
  if (alertCooldown > 0) return;
  const incoming = state.projectiles.filter(
    (p) => p.owner === "ENEMY" && p.side === "PLAYER" && p.type !== "AA" && !p.intercepted
  );
  if (incoming.length > 0) {
    state.alerts.push({
      id: uid("a"),
      text: `INCOMING ${incoming[0].type === "TRANSPORT_POD" ? "TRANSPORT POD" : incoming[0].type}`,
      level: "crit",
      ts: 3,
    });
    alertCooldown = 2;
    sfx("alert");
  }
};

export const stepGame = (state: RuntimeState, mission: MissionDef, dt: number) => {
  if (state.status !== "PLAYING") return;
  state.elapsed += dt;
  tickResources(state, dt);
  tickBuildings(state, dt);
  tickEcology(state);
  fullRevealRadar(state);
  tickJammers(state, dt);
  tickProjectiles(state, dt);
  tickSeismicSensors(state);
  tickMechs(state, dt);
  tickParticles(state, dt);
  tickShake(state, dt);
  tickAlerts(state, dt);
  detectIncoming(state, dt);
  aiTick(state, mission, dt);
  checkWinLoss(state);
};
