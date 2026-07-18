import {
  AA_BASE_HIT_CHANCE,
  AA_RADAR_HIT_BONUS,
  BUILDINGS,
  BIOSPHERE_ECONOMY_BONUS,
  BIOSPHERE_ENGINE_COOLDOWN,
  BIOSPHERE_REGEN_SECONDS,
  DUST_STORM_MECH_SPEED_MULTIPLIER,
  EMP_DISABLE_SECONDS,
  EMP_SPLASH,
  FACTORY_AIRCRAFT_COST,
  FACTORY_AIRCRAFT_INTERVAL,
  FACTORY_BUILD_SPEED_BONUS,
  FACTORY_VEHICLE_COST,
  FACTORY_VEHICLE_INTERVAL,
  GRID_H,
  GRID_W,
  GUNNER_II_ENERGY_PREMIUM,
  GUNNER_II_FUNDS_PREMIUM,
  ICBM_DAMAGE,
  ICBM_SPLASH,
  ISLAND_PX_H,
  ISLAND_PX_W,
  MAX_AIRCRAFT_PER_SIDE,
  MAX_ASSAULT_MECHS,
  MAX_VEHICLES_PER_SIDE,
  MECH_ATTACK_COOLDOWN,
  MECH_DAMAGE,
  MECH_DAMAGE_GUNNER_II,
  MECH_HP,
  MECH_HP_GUNNER_II,
  MECH_SPEED,
  MECH_SPEED_GUNNER_II,
  AIRCRAFT_AA_DAMAGE,
  AIRCRAFT_ATTACK_COOLDOWN,
  AIRCRAFT_ATTACK_RANGE,
  AIRCRAFT_DAMAGE,
  AIRCRAFT_HP,
  AIRCRAFT_SPEED,
  VEHICLE_ATTACK_COOLDOWN,
  VEHICLE_ATTACK_RANGE,
  VEHICLE_DAMAGE,
  VEHICLE_HP,
  VEHICLE_SPEED,
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
  Aircraft,
  Building,
  BuildingType,
  Mech,
  MechWeaponMode,
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
  Vehicle,
  WeatherType,
} from "./types";
import { sfx } from "../lib/sfx";

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

export const footprintTiles = (type: BuildingType, x: number, y: number): Position[] => {
  const spec = BUILDINGS[type];
  const fw = spec.footprintW ?? 1;
  const fh = spec.footprintH ?? 1;
  const tiles: Position[] = [];
  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
};

export const buildingOccupies = (b: Building, x: number, y: number): boolean => {
  const fw = b.footprintW ?? 1;
  const fh = b.footprintH ?? 1;
  return x >= b.pos.x && x < b.pos.x + fw && y >= b.pos.y && y < b.pos.y + fh;
};

/** ICBM silo can fire only when every footprint tile is still part of a living silo (hp > 0). */
export const isIcbmSiloIntact = (b: Building): boolean =>
  b.type === "ICBM_SILO" && b.hp > 0 && b.buildTimeRemaining <= 0;

