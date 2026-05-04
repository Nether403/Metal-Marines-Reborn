import { BUILDINGS, BUILDING_COST_SCALING } from "./constants";
import type { Building, BuildingType, Owner } from "./types";

export interface ResourceCost {
  funds: number;
  energy: number;
}

export const countOwnedBuildings = (
  buildings: Building[],
  side: Owner,
  type: BuildingType
): number =>
  buildings.filter((b) => b.side === side && b.type === type && b.hp > 0).length;

export const getBuildingCost = (
  buildings: Building[],
  side: Owner,
  type: BuildingType
): ResourceCost => {
  const spec = BUILDINGS[type];
  const scaling = BUILDING_COST_SCALING[type];
  if (!scaling) return { funds: spec.costFunds, energy: spec.costEnergy };

  const owned = countOwnedBuildings(buildings, side, type);
  const scaledCount = Math.max(0, owned - scaling.freeCount);
  if (scaledCount <= 0) return { funds: spec.costFunds, energy: spec.costEnergy };

  const multiplier = Math.min(
    scaling.maxMultiplier,
    1 + scaling.rate * Math.pow(scaledCount, scaling.exponent)
  );

  return {
    funds: Math.ceil((spec.costFunds * multiplier) / 5) * 5,
    energy: Math.ceil((spec.costEnergy * multiplier) / 5) * 5,
  };
};

export const formatCostPressure = (
  buildings: Building[],
  side: Owner,
  type: BuildingType
): string => {
  const base = BUILDINGS[type];
  const cost = getBuildingCost(buildings, side, type);
  if (cost.funds === base.costFunds && cost.energy === base.costEnergy) return base.description;
  return `${base.description} Progressive logistics pressure raises this build to $${cost.funds}${cost.energy ? ` / ${cost.energy}E` : ""}.`;
};
