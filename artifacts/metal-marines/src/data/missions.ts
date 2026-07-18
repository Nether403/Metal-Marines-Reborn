import type { MissionDef, Tile, TerrainType } from "@/game/types";
import { GRID_W, GRID_H } from "@/game/constants";
import { createProceduralMission } from "@/game/procedural";

const T = (s: string): Tile[] => {
  const tiles: Tile[] = [];
  const rows = s.trim().split("\n").map((r) => r.trim());
  for (let y = 0; y < GRID_H; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < GRID_W; x++) {
      const ch = row[x] ?? ".";
      let terrain: TerrainType = "GRASS";
      if (ch === "~") terrain = "WATER";
      else if (ch === "F" || ch === "f") terrain = "FOREST";
      else if (ch === "M" || ch === "^") terrain = "MOUNTAIN";
      else if (ch === ".") terrain = "GRASS";
      tiles.push({ x, y, terrain });
    }
  }
  return tiles;
};

// Each map is GRID_W (12) x GRID_H (10).
// Legend: ~ water, F forest, ^ mountain, . grass

const M1_P = T(`
~~~~~~~~~~~~
~..........~
~....F.....~
~..........~
~....HHH...~
~....HHH...~
~..........~
~......F...~
~..........~
~~~~~~~~~~~~
`);
const M1_E = T(`
~~~~~~~~~~~~
~..........~
~..F.......~
~..........~
~...HHH....~
~...HHH....~
~..........~
~......F...~
~..........~
~~~~~~~~~~~~
`);

const M2_P = T(`
~~~~~~~~~~~~
~....FF....~
~..........~
~..^^......~
~..........~
~....HHH...~
~....HHH...~
~........^.~
~..F.....F.~
~~~~~~~~~~~~
`);
const M2_E = T(`
~~~~~~~~~~~~
~..F.....F.~
~.^........~
~..........~
~....HHH...~
~....HHH...~
~..........~
~......^^..~
~....FF....~
~~~~~~~~~~~~
`);

const M3_P = T(`
~~~~~~~~~~~~
~..^^......~
~..........~
~..........~
~..F....F..~
~..F.HHH.F.~
~....HHH...~
~..........~
~........^^~
~~~~~~~~~~~~
`);
const M3_E = T(`
~~~~~~~~~~~~
~^^........~
~..........~
~..........~
~..F....F..~
~..F.HHH.F.~
~....HHH...~
~..........~
~......^^..~
~~~~~~~~~~~~
`);

const M4_P = T(`
~~~~~~~~~~~~
~..F.....F.~
~..........~
~.^.....^..~
~..........~
~....HHH...~
~....HHH...~
~..........~
~.F^.....F.~
~~~~~~~~~~~~
`);
const M4_E = T(`
~~~~~~~~~~~~
~.F.....^F.~
~..........~
~..^.....^.~
~..........~
~....HHH...~
~....HHH...~
~..........~
~..F.....F.~
~~~~~~~~~~~~
`);

const M5_P = T(`
~~~~~~~~~~~~
~^.F....F.^~
~..........~
~..........~
~..F.....F.~
~....HHH...~
~....HHH...~
~..F.....F.~
~^.F....F.^~
~~~~~~~~~~~~
`);
const M5_E = T(`
~~~~~~~~~~~~
~^.F....F.^~
~..F.....F.~
~..........~
~..........~
~....HHH...~
~....HHH...~
~..........~
~^^F....F^^~
~~~~~~~~~~~~
`);

const M6_P = T(`
~~~~~~~~~~~~
~^^^.....^^~
~^........^~
~..F....F..~
~..........~
~....HHH...~
~....HHH...~
~..F.F.F.F.~
~^^......^^~
~~~~~~~~~~~~
`);
const M6_E = T(`
~~~~~~~~~~~~
~^^......^^~
~^.F.F.F.F^~
~..........~
~..........~
~....HHH...~
~....HHH...~
~..F....F..~
~^........^~
~~~~~~~~~~~~
`);

// Strip the H markers; HQ position is set explicitly. Convert H back to grass.
const cleanH = (tiles: Tile[]): Tile[] =>
  tiles.map((t) => (t.terrain as string) === "HHH" ? t : t);

void cleanH;

