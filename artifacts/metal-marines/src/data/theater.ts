/** Strategic positions for campaign theater nodes (percent of map). */
export type TheaterNodePos = { id: string; x: number; y: number };

/** Hand-tuned island sectors across the Pacific theater backdrop. */
export const THEATER_NODES: TheaterNodePos[] = [
  { id: "m1", x: 18, y: 62 },
  { id: "m2", x: 28, y: 48 },
  { id: "m3", x: 38, y: 58 },
  { id: "m4", x: 34, y: 34 },
  { id: "m5", x: 48, y: 42 },
  { id: "m6", x: 52, y: 58 },
  { id: "m7", x: 58, y: 30 },
  { id: "m8", x: 62, y: 48 },
  { id: "m9", x: 68, y: 62 },
  { id: "m10", x: 72, y: 38 },
  { id: "m11", x: 78, y: 52 },
  { id: "m12", x: 82, y: 28 },
  { id: "m13", x: 22, y: 28 },
  { id: "m14", x: 44, y: 22 },
  { id: "m15", x: 56, y: 18 },
  { id: "m16", x: 66, y: 20 },
  { id: "m17", x: 86, y: 44 },
  { id: "m18", x: 88, y: 66 },
  { id: "m19", x: 74, y: 72 },
  { id: "m20", x: 42, y: 72 },
];

/** Supply-line pairs (mission indices) for theater decorations. */
export const THEATER_LINKS: [string, string][] = [
  ["m1", "m2"],
  ["m2", "m3"],
  ["m2", "m4"],
  ["m3", "m5"],
  ["m4", "m5"],
  ["m5", "m6"],
  ["m5", "m7"],
  ["m6", "m8"],
  ["m7", "m8"],
  ["m8", "m9"],
  ["m8", "m10"],
  ["m10", "m11"],
  ["m10", "m12"],
  ["m4", "m13"],
  ["m7", "m14"],
  ["m14", "m15"],
  ["m15", "m16"],
  ["m12", "m16"],
  ["m11", "m17"],
  ["m17", "m18"],
  ["m9", "m19"],
  ["m6", "m20"],
];
