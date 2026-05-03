export type TerrainType = "GRASS" | "FOREST" | "MOUNTAIN" | "WATER";
export type Owner = "PLAYER" | "ENEMY";
export type BuildingType =
  | "HQ"
  | "ENERGY_PLANT"
  | "SUPPLY_DEPOT"
  | "RADAR"
  | "MISSILE_LAUNCHER"
  | "METAL_MARINE_BASE"
  | "AA_GUN"
  | "GUN_TURRET"
  | "LAND_MINE";
export type ProjectileType = "ICBM" | "DUMMY" | "AA" | "TRANSPORT_POD";

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
}

export interface Building {
  id: string;
  type: BuildingType;
  owner: Owner;
  pos: Position;
  hp: number;
  maxHp: number;
  buildTimeRemaining: number;
  buildTimeTotal: number;
  cooldown: number;
}

export interface Projectile {
  id: string;
  type: ProjectileType;
  owner: Owner;
  side: Owner;
  startWX: number;
  startWY: number;
  targetWX: number;
  targetWY: number;
  progress: number;
  speed: number;
  payloadMechId?: string;
  intercepted?: boolean;
}

export interface Mech {
  id: string;
  owner: Owner;
  side: Owner;
  pos: Position;
  targetBuildingId?: string;
  hp: number;
  maxHp: number;
  state: "LANDING" | "WALKING" | "ATTACKING";
  attackCooldown: number;
}

export interface Particle {
  id: string;
  side: Owner;
  pos: Position;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface AlertItem {
  id: string;
  text: string;
  level: "info" | "warn" | "crit";
  ts: number;
}

export interface CommanderProfile {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
}

export interface MissionDef {
  id: string;
  index: number;
  title: string;
  commanderId: string;
  objective: string;
  briefing: string;
  difficulty: number;
  playerIsland: Tile[];
  enemyIsland: Tile[];
  enemyStartHQ: Position;
  playerStartHQ: Position;
  enemyAggression: number;
  enemyEcoBias: number;
  startFunds: number;
  startEnergy: number;
}

export interface BuildingSpec {
  type: BuildingType;
  name: string;
  hotkey: string;
  costFunds: number;
  costEnergy: number;
  buildTime: number;
  maxHp: number;
  description: string;
  fundsPerSec?: number;
  energyPerSec?: number;
  range?: number;
  damage?: number;
  fireRate?: number;
}

export interface MissionProgress {
  cleared: string[];
  bestTimes: Record<string, number>;
}

export type GameStatus =
  | "PLAYING"
  | "PAUSED"
  | "VICTORY"
  | "DEFEAT";

export interface RuntimeState {
  status: GameStatus;
  missionId: string | null;
  startedAt: number;
  elapsed: number;
  playerFunds: number;
  playerEnergy: number;
  enemyFunds: number;
  enemyEnergy: number;
  playerFundsRate: number;
  playerEnergyRate: number;
  buildings: Building[];
  projectiles: Projectile[];
  mechs: Mech[];
  particles: Particle[];
  fogPlayer: boolean[];
  fogEnemy: boolean[];
  alerts: AlertItem[];
  selectedBuild: BuildingType | null;
  selectedWeapon: ProjectileType | null;
  aiState: {
    phase: "ECO" | "ARMY" | "ASSAULT";
    nextActionAt: number;
    builtCount: number;
  };
  stats: {
    missilesFired: number;
    marinesDeployed: number;
    buildingsLost: number;
    buildingsDestroyed: number;
  };
  shake: number;
}
