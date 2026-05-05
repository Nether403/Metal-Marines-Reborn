import { BUILDINGS, WEAPON_COSTS, WEAPON_LABELS } from "@/game/constants";
import { formatCostPressure, getBuildingCost } from "@/game/economy";
import type { BuildingType, ProjectileType, RuntimeState } from "@/game/types";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { Crosshair, Hammer, Radio, Rocket, Shield, Skull, Zap } from "lucide-react";

const buildOrder: BuildingType[] = [
  "ENERGY_PLANT",
  "SUPPLY_DEPOT",
  "RADAR",
  "RADAR_JAMMER",
  "TUNNEL_ENTRANCE",
  "SEISMIC_SENSOR",
  "TERRAIN_DESTABILIZER",
  "WEATHER_CONTROL",
  "BIOSPHERE_ENGINE",
  "MISSILE_LAUNCHER",
  "EMP_CANNON",
  "METAL_MARINE_BASE",
  "AA_GUN",
  "GUN_TURRET",
  "LAND_MINE",
];

const weaponOrder: ProjectileType[] = ["ICBM", "DUMMY", "AA", "TRANSPORT_POD", "EMP", "TUNNEL_BUSTER"];

const buildCategory: Record<BuildingType, "BASE" | "INTEL" | "WEAPONS" | "ECOLOGY"> = {
  HQ: "BASE",
  ENERGY_PLANT: "BASE",
  SUPPLY_DEPOT: "BASE",
  RADAR: "INTEL",
  RADAR_JAMMER: "INTEL",
  TUNNEL_ENTRANCE: "INTEL",
  SEISMIC_SENSOR: "INTEL",
  TERRAIN_DESTABILIZER: "ECOLOGY",
  WEATHER_CONTROL: "ECOLOGY",
  BIOSPHERE_ENGINE: "ECOLOGY",
  MISSILE_LAUNCHER: "WEAPONS",
  EMP_CANNON: "WEAPONS",
  METAL_MARINE_BASE: "WEAPONS",
  AA_GUN: "WEAPONS",
  GUN_TURRET: "WEAPONS",
  LAND_MINE: "WEAPONS",
};

const categoryTone = {
  BASE: "text-cyan-100 border-cyan-300/30 bg-cyan-500/10",
  INTEL: "text-violet-100 border-violet-300/30 bg-violet-500/10",
  WEAPONS: "text-red-100 border-red-300/30 bg-red-500/10",
  ECOLOGY: "text-lime-100 border-lime-300/30 bg-lime-500/10",
};

const categoryIcon = {
  BASE: Hammer,
  INTEL: Radio,
  WEAPONS: Shield,
  ECOLOGY: Zap,
};