export const isBuildable = (
  tiles: Tile[],
  buildings: Building[],
  side: Owner,
  type: BuildingType,
  x: number,
  y: number
): boolean => {
  const spec = BUILDINGS[type];
  const fw = spec.footprintW ?? 1;
  const fh = spec.footprintH ?? 1;
  if (x < 0 || y < 0 || x + fw > GRID_W || y + fh > GRID_H) return false;

  if (spec.maxPerSide != null) {
    const living = buildings.filter((b) => b.side === side && b.type === type && b.hp > 0).length;
    if (living >= spec.maxPerSide) return false;
  }

  for (const cell of footprintTiles(type, x, y)) {
    const t = getTile(tiles, cell.x, cell.y);
    if (!t) return false;
    if (t.terrain === "WATER") return false;
    if (t.terrain === "MOUNTAIN") return false;
    if (t.terrain === "TOXIC_SLUDGE") return false;
    if (t.terrain === "FOREST" && type !== "LAND_MINE") return false;
    const occ = buildings.some(
      (b) => b.side === side && b.hp > 0 && buildingOccupies(b, cell.x, cell.y)
    );
    if (occ) return false;
  }
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
  const fw = spec.footprintW ?? 1;
  const fh = spec.footprintH ?? 1;
  // Factory bonus shortens remaining build time for new structures
  const factories = state.buildings.filter(
    (b) => b.side === side && b.type === "FACTORY" && isBuildingActive(b, state.elapsed)
  ).length;
  const speed = 1 + factories * FACTORY_BUILD_SPEED_BONUS;
  const buildTime = spec.buildTime / speed;
  state.buildings.push({
    id: uid("b"),
    type,
    owner: side,
    side,
    pos: { x, y },
    footprintW: fw,
    footprintH: fh,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    buildTimeRemaining: buildTime,
    buildTimeTotal: buildTime,
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
  let cost = { ...WEAPON_COSTS[type] };
  if (type === "TRANSPORT_POD" && state.selectedMechTier === "GUNNER_II") {
    cost = {
      funds: cost.funds + GUNNER_II_FUNDS_PREMIUM,
      energy: cost.energy + GUNNER_II_ENERGY_PREMIUM,
    };
  }
  const fundsRef = side === "PLAYER" ? "playerFunds" : "enemyFunds";
  const energyRef = side === "PLAYER" ? "playerEnergy" : "enemyEnergy";
  if (state[fundsRef] < cost.funds || state[energyRef] < cost.energy) return false;

  // Assault cap: original Metal Marines limited concurrent marine drops
  if (type === "TRANSPORT_POD") {
    const assaulting = state.mechs.filter((m) => m.owner === side && m.hp > 0).length;
    const inbound = state.projectiles.filter((p) => p.owner === side && p.type === "TRANSPORT_POD").length;
    if (assaulting + inbound >= MAX_ASSAULT_MECHS) return false;
  }

  const requiresLauncher = type === "DUMMY" || type === "AA" || type === "TUNNEL_BUSTER";
  const requiresIcbmSilo = type === "ICBM";
  const requiresMechBay = type === "TRANSPORT_POD";
  const requiresEmp = type === "EMP";
  const has = state.buildings.some((b) => {
    if (b.side !== side || !isBuildingActive(b, state.elapsed)) return false;
    if (requiresIcbmSilo) return isIcbmSiloIntact(b);
    if (requiresLauncher && b.type === "MISSILE_LAUNCHER") return true;
    if (requiresMechBay && b.type === "METAL_MARINE_BASE") return true;
    if (requiresEmp && b.type === "EMP_CANNON") return true;
    return false;
  });
  if (!has) return false;

  state[fundsRef] -= cost.funds;
  state[energyRef] -= cost.energy;

  const launcher = state.buildings.find((b) => {
    if (b.side !== side || !isBuildingActive(b, state.elapsed)) return false;
    if (requiresIcbmSilo) return isIcbmSiloIntact(b);
    if (requiresLauncher && b.type === "MISSILE_LAUNCHER") return true;
    if (requiresMechBay && b.type === "METAL_MARINE_BASE") return true;
    if (requiresEmp && b.type === "EMP_CANNON") return true;
    return false;
  })!;
  const start = tileToWorld(side, launcher.pos.x + Math.floor((launcher.footprintW ?? 1) / 2), launcher.pos.y + Math.floor((launcher.footprintH ?? 1) / 2));
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

  // Damage buildings on that side (use footprint center for multi-tile)
  for (const b of state.buildings) {
    if (b.side !== side) continue;
    const cx = b.pos.x + Math.floor((b.footprintW ?? 1) / 2);
    const cy = b.pos.y + Math.floor((b.footprintH ?? 1) / 2);
    const bw = tileToWorld(side, cx, cy);
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
  for (const v of state.vehicles) {
    if (v.side !== side || v.state === "DEAD") continue;
    const d = distance(v.pos.x, v.pos.y, wx, wy);
    if (d <= splashRadius) {
      v.hp -= damage * 0.45;
    }
  }
  for (const a of state.aircraft) {
    if (a.state === "DEAD") continue;
    // Any gunship over the strike island takes light splash
    if (!inIsland(side, a.pos.x, a.pos.y)) continue;
    const d = distance(a.pos.x, a.pos.y, wx, wy);
    if (d <= splashRadius * 1.25) {
      a.hp -= damage * 0.35;
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
  // Anchor flipbook particle
  state.particles.push({
    id: uid("pa"),
    side,
    pos: { x: wx, y: wy },
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: big ? 0.45 : 0.32,
    color: "#fbbf24",
    size: big ? 48 : 32,
    fx: "explosion",
  });
  state.particles.push({
    id: uid("pa"),
    side,
    pos: { x: wx, y: wy - 6 },
    vx: 0,
    vy: -12,
    life: 0,
    maxLife: 0.55,
    color: "#94a3b8",
    size: 36,
    fx: "smoke",
  });
  const n = big ? 18 : 10;
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
  for (const side of ["PLAYER", "ENEMY"] as Owner[]) {
    const factories = state.buildings.filter(
      (b) => b.side === side && b.type === "FACTORY" && isBuildingActive(b, state.elapsed)
    ).length;
    const speed = 1 + factories * FACTORY_BUILD_SPEED_BONUS;
    for (const b of state.buildings) {
      if (b.side !== side) continue;
      if (b.buildTimeRemaining > 0) {
        b.buildTimeRemaining = Math.max(0, b.buildTimeRemaining - dt * speed);
      }
      if (b.cooldown > 0) b.cooldown -= dt;
    }
  }
  // Remove destroyed buildings (keep ruined HQs for end-screen / multi-base accounting)
  for (let i = state.buildings.length - 1; i >= 0; i--) {
    const b = state.buildings[i];
    if (b.hp <= 0) {
      if (b.type === "HQ") continue;
      state.buildings.splice(i, 1);
    }
  }
};

const aaHitChance = (state: RuntimeState, side: Owner, projectileType: ProjectileType): number => {
  if (projectileType === "DUMMY") return 1;
  const radars = state.buildings.filter(
    (b) => b.side === side && b.type === "RADAR" && isBuildingActive(b, state.elapsed)
  ).length;
  return Math.min(1, AA_BASE_HIT_CHANCE + radars * AA_RADAR_HIT_BONUS);
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
          // Original formula: 50% base + 5% per Radar, capped at 100%
          const prob = aaHitChance(state, b.side, p.type);
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
          const tier = p.owner === "PLAYER" ? state.selectedMechTier : "GUNNER_I";
          const weaponMode: MechWeaponMode =
            p.owner === "PLAYER" ? state.selectedMechWeapon : "NORMAL";
          const maxHp = tier === "GUNNER_II" ? MECH_HP_GUNNER_II : MECH_HP;
          state.mechs.push({
            id: uid("m"),
            owner: p.owner,
            side: p.side,
            pos: { x: wp.x, y: wp.y },
            hp: maxHp,
            maxHp,
            state: "LANDING",
            attackCooldown: 0.35,
            tier,
            weaponMode,
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

    // Gun turrets and Gun Pods shoot at us
    for (const b of state.buildings) {
      if (b.side !== m.side || (b.type !== "GUN_TURRET" && b.type !== "GUN_POD") || b.hp <= 0) continue;
      if (layer === "UNDERGROUND" && (m.detectedUntil ?? 0) <= state.elapsed) continue;
      if (!isBuildingActive(b, state.elapsed) || b.cooldown > 0) continue;
      const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
      const spec = BUILDINGS[b.type];
      const r = spec.range ?? 110;
      if (distance(bw.x, bw.y, m.pos.x, m.pos.y) <= r) {
        b.cooldown = 1 / (spec.fireRate ?? 0.6);
        const weatherPenalty = state.weatherActive?.type === "TREMOR" ? 1 - TREMOR_DEFENSE_PENALTY : 1;
        // Anti-POD weapon mode takes reduced damage from pods; Anti-MMR takes more from pods conceptually reversed for bunker→mech
        let incoming = (spec.damage ?? 14) * weatherPenalty;
        if (b.type === "GUN_POD" && m.weaponMode === "ANTI_POD") incoming *= 0.55;
        if (b.type === "GUN_POD" && m.weaponMode === "ANTI_MMR") incoming *= 1.15;
        m.hp -= incoming;
        // Tracer particle
        state.particles.push({
          id: uid("pa"),
          side: b.side,
          pos: { x: bw.x, y: bw.y },
          vx: (m.pos.x - bw.x) * 6,
          vy: (m.pos.y - bw.y) * 6,
          life: 0,
          maxLife: 0.12,
          color: b.type === "GUN_POD" ? "#fca5a5" : "#fde68a",
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
        const step =
          (m.tier === "GUNNER_II" ? MECH_SPEED_GUNNER_II : MECH_SPEED) *
          (layer === "UNDERGROUND" ? TUNNEL_MOVE_MULTIPLIER : 1) *
          weatherSpeedMultiplier(state, m) *
          dt;
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
        let dmg = m.tier === "GUNNER_II" ? MECH_DAMAGE_GUNNER_II : MECH_DAMAGE;
        if (target.type === "GUN_POD" || target.type === "GUN_TURRET") {
          if (m.weaponMode === "ANTI_POD") dmg *= 1.5;
          if (m.weaponMode === "ANTI_MMR") dmg *= 0.5;
        } else if (target.type === "HQ" || target.type === "DUMMY_BASE") {
          if (m.weaponMode === "ANTI_MMR") dmg *= 1.1;
        }
        // Mechs fighting enemy mechs — Anti-MMR bonus
        target.hp -= dmg;
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

const islandSideAt = (wx: number, wy: number): Owner | null => {
  if (inIsland("PLAYER", wx, wy)) return "PLAYER";
  if (inIsland("ENEMY", wx, wy)) return "ENEMY";
  return null;
};

const spendSideResources = (
  state: RuntimeState,
  side: Owner,
  funds: number,
  energy: number
): boolean => {
  if (side === "PLAYER") {
    if (state.playerFunds < funds || state.playerEnergy < energy) return false;
    state.playerFunds -= funds;
    state.playerEnergy -= energy;
    return true;
  }
  if (state.enemyFunds < funds || state.enemyEnergy < energy) return false;
  state.enemyFunds -= funds;
  state.enemyEnergy -= energy;
  return true;
};

const countLiveVehicles = (state: RuntimeState, owner: Owner) =>
  state.vehicles.filter((v) => v.owner === owner && v.state !== "DEAD").length;

const countLiveAircraft = (state: RuntimeState, owner: Owner) =>
  state.aircraft.filter((a) => a.owner === owner && a.state !== "DEAD").length;

const spawnVehicleAtFactory = (state: RuntimeState, factory: Building) => {
  const wp = tileToWorld(factory.side, factory.pos.x, factory.pos.y);
  state.vehicles.push({
    id: uid("v"),
    owner: factory.side,
    side: factory.side,
    pos: { x: wp.x + 10, y: wp.y + 8 },
    hp: VEHICLE_HP,
    maxHp: VEHICLE_HP,
    state: "IDLE",
    facing: factory.side === "PLAYER" ? 0 : Math.PI,
    attackCooldown: 0.2,
  });
  sfx("land");
};

const spawnAircraftFromFactory = (state: RuntimeState, factory: Building) => {
  const home = tileToWorld(factory.side, factory.pos.x, factory.pos.y);
  const enemySide: Owner = factory.side === "PLAYER" ? "ENEMY" : "PLAYER";
  const targets = state.buildings.filter((b) => b.side === enemySide && b.hp > 0);
  const hq = targets.find((b) => b.type === "HQ") ?? targets[0];
  const aim = hq
    ? tileToWorld(hq.side, hq.pos.x, hq.pos.y)
    : {
        x: islandOriginX(enemySide) + ISLAND_PX_W / 2,
        y: ISLAND_PX_H / 2,
      };
  state.aircraft.push({
    id: uid("ac"),
    owner: factory.side,
    side: factory.side,
    pos: { x: home.x, y: home.y - 12 },
    hp: AIRCRAFT_HP,
    maxHp: AIRCRAFT_HP,
    state: "FLYING",
    facing: Math.atan2(aim.y - home.y, aim.x - home.x),
    attackCooldown: 0.4,
    targetBuildingId: hq?.id,
  });
  sfx("launch");
};

/** Factories field garrison APCs and (after attack grace for AI) launch gunships. */
const tickFactories = (state: RuntimeState, mission: MissionDef, dt: number) => {
  void dt;
  const enemyGrace = aiAttackGraceSeconds(mission.difficulty);
  for (const factory of state.buildings) {
    if (factory.type !== "FACTORY" || factory.hp <= 0) continue;
    if (!isBuildingActive(factory, state.elapsed) || factory.cooldown > 0) continue;

    const owner = factory.side;
    const doctrine = owner === "PLAYER" ? state.playerFactoryDoctrine : "AUTO";
    if (doctrine === "HOLD") {
      factory.cooldown = 4;
      continue;
    }

    const vehicles = countLiveVehicles(state, owner);
    const aircraft = countLiveAircraft(state, owner);
    const invaders = state.mechs.filter((m) => m.side === owner && m.owner !== owner && m.hp > 0).length;
    // Enemy gunships wait for attack grace + ASSAULT so idle openings stay teachable.
    const canAssault =
      owner === "PLAYER" ||
      (state.elapsed >= enemyGrace && state.aiState.phase === "ASSAULT");

    let wantVehicle = false;
    let wantAircraft = false;

    if (doctrine === "APC") {
      wantVehicle = vehicles < MAX_VEHICLES_PER_SIDE;
    } else if (doctrine === "GUNSHIP") {
      // Prefer gunships; still field APCs when invaders land on the home island.
      wantVehicle = invaders > 0 && vehicles < MAX_VEHICLES_PER_SIDE;
      wantAircraft =
        canAssault &&
        aircraft < MAX_AIRCRAFT_PER_SIDE &&
        (!wantVehicle || (invaders === 0 && vehicles >= 1));
    } else {
      // AUTO: prefer defenders when invaders are present or garrison is empty.
      wantVehicle =
        vehicles < MAX_VEHICLES_PER_SIDE &&
        (invaders > 0 || vehicles < 1 || (aircraft >= MAX_AIRCRAFT_PER_SIDE && vehicles < MAX_VEHICLES_PER_SIDE));
      wantAircraft =
        canAssault &&
        aircraft < MAX_AIRCRAFT_PER_SIDE &&
        (!wantVehicle || (invaders === 0 && vehicles >= 1));
    }

    if (wantVehicle && spendSideResources(state, owner, FACTORY_VEHICLE_COST.funds, FACTORY_VEHICLE_COST.energy)) {
      spawnVehicleAtFactory(state, factory);
      factory.cooldown = FACTORY_VEHICLE_INTERVAL;
      continue;
    }
    if (wantAircraft && spendSideResources(state, owner, FACTORY_AIRCRAFT_COST.funds, FACTORY_AIRCRAFT_COST.energy)) {
      spawnAircraftFromFactory(state, factory);
      factory.cooldown = FACTORY_AIRCRAFT_INTERVAL;
      continue;
    }
    // Retry soon if broke or capped
    factory.cooldown = 4;
  }
};

const tickVehicles = (state: RuntimeState, dt: number) => {
  for (let i = state.vehicles.length - 1; i >= 0; i--) {
    const v = state.vehicles[i];
    if (v.hp <= 0) {
      spawnExplosion(state, v.side, v.pos.x, v.pos.y, false);
      state.vehicles.splice(i, 1);
      continue;
    }

    // Gun turrets / pods are island defenses — they already shred mechs in tickMechs.
    // Mechs claw back at garrison APCs in contact range (continuous DPS).
    for (const m of state.mechs) {
      if (m.side !== v.side || m.owner === v.owner || m.hp <= 0) continue;
      if ((m.layer ?? "SURFACE") === "UNDERGROUND") continue;
      const md = distance(m.pos.x, m.pos.y, v.pos.x, v.pos.y);
      if (md <= VEHICLE_ATTACK_RANGE * 1.05) {
        const dps = (m.tier === "GUNNER_II" ? MECH_DAMAGE_GUNNER_II : MECH_DAMAGE) * 0.55;
        v.hp -= dps * dt;
      }
    }

    // Hunt enemy mechs on this island
    let target: Mech | undefined;
    if (v.targetMechId) {
      target = state.mechs.find((m) => m.id === v.targetMechId && m.hp > 0);
    }
    if (!target) {
      let best = Infinity;
      for (const m of state.mechs) {
        if (m.side !== v.side || m.owner === v.owner || m.hp <= 0) continue;
        if ((m.layer ?? "SURFACE") === "UNDERGROUND" && (m.detectedUntil ?? 0) <= state.elapsed) continue;
        const d = distance(m.pos.x, m.pos.y, v.pos.x, v.pos.y);
        if (d < best) {
          best = d;
          target = m;
        }
      }
      v.targetMechId = target?.id;
    }

    if (!target) {
      v.state = "IDLE";
      continue;
    }

    const dx = target.pos.x - v.pos.x;
    const dy = target.pos.y - v.pos.y;
    const d = Math.hypot(dx, dy);
    v.facing = Math.atan2(dy, dx);
    if (d > VEHICLE_ATTACK_RANGE) {
      v.state = "MOVING";
      const step = VEHICLE_SPEED * dt;
      v.pos.x += (dx / d) * step;
      v.pos.y += (dy / d) * step;
    } else {
      v.state = "IDLE";
      v.attackCooldown -= dt;
      if (v.attackCooldown <= 0) {
        v.attackCooldown = VEHICLE_ATTACK_COOLDOWN;
        target.hp -= VEHICLE_DAMAGE;
        state.particles.push({
          id: uid("pa"),
          side: v.side,
          pos: { x: v.pos.x, y: v.pos.y },
          vx: (target.pos.x - v.pos.x) * 5,
          vy: (target.pos.y - v.pos.y) * 5,
          life: 0,
          maxLife: 0.14,
          color: "#fca5a5",
          size: 1.8,
          fx: "muzzle",
        });
      }
    }
  }
};

const tickAircraft = (state: RuntimeState, dt: number) => {
  for (let i = state.aircraft.length - 1; i >= 0; i--) {
    const a = state.aircraft[i];
    if (a.hp <= 0) {
      spawnExplosion(state, islandSideAt(a.pos.x, a.pos.y) ?? a.side, a.pos.x, a.pos.y, false);
      state.aircraft.splice(i, 1);
      continue;
    }

    a.state = "FLYING";
    const over = islandSideAt(a.pos.x, a.pos.y);
    if (over) a.side = over;

    // AA batteries on the island under the gunship engage hostile craft
    if (over && over !== a.owner) {
      for (const b of state.buildings) {
        if (b.side !== over || b.type !== "AA_GUN" || b.hp <= 0) continue;
        if (!isBuildingActive(b, state.elapsed) || b.cooldown > 0) continue;
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        const r = BUILDINGS.AA_GUN.range ?? 220;
        if (distance(bw.x, bw.y, a.pos.x, a.pos.y) <= r) {
          b.cooldown = 1 / (BUILDINGS.AA_GUN.fireRate ?? 1.2);
          a.hp -= AIRCRAFT_AA_DAMAGE;
          state.particles.push({
            id: uid("pa"),
            side: b.side,
            pos: { x: bw.x, y: bw.y },
            vx: (a.pos.x - bw.x) * 8,
            vy: (a.pos.y - bw.y) * 8,
            life: 0,
            maxLife: 0.1,
            color: "#7dd3fc",
            size: 1.2,
          });
          break;
        }
      }
    }

    const enemySide: Owner = a.owner === "PLAYER" ? "ENEMY" : "PLAYER";
    let target = a.targetBuildingId
      ? state.buildings.find((b) => b.id === a.targetBuildingId && b.hp > 0)
      : undefined;
    if (!target) {
      let best = Infinity;
      for (const b of state.buildings) {
        if (b.side !== enemySide || b.hp <= 0 || b.type === "LAND_MINE") continue;
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        const d = distance(bw.x, bw.y, a.pos.x, a.pos.y);
        const weighted = d + (b.type === "HQ" ? -40 : b.type === "AA_GUN" ? -20 : 0);
        if (weighted < best) {
          best = weighted;
          target = b;
        }
      }
      a.targetBuildingId = target?.id;
    }

    if (!target) continue;
    const tw = tileToWorld(target.side, target.pos.x, target.pos.y);
    const dx = tw.x - a.pos.x;
    const dy = tw.y - a.pos.y;
    const d = Math.hypot(dx, dy);
    a.facing = Math.atan2(dy, dx);
    if (d > AIRCRAFT_ATTACK_RANGE) {
      const step = AIRCRAFT_SPEED * dt;
      a.pos.x += (dx / d) * step;
      a.pos.y += (dy / d) * step;
    } else {
      // Strafe circle — drift sideways while firing
      const step = AIRCRAFT_SPEED * 0.55 * dt;
      a.pos.x += (-dy / Math.max(d, 1)) * step;
      a.pos.y += (dx / Math.max(d, 1)) * step;
      a.attackCooldown -= dt;
      if (a.attackCooldown <= 0) {
        a.attackCooldown = AIRCRAFT_ATTACK_COOLDOWN;
        target.hp -= AIRCRAFT_DAMAGE;
        state.particles.push({
          id: uid("pa"),
          side: target.side,
          pos: { x: a.pos.x, y: a.pos.y },
          vx: (tw.x - a.pos.x) * 6,
          vy: (tw.y - a.pos.y) * 6,
          life: 0,
          maxLife: 0.16,
          color: "#fbbf24",
          size: 2,
          fx: "muzzle",
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
  const playerBases = state.buildings.filter((b) => b.side === "PLAYER" && b.type === "HQ" && b.hp > 0);
  const enemyBases = state.buildings.filter((b) => b.side === "ENEMY" && b.type === "HQ" && b.hp > 0);
  if (playerBases.length === 0) {
    state.status = "DEFEAT";
    sfx("defeat");
  } else if (enemyBases.length === 0) {
    state.status = "VICTORY";
    sfx("victory");
  }
};

// ----------------- Enemy AI -----------------
type AiAction =
  | { kind: "build"; building: BuildingType; score: number; reason: string }
  | { kind: "attack"; projectile: ProjectileType; target: Building; score: number; reason: string };

/** Seconds before AI may fire weapons — gives players time to place first eco/AA. */
export const aiAttackGraceSeconds = (difficulty: number): number => {
  if (difficulty <= 1) return 90;
  if (difficulty <= 2) return 75;
  if (difficulty <= 3) return 55;
  if (difficulty <= 4) return 45;
  return 35;
};

/** ECO phase end (seconds) — AI builds economy/defense before army tempo. */
export const aiEcoPhaseEndsAt = (difficulty: number): number => {
  if (difficulty <= 1) return 75;
  if (difficulty <= 2) return 65;
  if (difficulty <= 3) return 50;
  return 40;
};

/** ARMY → ASSAULT transition (seconds). */
export const aiArmyPhaseEndsAt = (difficulty: number): number => {
  if (difficulty <= 2) return 125;
  if (difficulty <= 4) return 105;
  return 90;
};

const countBuildingsByType = (buildings: Building[], side: Owner): Record<BuildingType, number> => {
  const counts = {} as Record<BuildingType, number>;
  for (const key of Object.keys(BUILDINGS) as BuildingType[]) counts[key] = 0;
  for (const b of buildings) {
    if (b.side === side && b.hp > 0) counts[b.type]++;
  }
  return counts;
};

/** Dummy Cover adjacent to a base conceals it from enemy radar memory. */
const isConcealedByDummyCover = (state: RuntimeState, building: Building): boolean => {
  if (building.type !== "HQ" && building.type !== "DUMMY_BASE") return false;
  return state.buildings.some(
    (c) =>
      c.side === building.side &&
      c.type === "DUMMY_COVER" &&
      c.hp > 0 &&
      Math.abs(c.pos.x - building.pos.x) <= 1 &&
      Math.abs(c.pos.y - building.pos.y) <= 1
  );
};

const updateAiMemory = (state: RuntimeState) => {
  const memory = state.aiState.memory;
  const radarOnline = state.buildings.some(
    (b) => b.side === "ENEMY" && b.type === "RADAR" && isBuildingActive(b, state.elapsed)
  );
  for (const b of state.buildings) {
    if (b.side !== "PLAYER" || b.hp <= 0) continue;
    if (isConcealedByDummyCover(state, b)) {
      delete memory.seenPlayerBuildings[b.id];
      continue;
    }
    // Dummy bases are always attractive once seen
    if (radarOnline || b.type === "HQ" || b.type === "DUMMY_BASE" || b.buildTimeRemaining <= 0) {
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
  const phase = state.aiState.phase;
  const agg = mission.enemyAggression;
  const eco = mission.enemyEcoBias;
  const actions: AiAction[] = [];
  const playerTargets = state.buildings.filter((b) => b.side === "PLAYER" && b.hp > 0);
  const hq = playerTargets.find((b) => b.type === "HQ") ?? playerTargets[0];
  const playerAa = playerTargets.filter((b) => b.type === "AA_GUN").length;
  const playerPower = playerTargets.find((b) => b.type === "ENERGY_PLANT") ?? hq;
  const playerRadar = playerTargets.find((b) => b.type === "RADAR") ?? hq;
  const canAttack = state.elapsed >= aiAttackGraceSeconds(mission.difficulty);
  const ecoFocus = phase === "ECO" ? 1 : 0;

  const addBuild = (building: BuildingType, score: number, reason: string) => {
    const cost = getBuildingCost(state.buildings, "ENEMY", building);
    if (state.enemyFunds >= cost.funds && state.enemyEnergy >= cost.energy) {
      actions.push({ kind: "build", building, score, reason });
    }
  };
  const addAttack = (projectile: ProjectileType, target: Building | undefined, score: number, reason: string) => {
    if (!canAttack || !target) return;
    const cost = WEAPON_COSTS[projectile];
    if (state.enemyFunds >= cost.funds && state.enemyEnergy >= cost.energy) {
      actions.push({ kind: "attack", projectile, target, score, reason });
    }
  };

  addBuild("ENERGY_PLANT", 80 * eco - counts.ENERGY_PLANT * 18 + Math.max(0, 180 - state.enemyEnergy) * 0.12 + ecoFocus * 12, "power-growth");
  addBuild("SUPPLY_DEPOT", 72 * eco - counts.SUPPLY_DEPOT * 16 + Math.max(0, 350 - state.enemyFunds) * 0.08 + ecoFocus * 10, "funds-growth");
  addBuild("FACTORY", counts.FACTORY ? 12 : 40 + eco * 20, "build-tempo");
  addBuild("AA_GUN", 48 + state.stats.missilesFired * 2 - counts.AA_GUN * 18, "anti-missile-screen");
  addBuild("MISSILE_LAUNCHER", counts.MISSILE_LAUNCHER ? 15 : 75 + agg * 20 - ecoFocus * 25, "unlock-strikes");
  addBuild("ICBM_SILO", counts.ICBM_SILO ? 8 : 30 + agg * 35 - ecoFocus * 20, "strategic-icbm");
  // Mech bay during ECO is deferred so opening is eco/defense, not an instant pod rush.
  addBuild(
    "METAL_MARINE_BASE",
    counts.METAL_MARINE_BASE ? 8 : 52 + agg * 45 - playerAa * 4 - ecoFocus * 40,
    "ground-assault"
  );
  addBuild("GUN_TURRET", 32 + state.mechs.filter((m) => m.side === "ENEMY").length * 25 - counts.GUN_TURRET * 14, "base-defense");
  addBuild("GUN_POD", 38 + state.mechs.filter((m) => m.side === "ENEMY").length * 20 - counts.GUN_POD * 12, "gun-pod-bunker");
  addBuild("RADAR", counts.RADAR ? 8 : 45 + Object.keys(memory.seenPlayerBuildings).length * 2, "target-intel");
  addBuild("RADAR_JAMMER", counts.RADAR_JAMMER ? 12 : 42 + playerAa * 9 + agg * 20, "jam-defense");
  addBuild("EMP_CANNON", counts.EMP_CANNON ? 10 : 48 + playerAa * 6 + (playerPower ? 12 : 0), "disable-grid");
  addBuild("TUNNEL_ENTRANCE", counts.TUNNEL_ENTRANCE ? 14 : 44 + agg * 25 - counts.SEISMIC_SENSOR * 4, "subsurface-maneuver");
  addBuild("SEISMIC_SENSOR", counts.SEISMIC_SENSOR ? 10 : 36 + state.stats.marinesDeployed * 3, "tunnel-watch");
  addBuild("TERRAIN_DESTABILIZER", counts.TERRAIN_DESTABILIZER ? 12 : 36 + agg * 18 + Object.keys(memory.seenPlayerBuildings).length * 2, "terrain-denial");
  addBuild("WEATHER_CONTROL", counts.WEATHER_CONTROL ? 9 : 34 + agg * 16 + playerAa * 4, "weather-control");
  addBuild("BIOSPHERE_ENGINE", counts.BIOSPHERE_ENGINE ? 10 : 28 + eco * 18, "eco-resilience");

  const decoy = playerTargets.find((b) => b.type === "DUMMY_BASE");
  const strikeTarget = decoy ?? hq;

  if (counts.MISSILE_LAUNCHER > 0) {
    addAttack("DUMMY", strikeTarget, state.elapsed - memory.lastProbeAt > 20 ? 50 + playerAa * 12 : 12, "aa-probe");
    const weakTarget = playerTargets
      .filter((b) => b.type !== "HQ")
      .sort((a, b) => a.hp - b.hp || a.pos.y - b.pos.y)[0];
    addAttack("DUMMY", weakTarget, 28 + agg * 10, "harass-weak");
  }
  if (counts.ICBM_SILO > 0) {
    addAttack("ICBM", strikeTarget, 44 + agg * 45 - memory.aaProbeScore * 12 - playerAa * 3, "hq-strike");
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

  // Phase clocks scale with difficulty — early ops stay in ECO longer.
  const ecoEnds = aiEcoPhaseEndsAt(mission.difficulty);
  const armyEnds = aiArmyPhaseEndsAt(mission.difficulty);
  if (state.elapsed > ecoEnds && ai.phase === "ECO") ai.phase = "ARMY";
  if (state.elapsed > armyEnds && ai.phase === "ARMY") ai.phase = "ASSAULT";

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

  // Schedule next action — slower cadence so players can establish bases
  const base = ai.phase === "ECO" ? 8.5 : ai.phase === "ARMY" ? 5.5 : 3.4;
  ai.nextActionAt = base * rngRange(state, 0.75, 1.25) * (1.35 - agg * 0.35);

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
  tickFactories(state, mission, dt);
  tickVehicles(state, dt);
  tickAircraft(state, dt);
  tickParticles(state, dt);
  tickShake(state, dt);
  tickAlerts(state, dt);
  detectIncoming(state, dt);
  aiTick(state, mission, dt);
  checkWinLoss(state);
};
