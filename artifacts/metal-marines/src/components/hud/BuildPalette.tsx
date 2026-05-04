import { BUILDINGS, WEAPON_COSTS, WEAPON_LABELS } from "@/game/constants";
import { formatCostPressure, getBuildingCost } from "@/game/economy";
import type { BuildingType, ProjectileType, RuntimeState } from "@/game/types";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";

const buildOrder: BuildingType[] = [
  "ENERGY_PLANT",
  "SUPPLY_DEPOT",
  "RADAR",
  "RADAR_JAMMER",
  "MISSILE_LAUNCHER",
  "EMP_CANNON",
  "METAL_MARINE_BASE",
  "AA_GUN",
  "GUN_TURRET",
  "LAND_MINE",
];

const weaponOrder: ProjectileType[] = ["ICBM", "DUMMY", "AA", "TRANSPORT_POD", "EMP"];

export default function BuildPalette({ state }: { state: RuntimeState }) {
  const selectBuild = useGame((s) => s.selectBuild);
  const selectWeapon = useGame((s) => s.selectWeapon);

  const canAfford = (f: number, e: number) => state.playerFunds >= f && state.playerEnergy >= e;
  const hasLauncher = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "MISSILE_LAUNCHER" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const hasMechBay = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "METAL_MARINE_BASE" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const hasEmp = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "EMP_CANNON" && b.hp > 0 && b.buildTimeRemaining <= 0 && (b.disabledUntil ?? 0) <= state.elapsed
  );

  return (
    <div className="border-t border-primary/30 bg-black/60 font-mono">
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* Build column */}
        <div>
          <div className="text-xs uppercase tracking-widest text-primary/80 mb-2">
            CONSTRUCT
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {buildOrder.map((t) => {
              const spec = BUILDINGS[t];
              const cost = getBuildingCost(state.buildings, "PLAYER", t);
              const sel = state.selectedBuild === t;
              const ok = canAfford(cost.funds, cost.energy);
              return (
                <button
                  key={t}
                  onClick={() => selectBuild(sel ? null : t)}
                  className={cn(
                    "relative h-16 rounded border text-[10px] leading-tight px-1 transition-all flex flex-col items-center justify-center gap-0.5",
                    sel
                      ? "border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      : ok
                      ? "border-primary/30 hover:border-primary/70 hover:bg-primary/10 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground/60"
                  )}
                  title={formatCostPressure(state.buildings, "PLAYER", t)}
                >
                  <span className="text-[14px] leading-none font-bold">{spec.hotkey}</span>
                  <span className="truncate w-full text-center">{spec.name.split(" ")[0]}</span>
                  <span className="text-[9px] text-yellow-300/80">
                    ${cost.funds}{cost.energy ? ` / ${cost.energy}E` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Weapons column */}
        <div>
          <div className="text-xs uppercase tracking-widest text-destructive/80 mb-2">
            WEAPONS
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {weaponOrder.map((t) => {
              const cost = WEAPON_COSTS[t];
              const lbl = WEAPON_LABELS[t];
              const sel = state.selectedWeapon === t;
              const needs = t === "TRANSPORT_POD" ? hasMechBay : t === "EMP" ? hasEmp : hasLauncher;
              const ok = canAfford(cost.funds, cost.energy) && needs;
              return (
                <button
                  key={t}
                  onClick={() => selectWeapon(sel ? null : t)}
                  className={cn(
                    "relative h-16 rounded border text-[10px] leading-tight px-1 transition-all flex flex-col items-center justify-center gap-0.5",
                    sel
                      ? "border-destructive bg-destructive/20 text-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      : ok
                      ? "border-destructive/30 hover:border-destructive/70 hover:bg-destructive/10 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground/60"
                  )}
                  title={lbl.desc + (needs ? "" : " (Requires launcher)")}
                >
                  <span className="text-[14px] leading-none font-bold">{lbl.hotkey}</span>
                  <span className="truncate w-full text-center">{lbl.name}</span>
                  <span className="text-[9px] text-yellow-300/80">
                    ${cost.funds} / {cost.energy}E
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[10px] text-muted-foreground/70 flex justify-between border-t border-primary/10 pt-1">
        <span>
          Click LEFT island to BUILD. Click RIGHT island to FIRE. Right-click or ESC to cancel.
        </span>
        <span>1-8 build · QWER weapons · SPACE pause</span>
      </div>
    </div>
  );
}