const shortName = (name: string) =>
  name
    .replace("Headquarters", "HQ")
    .replace("Energy Plant", "Energy")
    .replace("Supply Depot", "Depot")
    .replace("Missile Silo", "Silo")
    .replace("Radar Array", "Radar")
    .replace("Metal Marine", "Marine");

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

  const readyWeapons = weaponOrder.filter((t) => {
    if (t === "TRANSPORT_POD") return hasMechBay;
    if (t === "EMP") return hasEmp;
    return hasLauncher;
  }).length;

  return (
    <div className="mm-panel border-x-0 border-b-0 font-mono">
      <div className="grid grid-cols-[1.65fr_1fr] gap-2 p-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <div className="mm-panel-title text-[10px]">BUILD CONTROL</div>
              <div className="text-xs font-black tracking-wide text-slate-100">BASE / DEFENSES / SYSTEMS</div>
            </div>
            <div className="hidden gap-1 text-[8px] uppercase tracking-wider text-slate-400 lg:flex">
              {(["BASE", "INTEL", "WEAPONS", "ECOLOGY"] as const).map((cat) => {
                const Icon = categoryIcon[cat];
                return (
                  <span key={cat} className={`mm-corner-cut flex items-center gap-1 border px-1.5 py-0.5 ${categoryTone[cat]}`}>
                    <Icon className="h-2.5 w-2.5" /> {cat}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 xl:grid-cols-8">
            {buildOrder.map((t) => {
              const spec = BUILDINGS[t];
              const cost = getBuildingCost(state.buildings, "PLAYER", t);
              const sel = state.selectedBuild === t;
              const ok = canAfford(cost.funds, cost.energy);
              const cat = buildCategory[t];
              const Icon = categoryIcon[cat];
              return (
                <button
                  key={t}
                  onClick={() => selectBuild(sel ? null : t)}
                  className={cn(
                    "mm-corner-cut mm-hud-button relative min-h-[52px] overflow-hidden border p-1 text-left transition-all",
                    sel
                      ? "border-cyan-200 bg-cyan-400/15 text-cyan-50 shadow-[0_0_18px_rgba(55,216,255,0.34)]"
                      : ok
                      ? "border-slate-500/35 text-slate-100 hover:border-cyan-300/60"
                      : "border-slate-700/40 bg-black/30 text-slate-500 grayscale"
                  )}
                  title={formatCostPressure(state.buildings, "PLAYER", t)}
                >
                  <div className="absolute right-1 top-1 rounded-sm border border-white/10 bg-black/35 px-1 text-[9px] font-black text-slate-200">
                    {spec.hotkey}
                  </div>
                  <div className="mb-0.5 grid h-5 w-7 place-items-center border border-white/10 bg-black/30">
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="truncate text-[9px] font-bold uppercase leading-tight">{shortName(spec.name)}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[8px] text-amber-200/90">
                    <span>${cost.funds}</span>
                    {cost.energy ? <span className="text-cyan-200/85">{cost.energy}E</span> : null}
                  </div>
                  <div className={`absolute bottom-0 left-0 h-0.5 ${sel ? "w-full bg-cyan-200" : ok ? "w-2/3 bg-slate-500" : "w-1/3 bg-slate-700"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <div className="mm-panel-title text-[10px] text-red-100/80">STRIKE DOCTRINES</div>
              <div className="text-xs font-black tracking-wide text-red-100">LAUNCH CONTROL</div>
            </div>
            <div className="mm-corner-cut border border-red-300/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-red-100">
              {readyWeapons}/{weaponOrder.length} armed
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
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
                    "mm-corner-cut mm-hud-button relative min-h-[52px] overflow-hidden border p-1 text-left transition-all",
                    sel
                      ? "border-red-200 bg-red-400/15 text-red-50 shadow-[0_0_18px_rgba(239,68,68,0.34)]"
                      : ok
                      ? "border-red-300/35 text-slate-100 hover:border-red-200/70"
                      : "border-slate-700/40 bg-black/30 text-slate-500 grayscale"
                  )}
                  title={lbl.desc + (needs ? "" : " (Requires launcher)")}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="grid h-5 w-7 place-items-center border border-white/10 bg-black/30 text-red-100">
                      {t === "AA" ? <Crosshair className="h-3 w-3" /> : t === "EMP" ? <Zap className="h-3 w-3" /> : t === "TUNNEL_BUSTER" ? <Skull className="h-3 w-3" /> : <Rocket className="h-3 w-3" />}
                    </div>
                    <div className="rounded-sm border border-white/10 bg-black/35 px-1 text-[9px] font-black text-slate-200">{lbl.hotkey}</div>
                  </div>
                  <div className="mt-0.5 truncate text-[9px] font-bold uppercase leading-tight">{lbl.name}</div>
                  <div className="mt-0.5 text-[8px] text-amber-200/90">${cost.funds} <span className="text-cyan-200/85">{cost.energy}E</span></div>
                  {!needs && <div className="hidden text-[8px] uppercase text-slate-500 xl:block">Requires asset</div>}
                  <div className={`absolute bottom-0 left-0 h-0.5 ${sel ? "w-full bg-red-200" : ok ? "w-2/3 bg-red-500" : "w-1/3 bg-slate-700"}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="hidden justify-between border-t border-white/5 px-2 pb-1 pt-1 text-[9px] uppercase tracking-wider text-slate-500 md:flex">
        <span>
          Click LEFT island to BUILD. Click RIGHT island to FIRE. Right-click or ESC to cancel.
        </span>
        <span>1-0,-,=,[,],\ build · QWERTY weapons · V layer · SPACE pause</span>
      </div>
    </div>
  );
}
