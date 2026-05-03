import type { MissionDef, Tile, TerrainType } from "@/game/types";
import { GRID_W, GRID_H } from "@/game/constants";

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
      "Coalition forces have located a rookie outpost on the eastern reach. Cadet Voss commands. Establish a foothold, build out economy, and end the operation before reinforcements arrive.",
    difficulty: 1,
    playerIsland: M1_P,
    enemyIsland: M1_E,
    playerStartHQ: { x: 5, y: 5 },
    enemyStartHQ: { x: 4, y: 5 },
    enemyAggression: 0.22,
    enemyEcoBias: 0.7,
    startFunds: 1200,
    startEnergy: 500,
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
    enemyAggression: 0.5,
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

export const getMission = (id: string) => MISSIONS.find((m) => m.id === id);
