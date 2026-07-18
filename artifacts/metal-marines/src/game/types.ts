export type TerrainType = "GRASS" | "FOREST" | "MOUNTAIN" | "WATER" | "TOXIC_SLUDGE";
export type Owner = "PLAYER" | "ENEMY";
export type TileLayer = "SURFACE" | "UNDERGROUND";
export type WeatherType = "DUST_STORM" | "FLOOD" | "TREMOR";
export type BuildingType =
  | "HQ"
  | "ENERGY_PLANT"
  | "SUPPLY_DEPOT"
  | "RADAR"
  | "RADAR_JAMMER"
  | "TUNNEL_ENTRANCE"
  | "SEISMIC_SENSOR"
  | "TERRAIN_DESTABILIZER"
  | "WEATHER_CONTROL"
  | "BIOSPHERE_ENGINE"
  | "MISSILE_LAUNCHER"
  | "ICBM_SILO"
  | "EMP_CANNON"
  | "METAL_MARINE_BASE"
  | "AA_GUN"
  | "GUN_TURRET"
  | "GUN_POD"
  | "LAND_MINE"
  | "FACTORY"
  | "DUMMY_BASE"
  | "DUMMY_COVER";
export type ProjectileType = "ICBM" | "DUMMY" | "AA" | "TRANSPORT_POD" | "EMP" | "TUNNEL_BUSTER";
export type MechWeaponMode = "NORMAL" | "ANTI_MMR" | "ANTI_POD";
export type MechTier = "GUNNER_I" | "GUNNER_II";

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  elevation?: number;
  tunnel?: {
    open: boolean;
    collapsedUntil?: number;
  };
}

export interface Building {
  id: string;
  type: BuildingType;
  owner: Owner;
  side: Owner;
  pos: Position;
  /** Top-left of multi-tile footprint (same as pos for 1×1). */
  footprintW: number;
  footprintH: number;
  hp: number;
  maxHp: number;
  buildTimeRemaining: number;
  buildTimeTotal: number;
  cooldown: number;
  disabledUntil?: number;
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
  falseSignature?: boolean;
}

export interface Mech {
  id: string;
  owner: Owner;
  side: Owner;
  pos: Position;
  targetBuildingId?: string;
  path?: Position[];
  pathTargetId?: string;
  waypointIndex?: number;
  layer?: TileLayer;
  detectedUntil?: number;
  layerTransitionRemaining?: number;
  hp: number;
  maxHp: number;
  state: "LANDING" | "WALKING" | "ATTACKING";
  attackCooldown: number;
  tier: MechTier;
  weaponMode: MechWeaponMode;
}

/** Ground APC — Factory garrison that hunts enemy mechs on the home island. */
export interface Vehicle {
  id: string;
  owner: Owner;
  side: Owner;
  pos: Position;
  hp: number;
  maxHp: number;
  state: "IDLE" | "MOVING" | "DEAD";
  facing?: number;
  attackCooldown: number;
  targetMechId?: string;
}

/** Gunship — Factory assault craft that flies to the enemy island and strafes. */
export interface Aircraft {
  id: string;
  owner: Owner;
  side: Owner;
  pos: Position;
  hp: number;
  maxHp: number;
  state: "IDLE" | "FLYING" | "DEAD";
  facing?: number;
  attackCooldown: number;
  targetBuildingId?: string;
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
  /** Optional flipbook FX key prefix (explosion/smoke/muzzle). */
  fx?: "explosion" | "smoke" | "muzzle";
  /** Streak/tracer or spark instead of default radial blast (AA↔gunship readability). */
  kind?: "blast" | "tracer" | "spark";
}

export interface TerrainMutation {
  id: string;
  side: Owner;
  position: Position;
  original: TerrainType;
  mutated: TerrainType;
  expiresAt: number;
  sourceBuilding: string;
}

/** Player Factory production preference (enemy always uses AUTO). */
export type FactoryDoctrine = "AUTO" | "APC" | "GUNSHIP" | "HOLD";

/** Player gunship strike priority (enemy always uses AUTO). Mirrors mech fire-mode chips. */
export type GunshipStrikePriority = "AUTO" | "HQ" | "AA" | "ENERGY" | "MISSILE";

export type ReplayCommandType =
  | "BUILD"
  | "FIRE"
  | "INTERCEPT"
  | "SELECT_BUILD"
  | "SELECT_WEAPON"
  | "SET_VIEW_LAYER"
  | "SET_FACTORY_DOCTRINE"
  | "SET_GUNSHIP_PRIORITY";

export interface ReplayCommand {
  frame: number;
  type: ReplayCommandType;
  payload: Record<string, string | number | boolean | null>;
}

export interface ReplayFrameHash {
  frame: number;
  elapsed: number;
  hash: string;
}

export interface ReplaySnapshot {
  version: 1;
  missionId: string | null;
  seed: number;
  commands: ReplayCommand[];
  hashes: ReplayFrameHash[];
}

export interface AlertItem {
  id: string;
  text: string;
  level: "info" | "warn" | "crit";
  ts: number;
  category?: "incoming" | "economy" | "ewarfare" | "combat" | "subterranean" | "ecology";
  worldPos?: Position;
  side?: Owner;
  severity?: number;
  suggestion?: string;
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
  isProcedural?: boolean;
  proceduralMeta?: {
    seed: string;
    validation: string[];
  };
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
  /** Multi-tile footprint width/height in tiles (default 1×1). */
  footprintW?: number;
  footprintH?: number;
  /** Max instances per side (e.g. HQ capped at 3). */
  maxPerSide?: number;
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
  rngSeed: number;
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
  /** Factory-produced APCs (home island) and gunships (cross-island assault). */
  vehicles: Vehicle[];
  aircraft: Aircraft[];
  particles: Particle[];
  playerIsland: Tile[];
  enemyIsland: Tile[];
  fogPlayer: boolean[];
  fogEnemy: boolean[];
  alerts: AlertItem[];
  selectedBuild: BuildingType | null;
  selectedWeapon: ProjectileType | null;
  selectedMechWeapon: MechWeaponMode;
  selectedMechTier: MechTier;
  /** Player-only Factory spawn preference; enemy Factories stay on AUTO. */
  playerFactoryDoctrine: FactoryDoctrine;
  /** Player-only gunship building priority; enemy gunships stay on AUTO. */
  playerGunshipPriority: GunshipStrikePriority;
  viewLayer: TileLayer;
  weatherActive?: {
    type: WeatherType;
    startedAt: number;
    duration: number;
    intensity: number;
    affectedTiles?: Array<Position & { side: Owner }>;
    sourceSide: Owner;
  };
  terrainMutations: TerrainMutation[];
  aiState: {
    phase: "ECO" | "ARMY" | "ASSAULT";
    nextActionAt: number;
    builtCount: number;
    jammerTick?: number;
    memory: {
      seenPlayerBuildings: Record<string, { type: BuildingType; pos: Position; lastSeenAt: number }>;
      aaProbeScore: number;
      lastProbeAt: number;
      lastDecision?: string;
    };
  };
  stats: {
    missilesFired: number;
    marinesDeployed: number;
    buildingsLost: number;
    buildingsDestroyed: number;
    environmentalActions: number;
  };
  replay: {
    frame: number;
    commands: ReplayCommand[];
    hashes: ReplayFrameHash[];
  };
  shake: number;
}
