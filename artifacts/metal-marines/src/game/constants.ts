import type { BuildingSpec, BuildingType, ProjectileType } from "./types";

export const GRID_W = 12;
export const GRID_H = 10;
export const TILE_PX = 44;
export const ISLAND_PX_W = GRID_W * TILE_PX;
export const ISLAND_PX_H = GRID_H * TILE_PX;
export const SKY_GAP_PX = 180;
export const WORLD_W = ISLAND_PX_W * 2 + SKY_GAP_PX;
export const WORLD_H = ISLAND_PX_H + 60;

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  HQ: {
    type: "HQ",
    name: "Headquarters",
    hotkey: "",
    costFunds: 0,
    costEnergy: 0,
    buildTime: 0,
    maxHp: 1200,
    description: "Command center. If destroyed, the war is lost.",
    fundsPerSec: 2,
  },
  ENERGY_PLANT: {
    type: "ENERGY_PLANT",
    name: "Energy Plant",
    hotkey: "1",
    costFunds: 80,
    costEnergy: 0,
    buildTime: 4,
    maxHp: 220,
    description: "Generates Energy required to launch missiles.",
    energyPerSec: 6,
  },
  SUPPLY_DEPOT: {
    type: "SUPPLY_DEPOT",
    name: "Supply Depot",
    hotkey: "2",
    costFunds: 120,
    costEnergy: 10,
    buildTime: 5,
    maxHp: 240,
    description: "Generates War Funds for further construction.",
    fundsPerSec: 6,
  },
  RADAR: {
    type: "RADAR",
    name: "Radar Array",
    hotkey: "3",
    costFunds: 180,
    costEnergy: 30,
    buildTime: 5,
    maxHp: 160,
    description: "Reveals enemy island and tracks incoming threats.",
  },
  MISSILE_LAUNCHER: {
    type: "MISSILE_LAUNCHER",
    name: "Missile Silo",
    hotkey: "4",
    costFunds: 260,
    costEnergy: 60,
    buildTime: 7,
    maxHp: 300,
    description: "Required to launch ICBMs, Dummies and AA missiles.",
  },
  METAL_MARINE_BASE: {
    type: "METAL_MARINE_BASE",
    name: "Mech Bay",
    hotkey: "5",
    costFunds: 360,
    costEnergy: 100,
    buildTime: 8,
    maxHp: 400,
    description: "Builds and deploys Metal Marines via transport pod.",
  },
  AA_GUN: {
    type: "AA_GUN",
    name: "AA Battery",
    hotkey: "6",
    costFunds: 180,
    costEnergy: 40,
    buildTime: 4,
    maxHp: 220,
    description: "Auto-fires interceptors at incoming missiles & pods.",
    range: 220,
    fireRate: 1.2,
  },
  GUN_TURRET: {
    type: "GUN_TURRET",
    name: "Gun Turret",
    hotkey: "7",
    costFunds: 130,
    costEnergy: 25,
    buildTime: 3,
    maxHp: 260,
    description: "Anti-mech ground turret. Shreds landed Marines.",
    range: 110,
    fireRate: 0.6,
    damage: 14,
  },
  LAND_MINE: {
    type: "LAND_MINE",
    name: "Land Mine",
    hotkey: "8",
    costFunds: 40,
    costEnergy: 5,
    buildTime: 1,
    maxHp: 1,
    description: "Hidden trap. Detonates beneath enemy Marines.",
    damage: 60,
  },
};

export const WEAPON_COSTS: Record<ProjectileType, { funds: number; energy: number }> = {
  ICBM: { funds: 80, energy: 40 },
  DUMMY: { funds: 20, energy: 10 },
  AA: { funds: 30, energy: 20 },
  TRANSPORT_POD: { funds: 220, energy: 80 },
};

export const WEAPON_LABELS: Record<ProjectileType, { name: string; hotkey: string; desc: string }> = {
  ICBM: { name: "ICBM", hotkey: "Q", desc: "Heavy missile. Splash damage." },
  DUMMY: { name: "Dummy", hotkey: "W", desc: "Decoy. Bait enemy AA, scout fog." },
  AA: { name: "AA Missile", hotkey: "E", desc: "Manual intercept of an enemy missile." },
  TRANSPORT_POD: { name: "Marine Drop", hotkey: "R", desc: "Launch a Metal Marine pod." },
};

export const ICBM_DAMAGE = 280;
export const ICBM_SPLASH = 60;
export const MECH_HP = 220;
export const MECH_DAMAGE = 28;
export const MECH_SPEED = 28;
export const MECH_ATTACK_COOLDOWN = 0.7;
