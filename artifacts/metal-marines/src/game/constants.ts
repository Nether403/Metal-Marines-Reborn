import type { BuildingSpec, BuildingType, ProjectileType } from "./types";

export const GRID_W = 12;
export const GRID_H = 10;
export const TILE_PX = 64;
export const tileUnits = (tiles: number) => tiles * TILE_PX;
export const ISLAND_PX_W = GRID_W * TILE_PX;
export const ISLAND_PX_H = GRID_H * TILE_PX;
export const SKY_GAP_PX = tileUnits(3);
export const WORLD_W = ISLAND_PX_W * 2 + SKY_GAP_PX;
export const WORLD_H = ISLAND_PX_H + 60;

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  HQ: {
    type: "HQ",
    name: "Headquarters",
    hotkey: "B",
    costFunds: 450,
    costEnergy: 80,
    buildTime: 12,
    maxHp: 1200,
    description: "Command base. Field up to 3. Defeat only when your last base falls.",
    fundsPerSec: 2,
    maxPerSide: 3,
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
    range: tileUnits(6),
  },
  TUNNEL_ENTRANCE: {
    type: "TUNNEL_ENTRANCE",
    name: "Tunnel Gate",
    hotkey: "-",
    costFunds: 200,
    costEnergy: 55,
    buildTime: 6,
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
    range: tileUnits(3.5),
  },
  TERRAIN_DESTABILIZER: {
    type: "TERRAIN_DESTABILIZER",
    name: "Destabilizer",
    hotkey: "[",
    costFunds: 540,
    costEnergy: 180,
    buildTime: 11,
    maxHp: 190,
    description: "Mutates enemy terrain into short-lived toxic sludge chokepoints.",
    range: tileUnits(11.8),
  },
  WEATHER_CONTROL: {
    type: "WEATHER_CONTROL",
    name: "Weather Control",
    hotkey: "]",
    costFunds: 520,
    costEnergy: 190,
    buildTime: 10,
    maxHp: 210,
    description: "Triggers deterministic dust storms, floods, or tremors across the battlespace.",
    range: tileUnits(11.8),
  },
  BIOSPHERE_ENGINE: {
    type: "BIOSPHERE_ENGINE",
    name: "Biosphere Engine",
    hotkey: "\\",
    costFunds: 360,
    costEnergy: 130,
    buildTime: 8,
    maxHp: 220,
    description: "Regenerates damaged biomes and boosts nearby economy infrastructure.",
    range: tileUnits(2.2),
  },
  MISSILE_LAUNCHER: {
    type: "MISSILE_LAUNCHER",
    name: "Missile Silo",
    hotkey: "4",
    costFunds: 260,
    costEnergy: 60,
    buildTime: 7,
    maxHp: 300,
    description: "Required to launch Dummies and AA missiles.",
  },
  ICBM_SILO: {
    type: "ICBM_SILO",
    name: "ICBM Silo",
    hotkey: "I",
    costFunds: 900,
    costEnergy: 280,
    buildTime: 18,
    maxHp: 800,
    description: "3×3 strategic silo. All nine tiles must stay intact to authorize an ICBM launch.",
    footprintW: 3,
    footprintH: 3,
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
    range: tileUnits(11.8),
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
    range: tileUnits(5),
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
    range: tileUnits(2.5),
    fireRate: 0.6,
    damage: 14,
  },
  GUN_POD: {
    type: "GUN_POD",
    name: "Gun Pod",
    hotkey: "G",
    costFunds: 150,
    costEnergy: 20,
    buildTime: 4,
    maxHp: 220,
    description: "Classic Metal Marines bunker. Matches Marine toughness — counter with Anti-POD rifles.",
    range: tileUnits(2.2),
    fireRate: 0.65,
    damage: 16,
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
  FACTORY: {
    type: "FACTORY",
    name: "Factory",
    hotkey: "F",
    costFunds: 280,
    costEnergy: 70,
    buildTime: 8,
    maxHp: 320,
    description:
      "Speeds construction, fields garrison APCs, and launches gunship strafes. Set Factory doctrine in Strike Control.",
  },
  DUMMY_BASE: {
    type: "DUMMY_BASE",
    name: "Dummy Base",
    hotkey: "D",
    costFunds: 100,
    costEnergy: 15,
    buildTime: 3,
    maxHp: 280,
    description: "Decoy HQ silhouette. Draws enemy fire and AI targeting priority.",
  },
  DUMMY_COVER: {
    type: "DUMMY_COVER",
    name: "Dummy Cover",
    hotkey: "C",
    costFunds: 60,
    costEnergy: 10,
    buildTime: 2,
    maxHp: 40,
    description: "Concealment screen. Masks adjacent friendly bases from enemy radar until struck.",
  },
};

export const BUILDING_COST_SCALING: Partial<
  Record<BuildingType, { freeCount: number; rate: number; exponent: number; maxMultiplier: number }>
