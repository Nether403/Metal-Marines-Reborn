import {
  BUILDINGS,
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
  SKY_GAP_PX,
  TILE_PX,
  WEAPON_COSTS,
} from "./constants";
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
  Tile,
} from "./types";
import { sfx } from "@/lib/sfx";

let _id = 0;
export const uid = (p = "x") => `${p}_${++_id}_${Math.floor(Math.random() * 1e6)}`;

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
  const fundsRef = side === "PLAYER" ? "playerFunds" : "enemyFunds";
  const energyRef = side === "PLAYER" ? "playerEnergy" : "enemyEnergy";
  if (state[fundsRef] < spec.costFunds) return false;
  if (state[energyRef] < spec.costEnergy) return false;
  const tiles = side === "PLAYER" ? state.playerIsland : state.enemyIsland;
  if (!isBuildable(tiles, state.buildings, side, type, x, y)) return false;
  state[fundsRef] -= spec.costFunds;
  state[energyRef] -= spec.costEnergy;
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
  if (side === "PLAYER") sfx("place_building");
  return true;
};

declare module "./types" {
  interface RuntimeState {
    playerIsland: Tile[];
    enemyIsland: Tile[];
  }
}

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

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
  const requiresLauncher = type === "ICBM" || type === "DUMMY" || type === "AA";
  const requiresMechBay = type === "TRANSPORT_POD";
  const has = state.buildings.some(
    (b) =>
      b.side === side &&
      b.hp > 0 &&
      b.buildTimeRemaining <= 0 &&
      ((requiresLauncher && b.type === "MISSILE_LAUNCHER") ||
        (requiresMechBay && b.type === "METAL_MARINE_BASE"))
  );
  if (!has) return false;

  state[fundsRef] -= cost.funds;
  state[energyRef] -= cost.energy;

  // Find the launcher to use as start position (or mech bay)
  const launcher = state.buildings.find(
    (b) =>
      b.side === side &&
      b.hp > 0 &&
      b.buildTimeRemaining <= 0 &&
      ((requiresLauncher && b.type === "MISSILE_LAUNCHER") ||
        (requiresMechBay && b.type === "METAL_MARINE_BASE"))
  )!;
  const start = tileToWorld(side, launcher.pos.x, launcher.pos.y);
  const target = side === "PLAYER" ? "ENEMY" : "PLAYER";

  const speed = type === "TRANSPORT_POD" ? 90 : type === "AA" ? 280 : 130;
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
      b.hp > 0 &&
      b.buildTimeRemaining <= 0 &&
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
    speed: 320,
  };
  state.projectiles.push(proj);
  return true;
};

export const projectileCurrentPos = (p: Projectile): Position => {
  // Quadratic arc through midpoint with elevated peak.
  const t = p.progress;
  const x = p.startWX + (p.targetWX - p.startWX) * t;
  const baseY = p.startWY + (p.targetWY - p.startWY) * t;
  const arc = -Math.sin(t * Math.PI) * 220;
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
    const a = Math.random() * Math.PI * 2;
    const sp = (big ? 100 : 60) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      id: uid("pa"),
      side,
      pos: { x: wx, y: wy },
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.6,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: big ? 2 + Math.random() * 4 : 1.5 + Math.random() * 2.5,
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
    (b) => b.side === "PLAYER" && b.type === "RADAR" && b.hp > 0 && b.buildTimeRemaining <= 0
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
    if (b.side !== "PLAYER" || b.hp <= 0 || b.buildTimeRemaining > 0) continue;
    const spec = BUILDINGS[b.type];
    f += spec.fundsPerSec ?? 0;
    e += spec.energyPerSec ?? 0;
  }
  state.playerFundsRate = f;
  state.playerEnergyRate = e;
};

