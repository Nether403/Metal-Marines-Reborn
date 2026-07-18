import type { MissionDef, Tile, TerrainType } from "@/game/types";
import { GRID_W, GRID_H } from "@/game/constants";
import { createProceduralMission, parseSkirmishMissionId } from "@/game/procedural";

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

// Late-campaign authored maps (m13–m20) — choke islands for hard ops.
const M13_P = T(`
~~~~~~~~~~~~
~^^~....~^^~
~^..FFFF..^~
~....~~....~
~..F.HHH.F.~
~....HHH...~
~..F.~.~.F.~
~.^......^.~
~^^F....F^^~
~~~~~~~~~~~~
`);
const M13_E = T(`
~~~~~~~~~~~~
~^^F....F^^~
~.^......^.~
~..F.~.~.F.~
~....HHH...~
~..F.HHH.F.~
~....~~....~
~^..FFFF..^~
~^^~....~^^~
~~~~~~~~~~~~
`);

const M14_P = T(`
~~~~~~~~~~~~
~^^^^..^^^^~
~^........^~
~..^^..^^..~
~....HHH...~
~..F.HHH.F.~
~..........~
~.FF....FF.~
~^~......~^~
~~~~~~~~~~~~
`);
const M14_E = T(`
~~~~~~~~~~~~
~^~......~^~
~.FF....FF.~
~..........~
~..F.HHH.F.~
~....HHH...~
~..^^..^^..~
~^........^~
~^^^^..^^^^~
~~~~~~~~~~~~
`);

const M15_P = T(`
~~~~~~~~~~~~
~F.F.~~.F.F~
~.FFF..FFF.~
~..F....F..~
~.^..HHH..^~
~....HHH...~
~.^^....^^.~
~F..FFFF..F~
~.^~~~~~~^.~
~~~~~~~~~~~~
`);
const M15_E = T(`
~~~~~~~~~~~~
~.^~~~~~~^.~
~F..FFFF..F~
~.^^....^^.~
~....HHH...~
~.^..HHH..^~
~..F....F..~
~.FFF..FFF.~
~F.F.~~.F.F~
~~~~~~~~~~~~
`);

// Twin lagoon bridges — two land spans across a cut channel.
const M16_P = T(`
~~~~~~~~~~~~
~^^^^~~^^^^~
~^F......F^~
~.~~....~~.~
~..F.HHH.F.~
~....HHH...~
~.FF.~.~.FF~
~..........~
~^^F~~~~F^^~
~~~~~~~~~~~~
`);
const M16_E = T(`
~~~~~~~~~~~~
~^^F~~~~F^^~
~..........~
~.FF.~.~.FF~
~....HHH...~
~..F.HHH.F.~
~.~~....~~.~
~^F......F^~
~^^^^~~^^^^~
~~~~~~~~~~~~
`);

// Crescent ridge — mountains ring the pad; narrow forest gates.
const M17_P = T(`
~~~~~~~~~~~~
~^^^^^^^^^^~
~^........^~
~^.~~~~~~.^~
~^F.HHHH.F^~
~^..HHHH..^~
~^.F....F.^~
~^..FFFF..^~
~^^......^^~
~~~~~~~~~~~~
`);
const M17_E = T(`
~~~~~~~~~~~~
~^^......^^~
~^..FFFF..^~
~^.F....F.^~
~^..HHHH..^~
~^F.HHHH.F^~
~^.~~~~~~.^~
~^........^~
~^^^^^^^^^^~
~~~~~~~~~~~~
`);

// Shatter channels — diagonal water cuts + canopy pockets (diff 6).
const M18_P = T(`
~~~~~~~~~~~~
~F~~^^^^~~F~
~.F.~..~.F.~
~~.F.~~.F.~~
~.^..HHH..^~
~F...HHH..F~
~.^^.~.~.^^~
~F.F.~~.F.F~
~.^~~~~~~^.~
~~~~~~~~~~~~
`);
const M18_E = T(`
~~~~~~~~~~~~
~.^~~~~~~^.~
~F.F.~~.F.F~
~.^^.~.~.^^~
~F...HHH..F~
~.^..HHH..^~
~~.F.~~.F.~~
~.F.~..~.F.~
~F~~^^^^~~F~
~~~~~~~~~~~~
`);

// Moat crown — water ring with cardinal land bridges (finale tier).
const M19_P = T(`
~~~~~~~~~~~~
~^^^^~~^^^^~
~^F~....~F^~
~~.~.~~.~.~~
~..F.HHH.F.~
~....HHH...~
~~.~.~~.~.~~
~^F~....~F^~
~^^^^~~^^^^~
~~~~~~~~~~~~
`);
const M19_E = T(`
~~~~~~~~~~~~
~^^^^~~^^^^~
~^F~....~F^~
~~.~.~~.~.~~
~....HHH...~
~..F.HHH.F.~
~~.~.~~.~.~~
~^F~....~F^~
~^^^^~~^^^^~
~~~~~~~~~~~~
`);