> = {
  ENERGY_PLANT: { freeCount: 1, rate: 0.3, exponent: 1.35, maxMultiplier: 3.5 },
  SUPPLY_DEPOT: { freeCount: 1, rate: 0.26, exponent: 1.3, maxMultiplier: 3.25 },
  AA_GUN: { freeCount: 1, rate: 0.2, exponent: 1.22, maxMultiplier: 2.6 },
  GUN_TURRET: { freeCount: 1, rate: 0.18, exponent: 1.18, maxMultiplier: 2.4 },
  GUN_POD: { freeCount: 1, rate: 0.2, exponent: 1.2, maxMultiplier: 2.5 },
  MISSILE_LAUNCHER: { freeCount: 1, rate: 0.24, exponent: 1.2, maxMultiplier: 2.8 },
  ICBM_SILO: { freeCount: 0, rate: 0.4, exponent: 1.3, maxMultiplier: 2.5 },
  METAL_MARINE_BASE: { freeCount: 1, rate: 0.28, exponent: 1.24, maxMultiplier: 3 },
  RADAR_JAMMER: { freeCount: 1, rate: 0.24, exponent: 1.2, maxMultiplier: 2.6 },
  EMP_CANNON: { freeCount: 1, rate: 0.26, exponent: 1.22, maxMultiplier: 2.8 },
  FACTORY: { freeCount: 1, rate: 0.3, exponent: 1.25, maxMultiplier: 2.8 },
  DUMMY_BASE: { freeCount: 1, rate: 0.22, exponent: 1.2, maxMultiplier: 2.4 },
  DUMMY_COVER: { freeCount: 2, rate: 0.15, exponent: 1.15, maxMultiplier: 2.2 },
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
  ICBM: { name: "ICBM", hotkey: "Q", desc: "Heavy missile. Requires intact 3×3 ICBM Silo. Splash damage." },
  DUMMY: { name: "Dummy", hotkey: "W", desc: "Decoy. Bait enemy AA, scout fog." },
  AA: { name: "AA Missile", hotkey: "E", desc: "Manual intercept of an enemy missile." },
  TRANSPORT_POD: { name: "Marine Drop", hotkey: "R", desc: "Launch a Metal Marine pod (max 3 assaulting)." },
  EMP: { name: "EMP", hotkey: "T", desc: "Disable buildings near the strike zone for a short window." },
  TUNNEL_BUSTER: { name: "Buster", hotkey: "Y", desc: "Collapse tunnel tiles and destroy exposed underground units." },
};

export const MAX_HQ_PER_SIDE = 3;
export const MAX_ASSAULT_MECHS = 3;
export const AA_BASE_HIT_CHANCE = 0.5;
export const AA_RADAR_HIT_BONUS = 0.05;
export const FACTORY_BUILD_SPEED_BONUS = 0.18;
export const FACTORY_VEHICLE_INTERVAL = 16;
export const FACTORY_AIRCRAFT_INTERVAL = 26;
export const FACTORY_VEHICLE_COST = { funds: 90, energy: 20 };
export const FACTORY_AIRCRAFT_COST = { funds: 140, energy: 55 };
export const MAX_VEHICLES_PER_SIDE = 3;
export const MAX_AIRCRAFT_PER_SIDE = 2;
export const VEHICLE_HP = 140;
export const VEHICLE_DAMAGE = 16;
export const VEHICLE_SPEED = tileUnits(0.85);
export const VEHICLE_ATTACK_RANGE = tileUnits(1.35);
export const VEHICLE_ATTACK_COOLDOWN = 0.55;
export const AIRCRAFT_HP = 95;
export const AIRCRAFT_DAMAGE = 12;
export const AIRCRAFT_SPEED = tileUnits(1.35);
export const AIRCRAFT_ATTACK_RANGE = tileUnits(1.8);
export const AIRCRAFT_ATTACK_COOLDOWN = 0.45;
export const AIRCRAFT_AA_DAMAGE = 22;
export const ICBM_DAMAGE = 280;
export const ICBM_SPLASH = tileUnits(1.35);
export const MECH_HP = 220;
export const MECH_HP_GUNNER_II = 300;
export const MECH_DAMAGE = 28;
export const MECH_DAMAGE_GUNNER_II = 34;
export const MECH_SPEED = tileUnits(0.65);
export const MECH_SPEED_GUNNER_II = tileUnits(0.72);
export const MECH_ATTACK_COOLDOWN = 0.7;
export const GUNNER_II_FUNDS_PREMIUM = 80;
export const GUNNER_II_ENERGY_PREMIUM = 30;
export const EMP_SPLASH = tileUnits(1.65);
export const EMP_DISABLE_SECONDS = 10;
export const JAMMER_FALSE_SIGNATURE_INTERVAL = 7;
export const TUNNEL_MOVE_MULTIPLIER = 0.82;
export const TUNNEL_TRANSITION_SECONDS = 1.4;
export const SEISMIC_SENSOR_RANGE = tileUnits(3.2);
export const SEISMIC_DETECTION_SECONDS = 3.5;
export const TUNNEL_COLLAPSE_RADIUS = tileUnits(1.3);
export const TUNNEL_COLLAPSE_SECONDS = 16;
export const TOXIC_SLUDGE_SECONDS = 16;
export const TERRAIN_DESTABILIZER_COOLDOWN = 32;
export const WEATHER_CONTROL_COOLDOWN = 54;
export const BIOSPHERE_ENGINE_COOLDOWN = 18;
export const BIOSPHERE_ECONOMY_BONUS = 0.06;
export const BIOSPHERE_REGEN_SECONDS = 32;
export const WEATHER_DURATION_SECONDS = 20;
export const DUST_STORM_DRIFT_TILES = 1;
export const DUST_STORM_MECH_SPEED_MULTIPLIER = 0.92;
export const TREMOR_DEFENSE_PENALTY = 0.12;