const computeEnemyRates = (state: RuntimeState) => {
  let f = 0;
  let e = 0;
  for (const b of state.buildings) {
    if (b.side !== "ENEMY" || b.hp <= 0 || b.buildTimeRemaining > 0) continue;
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
    if (b.side !== "ENEMY" || b.hp <= 0 || b.buildTimeRemaining > 0) continue;
    const spec = BUILDINGS[b.type];
    ef += spec.fundsPerSec ?? 0;
    ee += spec.energyPerSec ?? 0;
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
        if (b.hp <= 0 || b.buildTimeRemaining > 0 || b.cooldown > 0) continue;
        const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
        const r = BUILDINGS.AA_GUN.range ?? 220;
        if (distance(bw.x, bw.y, cur.x, cur.y) <= r) {
          // Fire interceptor
          b.cooldown = 1 / (BUILDINGS.AA_GUN.fireRate ?? 1.2);
          // 70% intercept chance for ICBMs/PODS, 100% for dummies
          const prob = p.type === "DUMMY" ? 1 : 0.7;
          if (Math.random() < prob) {
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
    if (m.hp <= 0) {
      spawnExplosion(state, m.side, m.pos.x, m.pos.y, true);
      state.mechs.splice(i, 1);
      continue;
    }

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
      if (b.side === m.side && b.type === "LAND_MINE" && b.hp > 0) {
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
      if (b.buildTimeRemaining > 0 || b.cooldown > 0) continue;
      const bw = tileToWorld(b.side, b.pos.x, b.pos.y);
      const r = BUILDINGS.GUN_TURRET.range ?? 110;
      if (distance(bw.x, bw.y, m.pos.x, m.pos.y) <= r) {
        b.cooldown = 1 / (BUILDINGS.GUN_TURRET.fireRate ?? 0.6);
        m.hp -= BUILDINGS.GUN_TURRET.damage ?? 14;
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
    if (d > 22) {
      m.state = "WALKING";
      m.pos.x += (dx / d) * MECH_SPEED * dt;
      m.pos.y += (dy / d) * MECH_SPEED * dt;
    } else {
      m.state = "ATTACKING";
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
const aiTick = (state: RuntimeState, mission: MissionDef, dt: number) => {
  const ai = state.aiState;
  ai.nextActionAt -= dt;
  if (ai.nextActionAt > 0) return;

  // Update phase based on count and time
  if (state.elapsed > 25 && ai.phase === "ECO") ai.phase = "ARMY";
  if (state.elapsed > 60 && ai.phase === "ARMY") ai.phase = "ASSAULT";

  // Decide action
  const eco = mission.enemyEcoBias;
  const agg = mission.enemyAggression;

  const enemyBuildings = state.buildings.filter((b) => b.side === "ENEMY" && b.hp > 0);
  const counts: Record<BuildingType, number> = {
    HQ: 0,
    ENERGY_PLANT: 0,
    SUPPLY_DEPOT: 0,
    RADAR: 0,
    MISSILE_LAUNCHER: 0,
    METAL_MARINE_BASE: 0,
    AA_GUN: 0,
    GUN_TURRET: 0,
    LAND_MINE: 0,
  };
  for (const b of enemyBuildings) counts[b.type]++;

  const wantBuild = (): BuildingType | null => {
    if (counts.ENERGY_PLANT < 1 + Math.floor(eco * 2)) return "ENERGY_PLANT";
    if (counts.SUPPLY_DEPOT < 1 + Math.floor(eco * 3)) return "SUPPLY_DEPOT";
    if (counts.AA_GUN < 1 + Math.floor((1 - agg) * 2 + 1)) return "AA_GUN";
    if (counts.MISSILE_LAUNCHER < 1) return "MISSILE_LAUNCHER";
    if (counts.METAL_MARINE_BASE < 1 && agg > 0.5) return "METAL_MARINE_BASE";
    if (counts.GUN_TURRET < 2) return "GUN_TURRET";
    if (Math.random() < 0.4) return "ENERGY_PLANT";
    if (Math.random() < 0.4) return "SUPPLY_DEPOT";
    return "AA_GUN";
  };

  const chooseAttack = (): { type: ProjectileType; tx: number; ty: number } | null => {
    // Pick a random known player building (or HQ) on enemy side awareness (no fog for AI)
    const targets = state.buildings.filter((b) => b.side === "PLAYER" && b.hp > 0);
    if (!targets.length) return null;
    // Slight weighting toward HQ
    const t =
      Math.random() < 0.3
        ? targets.find((b) => b.type === "HQ") ?? targets[0]
        : targets[Math.floor(Math.random() * targets.length)];
    const w = tileToWorld("PLAYER", t.pos.x, t.pos.y);
    // AI randomly chooses dummy vs ICBM vs pod based on phase + agg
    let r = Math.random();
    if (ai.phase === "ASSAULT" && counts.METAL_MARINE_BASE > 0 && r < 0.25 * agg) {
      return { type: "TRANSPORT_POD", tx: w.x, ty: w.y };
    }
    if (counts.MISSILE_LAUNCHER > 0) {
      if (r < 0.15 * (1 - agg)) return { type: "DUMMY", tx: w.x, ty: w.y };
      return { type: "ICBM", tx: w.x, ty: w.y };
    }
    return null;
  };

  // Mix building & attacking
  const doBuild = ai.phase === "ECO" || (Math.random() < 0.55 && ai.phase !== "ASSAULT");
  if (doBuild) {
    const want = wantBuild();
    if (want) {
      // Try a few random tiles
      for (let i = 0; i < 18; i++) {
        const x = 2 + Math.floor(Math.random() * (GRID_W - 4));
        const y = 2 + Math.floor(Math.random() * (GRID_H - 4));
        if (buildBuilding(state, "ENEMY", want, x, y)) {
          ai.builtCount++;
          break;
        }
      }
    }
  } else {
    const attack = chooseAttack();
    if (attack) launchMissile(state, "ENEMY", attack.type, attack.tx, attack.ty);
  }

  // Schedule next action
  const base = ai.phase === "ECO" ? 4.5 : ai.phase === "ARMY" ? 3.2 : 2.0;
  ai.nextActionAt = base * (0.7 + Math.random() * 0.6) * (1.2 - agg * 0.4);

  // AI defensively launches AA when something inbound
  for (const p of state.projectiles) {
    if (p.owner === "PLAYER" && p.side === "ENEMY" && !p.intercepted) {
      if (Math.random() < 0.25 * agg) {
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
  fullRevealRadar(state);
  tickProjectiles(state, dt);
  tickMechs(state, dt);
  tickParticles(state, dt);
  tickShake(state, dt);
  tickAlerts(state, dt);
  detectIncoming(state, dt);
  aiTick(state, mission, dt);
  checkWinLoss(state);
};