// Crossfire isle — X-cut channels + mountain arms (campaign finale).
const M20_P = T(`
~~~~~~~~~~~~
~F^^~..~^^F~
~.~~F..F~~.~
~^~.~~~~.~^~
~.F..HHH..F~
~..~.HHH.~.~
~^~.~~~~.~^~
~.~~F..F~~.~
~F^^~~~~^^F~
~~~~~~~~~~~~
`);
const M20_E = T(`
~~~~~~~~~~~~
~F^^~~~~^^F~
~.~~F..F~~.~
~^~.~~~~.~^~
~..~.HHH.~.~
~.F..HHH..F~
~^~.~~~~.~^~
~.~~F..F~~.~
~F^^~..~^^F~
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
  {
    id: "m13",
    index: 13,
    title: "Operation: Strait Gate",
    commanderId: "voss",
    objective: "Force the strait — break AA, then the HQ.",
    briefing:
      "Narrow water cuts and forest belts choke drop lanes. Raise a Factory, set gunship strike priority to AA, then punch HQ once the lattice is down. Difficulty stays hard.",
    difficulty: 5,
    aggression: 0.8,
    eco: 0.55,
    funds: 1850,
    energy: 820,
    mapP: M13_P,
    mapE: M13_E,
  },
  {
    id: "m14",
    index: 14,
    title: "Operation: Ridge Hammer",
    commanderId: "rhe",
    objective: "Clear mountain ridges and destroy the HQ network.",
    briefing:
      "Ridge walls funnel Marines into Gun Pod kill zones. Use Anti-POD loadouts, Dummy Cover, and Energy-priority gunships to starve their grid before the final push.",
    difficulty: 5,
    aggression: 0.85,
    eco: 0.6,
    funds: 1900,
    energy: 850,
    mapP: M14_P,
    mapE: M14_E,
  },
  {
    id: "m15",
    index: 15,
    title: "Operation: Canopy Break",
    commanderId: "iyobi",
    objective: "Burn through canopy cover and end the HQ.",
    briefing:
      "Dense forest and tidal cuts hide Dummy Bases. Scout with radar, designate Missile priority for gunships, and authorize ICBM fire only when the 3×3 silo is intact.",
    difficulty: 5,
    aggression: 0.88,
    eco: 0.58,
    funds: 1950,
    energy: 880,
    mapP: M15_P,
    mapE: M15_E,
  },
  {
    id: "m16",
    index: 16,
    title: "Operation: Twin Lagoon",
    commanderId: "calder",
    objective: "Cross the lagoon bridges and destroy the HQ.",
    briefing:
      "Twin water cuts leave only two land spans. Calder floods Mech Bays early — hold both bridges with Gun Pods and AA, then send Energy-priority gunships to starve his plants before the final Marine push.",
    difficulty: 5,
    aggression: 0.9,
    eco: 0.55,
    funds: 2000,
    energy: 900,
    mapP: M16_P,
    mapE: M16_E,
  },
  {
    id: "m17",
    index: 17,
    title: "Operation: Crescent Ridge",
    commanderId: "stryx",
    objective: "Breach the mountain crescent and end the HQ.",
    briefing:
      "A mountain ring funnels every approach through forest gates. Stryx stacks silos behind the ridge — Dummy Cover the approaches, punch AA with gunships, then crack the pad with Anti-POD Marines.",
    difficulty: 5,
    aggression: 0.92,
    eco: 0.62,
    funds: 2050,
    energy: 920,
    mapP: M17_P,
    mapE: M17_E,
  },
  {
    id: "m18",
    index: 18,
    title: "Operation: Shatter Channel",
    commanderId: "null_",
    objective: "Navigate shatter cuts and erase the HQ network.",
    briefing:
      "Diagonal channels and canopy pockets shatter drop lanes. NULL adapts on both bridges — multi-base, Factory doctrine on GUNSHIP, and ICBM only when the 3×3 silo survives. Difficulty maxed.",
    difficulty: 6,
    aggression: 0.95,
    eco: 0.65,
    funds: 2100,
    energy: 950,
    mapP: M18_P,
    mapE: M18_E,
  },
  {
    id: "m19",
    index: 19,
    title: "Operation: Moat Crown",
    commanderId: "voss",
    objective: "Cross the moat bridges and destroy the HQ.",
    briefing:
      "A water crown leaves only cardinal land bridges. Voss stacks Gun Pods on every span — Factory on GUNSHIP, punch AA first, then Anti-POD Marines through one bridge while Dummy Cover soaks the rest. Tunnel and ecology tech authorized if you can spare the diversion.",
    difficulty: 6,
    aggression: 0.97,
    eco: 0.62,
    funds: 2150,
    energy: 980,
    mapP: M19_P,
    mapE: M19_E,
  },
  {
    id: "m20",
    index: 20,
    title: "Operation: Crossfire Isle",
    commanderId: "rhe",
    objective: "Survive the crossfire and erase the final HQ.",
    briefing:
      "X-cut channels and mountain arms create four kill corridors. Rhe answers every breach with layered AA and silo nests — multi-base, Energy-priority gunships, ICBM only on an intact 3×3. This is the campaign finale.",
    difficulty: 6,
    aggression: 1.0,
    eco: 0.68,
    funds: 2200,
    energy: 1000,
    mapP: M20_P,
    mapE: M20_E,
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

export const getMission = (id: string) => {
  const fixed = MISSIONS.find((m) => m.id === id);
  if (fixed) return fixed;
  const skirmish = parseSkirmishMissionId(id);
  if (skirmish) {
    const mission = createProceduralMission({
      seed: skirmish.seed,
      difficulty: skirmish.difficulty,
      title: "Generated Skirmish",
    });
    // Preserve the exact route id (legacy `skirmish-{seed}` vs canonical `skirmish-dN-…`)
    // so Play's missionId effect does not remount mid-session.
    if (mission.id !== id) return { ...mission, id };
    return mission;
  }
  return undefined;
};