export const MISSIONS: MissionDef[] = [
  {
    id: "m1",
    index: 1,
    title: "Operation: First Light",
    commanderId: "voss",
    objective: "Destroy the enemy Headquarters.",
    briefing:
      "Theater Command marks this eastern sector Available — Cadet Voss holds a rookie outpost. Raise Supply Depots and Energy Plants, then a Missile Silo or Mech Bay. Radar and AA buy you time; finish his Headquarters before reinforcements arrive.",
    difficulty: 1,
    playerIsland: M1_P,
    enemyIsland: M1_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 4, y: 5 },
    enemyAggression: 0.12,
    enemyEcoBias: 0.75,
    startFunds: 1400,
    startEnergy: 550,
  },
  {
    id: "m2",
    index: 2,
    title: "Operation: Iron Tide",
    commanderId: "rhe",
    objective: "Penetrate enemy defenses and destroy the HQ.",
    briefing:
      "Captain Rhe favors layered AA and silo nests. Frontal missile spam will fail. Mix dummies, scout patterns, then commit Marines through the seams.",
    difficulty: 2,
    playerIsland: M2_P,
    enemyIsland: M2_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: 0.35,
    enemyEcoBias: 0.6,
    startFunds: 1100,
    startEnergy: 500,
  },
  {
    id: "m3",
    index: 3,
    title: "Operation: Brimstone",
    commanderId: "calder",
    objective: "Outlast the rush and crush the HQ.",
    briefing:
      "Major Calder rushes Mech Bays. Expect transport pods within 90 seconds. Wall up your AA early, place mines around the HQ, and counter-strike when his economy stalls.",
    difficulty: 3,
    playerIsland: M3_P,
    enemyIsland: M3_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: 0.85,
    enemyEcoBias: 0.35,
    startFunds: 1100,
    startEnergy: 500,
  },
  {
    id: "m4",
    index: 4,
    title: "Operation: Black Veil",
    commanderId: "iyobi",
    objective: "Survive coordinated salvos. End the threat.",
    briefing:
      "Colonel Iyobi opens with dummy waves to drain your AA, then drops live ICBMs. Hold your interceptors; bait her dummies; punish the gap.",
    difficulty: 4,
    playerIsland: M4_P,
    enemyIsland: M4_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: 0.7,
    enemyEcoBias: 0.5,
    startFunds: 1300,
    startEnergy: 600,
  },
  {
    id: "m5",
    index: 5,
    title: "Operation: Storm Anvil",
    commanderId: "stryx",
    objective: "Break the Iron Bloc. Destroy the HQ.",
    briefing:
      "General Stryx fields more silos and AA than any commander you have faced. He will out-economy you if you stall. Expand fast, stagger your strikes, and never stop pressuring.",
    difficulty: 5,
    playerIsland: M5_P,
    enemyIsland: M5_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: 0.85,
    enemyEcoBias: 0.65,
    startFunds: 1500,
    startEnergy: 700,
  },
  {
    id: "m6",
    index: 6,
    title: "Operation: NULL Sector",
    commanderId: "null_",
    objective: "End the autonomous war intelligence. Forever.",
    briefing:
      "NULL adapts. NULL never sleeps. NULL fields perfect economy AND perfect aggression. There is no formula. Build, adapt, survive, strike. End it here, Commander.",
    difficulty: 6,
    playerIsland: M6_P,
    enemyIsland: M6_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: 1.0,
    enemyEcoBias: 0.7,
    startFunds: 1700,
    startEnergy: 800,
  },
];

