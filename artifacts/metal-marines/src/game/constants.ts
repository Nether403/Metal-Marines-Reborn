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
  RADAR_JAMMER: {
    type: "RADAR_JAMMER",
    name: "Radar Jammer",
    hotkey: "9",
    costFunds: 220,
    costEnergy: 80,
    buildTime: 6,
    maxHp: 180,
    description: "Electronic warfare array. Creates uncertain radar signatures and degrades enemy intercept confidence.",
    range: 260,
  },
  TUNNEL_ENTRANCE: {
    type: "TUNNEL_ENTRANCE",
    name: "Tunnel Gate",
    hotkey: "-",
    costFunds: 240,
    costEnergy: 70,
    buildTime: 7,
    maxHp: 220,
    description: "Links mechs into the subterranean grid, bypassing normal radar and surface chokepoints.",
  },
  SEISMIC_SENSOR: {
    type: "SEISMIC_SENSOR",
    name: "Seismic Sensor",
    hotkey: "=",
    costFunds: 170,
    costEnergy: 55,
    buildTime: 5,
    maxHp: 150,
    description: "Detects underground movement and exposes tunnel incursions for counter-battery fire.",
    range: 150,
  },
  TERRAIN_DESTABILIZER: {
    type: "TERRAIN_DESTABILIZER",
    name: "Destabilizer",
    hotkey: "[",
    costFunds: 420,
    costEnergy: 130,
    buildTime: 8,
    maxHp: 190,
    description: "Mutates enemy terrain into short-lived toxic sludge chokepoints.",
    range: 520,
  },
  WEATHER_CONTROL: {
    type: "WEATHER_CONTROL",
    name: "Weather Control",
    hotkey: "]",
    costFunds: 460,
    costEnergy: 160,
    buildTime: 9,
    maxHp: 210,
    description: "Triggers deterministic dust storms, floods, or tremors across the battlespace.",
    range: 520,
  },
  BIOSPHERE_ENGINE: {
    type: "BIOSPHERE_ENGINE",
    name: "Biosphere Engine",
    hotkey: "\\",
    costFunds: 340,
    costEnergy: 120,
    buildTime: 8,
    maxHp: 220,
    description: "Regenerates damaged biomes and boosts nearby economy infrastructure.",
    range: 96,
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
  EMP_CANNON: {
    type: "EMP_CANNON",
    name: "EMP Cannon",
    hotkey: "0",
    costFunds: 300,
    costEnergy: 120,
    buildTime: 8,
    maxHp: 240,
    description: "Launches EMP strikes that temporarily disable enemy power, radar, and defense buildings.",
    range: 520,
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

export const BUILDING_COST_SCALING: Partial<
  Record<BuildingType, { freeCount: number; rate: number; exponent: number; maxMultiplier: number }>
> = {
  ENERGY_PLANT: { freeCount: 1, rate: 0.3, exponent: 1.35, maxMultiplier: 3.5 },
  SUPPLY_DEPOT: { freeCount: 1, rate: 0.26, exponent: 1.3, maxMultiplier: 3.25 },
  AA_GUN: { freeCount: 1, rate: 0.2, exponent: 1.22, maxMultiplier: 2.6 },
  GUN_TURRET: { freeCount: 1, rate: 0.18, exponent: 1.18, maxMultiplier: 2.4 },
  MISSILE_LAUNCHER: { freeCount: 1, rate: 0.24, exponent: 1.2, maxMultiplier: 2.8 },
  METAL_MARINE_BASE: { freeCount: 1, rate: 0.28, exponent: 1.24, maxMultiplier: 3 },
  RADAR_JAMMER: { freeCount: 1, rate: 0.24, exponent: 1.2, maxMultiplier: 2.6 },
  EMP_CANNON: { freeCount: 1, rate: 0.26, exponent: 1.22, maxMultiplier: 2.8 },
  TUNNEL_ENTRANCE: { freeCount: 1, rate: 0.32, exponent: 1.24, maxMultiplier: 3 },
  SEISMIC_SENSOR: { freeCount: 1, rate: 0.18, exponent: 1.18, maxMultiplier: 2.2 },
  TERRAIN_DESTABILIZER: { freeCount: 1, rate: 0.32, exponent: 1.25, maxMultiplier: 3 },
  WEATHER_CONTROL: { freeCount: 1, rate: 0.34, exponent: 1.28, maxMultiplier: 3.2 },
  BIOSPHERE_ENGINE: { freeCount: 1, rate: 0.24, exponent: 1.2, maxMultiplier: 2.6 },
};

export const WEAPON_COSTS: Record<ProjectileType, { funds: number; energy: number }> = {
  ICBM: { funds: 80, energy: 40 },
  DUMMY: { funds: 20, energy: 10 },
  AA: { funds: 30, energy: 20 },
  TRANSPORT_POD: { funds: 220, energy: 80 },
  EMP: { funds: 120, energy: 120 },
  TUNNEL_BUSTER: { funds: 140, energy: 90 },
};

export const WEAPON_LABELS: Record<ProjectileType, { name: string; hotkey: string; desc: string }> = {
  ICBM: { name: "ICBM", hotkey: "Q", desc: "Heavy missile. Splash damage." },
  DUMMY: { name: "Dummy", hotkey: "W", desc: "Decoy. Bait enemy AA, scout fog." },
  AA: { name: "AA Missile", hotkey: "E", desc: "Manual intercept of an enemy missile." },
  TRANSPORT_POD: { name: "Marine Drop", hotkey: "R", desc: "Launch a Metal Marine pod." },
  EMP: { name: "EMP", hotkey: "T", desc: "Disable buildings near the strike zone for a short window." },
  TUNNEL_BUSTER: { name: "Buster", hotkey: "Y", desc: "Collapse tunnel tiles and destroy exposed underground units." },
};

export const ICBM_DAMAGE = 280;
export const ICBM_SPLASH = 60;
export const MECH_HP = 220;
export const MECH_DAMAGE = 28;
export const MECH_SPEED = 28;
export const MECH_ATTACK_COOLDOWN = 0.7;
export const EMP_SPLASH = 72;
export const EMP_DISABLE_SECONDS = 10;
export const JAMMER_FALSE_SIGNATURE_INTERVAL = 7;
export const TUNNEL_MOVE_MULTIPLIER = 0.82;
export const TUNNEL_TRANSITION_SECONDS = 1.4;
export const SEISMIC_SENSOR_RANGE = 150;
export const SEISMIC_DETECTION_SECONDS = 4;
export const TUNNEL_COLLAPSE_RADIUS = 58;
export const TUNNEL_COLLAPSE_SECONDS = 18;
export const TOXIC_SLUDGE_SECONDS = 24;
export const TERRAIN_DESTABILIZER_COOLDOWN = 20;
export const WEATHER_CONTROL_COOLDOWN = 44;
export const BIOSPHERE_ENGINE_COOLDOWN = 18;
export const BIOSPHERE_ECONOMY_BONUS = 0.08;
export const BIOSPHERE_REGEN_SECONDS = 38;
export const WEATHER_DURATION_SECONDS = 24;
export const DUST_STORM_DRIFT_TILES = 1;
export const DUST_STORM_MECH_SPEED_MULTIPLIER = 0.9;
export const TREMOR_DEFENSE_PENALTY = 0.15;
