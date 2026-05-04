const UINT32_MAX_PLUS_ONE = 0x100000000;

export const hashSeed = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const nextSeed = (seed: number): number =>
  (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;

export const randomFloatFromSeed = (seed: number): number =>
  nextSeed(seed) / UINT32_MAX_PLUS_ONE;

export const randomRangeFromSeed = (seed: number, min: number, max: number): number =>
  min + randomFloatFromSeed(seed) * (max - min);

export const randomIntFromSeed = (seed: number, min: number, maxExclusive: number): number =>
  min + Math.floor(randomFloatFromSeed(seed) * Math.max(0, maxExclusive - min));

export const createRng = (initialSeed: number) => {
  let seed = initialSeed >>> 0;
  return {
    next: () => {
      seed = nextSeed(seed);
      return seed / UINT32_MAX_PLUS_ONE;
    },
    seed: () => seed,
  };
};