const CAMPAIGN_EXTENSION: Array<{
  id: string;
  index: number;
  title: string;
  commanderId: string;
  objective: string;
  briefing: string;
  difficulty: number;
  aggression: number;
  eco: number;
  funds: number;
  energy: number;
  mapP: Tile[];
  mapE: Tile[];
}> = [
  {
    id: "m7",
    index: 7,
    title: "Operation: Triple Crown",
    commanderId: "voss",
    objective: "Hold three bases and crush the enemy HQ network.",
    briefing:
      "Doctrine update: field multiple Headquarters. Lose one and the war continues — lose all three and you fall. Build Gun Pods and a Factory before the tempo war begins.",
    difficulty: 3,
    aggression: 0.55,
    eco: 0.55,
    funds: 1600,
    energy: 700,
    mapP: M3_P,
    mapE: M3_E,
  },
  {
    id: "m8",
    index: 8,
    title: "Operation: Bunker Line",
    commanderId: "rhe",
    objective: "Crack Gun Pod bunkers with Anti-POD Marines.",
    briefing:
      "Enemy Gun Pods shrug off standard rifles. Switch Metal Marines to Anti-POD loadout, or watch your Gunners melt on the beach.",
    difficulty: 4,
    aggression: 0.6,
    eco: 0.5,
    funds: 1500,
    energy: 650,
    mapP: M4_P,
    mapE: M4_E,
  },
  {
    id: "m9",
    index: 9,
    title: "Operation: Ghost Base",
    commanderId: "iyobi",
    objective: "Use Dummy Bases and Cover to bait strikes.",
    briefing:
      "Decoy Headquarters draw fire. Dummy Cover masks adjacent bases from radar. Misdirect, then answer with ICBM Silo fire.",
    difficulty: 4,
    aggression: 0.65,
    eco: 0.55,
    funds: 1550,
    energy: 680,
    mapP: M2_P,
    mapE: M2_E,
  },
  {
    id: "m10",
    index: 10,
    title: "Operation: Silo Authority",
    commanderId: "calder",
    objective: "Authorize ICBM launches from an intact 3×3 silo.",
    briefing:
      "Standard Missile Silos no longer clear strategic warheads. Raise an ICBM Silo — all nine tiles must stay standing — and rewrite the map.",
    difficulty: 5,
    aggression: 0.7,
    eco: 0.6,
    funds: 1800,
    energy: 800,
    mapP: M5_P,
    mapE: M5_E,
  },
  {
    id: "m11",
    index: 11,
    title: "Operation: Radar Lattice",
    commanderId: "stryx",
    objective: "Stack Radar to push AA hit chance toward 100%.",
    briefing:
      "AA Batteries start at 50% intercept. Each Radar Array adds +5%. Build the lattice before their pods arrive.",
    difficulty: 5,
    aggression: 0.8,
    eco: 0.55,
    funds: 1700,
    energy: 750,
    mapP: M5_P,
    mapE: M4_E,
  },
  {
    id: "m12",
    index: 12,
    title: "Operation: Gunner Doctrine",
    commanderId: "null_",
    objective: "Field Gunner-II Marines with the correct weapon mode.",
    briefing:
      "Gunner-II frames cost more but hit harder. Pair Anti-MMR for mech duels and Anti-POD for bunker clearing. Max three assault Marines in flight or on the ground.",
    difficulty: 6,
    aggression: 0.85,
    eco: 0.6,
    funds: 1900,
    energy: 850,
    mapP: M6_P,
    mapE: M6_E,
  },
];

for (const ext of CAMPAIGN_EXTENSION) {
  MISSIONS.push({
    id: ext.id,
    index: ext.index,
    title: ext.title,
    commanderId: ext.commanderId,
    objective: ext.objective,
    briefing: ext.briefing,
    difficulty: ext.difficulty,
    playerIsland: ext.mapP,
    enemyIsland: ext.mapE,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 5, y: 5 },
    enemyAggression: ext.aggression,
    enemyEcoBias: ext.eco,
    startFunds: ext.funds,
    startEnergy: ext.energy,
  });
}

// Missions 13–20: seeded procedural ops to approach original campaign length
for (let i = 13; i <= 20; i++) {
  const seed = `campaign-${i}`;
  const generated = createProceduralMission({
    seed,
    difficulty: Math.min(6, 3 + Math.floor((i - 13) / 2)),
    title: `Operation: Frontier ${i}`,
  });
  MISSIONS.push({
    ...generated,
    id: `m${i}`,
    index: i,
    commanderId: ["voss", "rhe", "iyobi", "calder", "stryx", "null_"][(i - 1) % 6],
    objective: generated.objective,
    briefing: `${generated.briefing} Advanced campaign sector ${i}/20. Tunnel and ecology tech are authorized if you can afford the diversion.`,
  });
}

export const getMission = (id: string) => {
  const fixed = MISSIONS.find((m) => m.id === id);
  if (fixed) return fixed;
  if (id.startsWith("skirmish-")) {
    const seed = id.slice("skirmish-".length) || "reborn";
    return createProceduralMission({ seed, difficulty: 5, title: "Generated Skirmish" });
  }
  return undefined;
};
