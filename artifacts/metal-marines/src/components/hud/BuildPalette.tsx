import { BUILDINGS, WEAPON_COSTS, WEAPON_LABELS } from "@/game/constants";
import { formatCostPressure, getBuildingCost } from "@/game/economy";
import type { BuildingType, ProjectileType, RuntimeState } from "@/game/types";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { Crosshair, Hammer, Radio, Rocket, Shield, Skull, Zap } from "lucide-react";
import type { ReactNode } from "react";

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

type Category = "BASE" | "INTEL" | "WEAPONS" | "ECOLOGY";

const categoryMeta: Record<Category, { label: string; color: string; glow: string; Icon: React.FC<{ className?: string }> }> = {
  BASE:    { label: "Base",    color: "rgba(55,216,255,0.8)",  glow: "rgba(55,216,255,0.2)",  Icon: Hammer },
  INTEL:   { label: "Intel",  color: "rgba(168,85,247,0.8)",  glow: "rgba(168,85,247,0.2)",  Icon: Radio  },
  WEAPONS: { label: "Weapons",color: "rgba(240,76,76,0.85)",  glow: "rgba(240,76,76,0.2)",   Icon: Shield },
  ECOLOGY: { label: "Eco",    color: "rgba(132,204,22,0.8)",  glow: "rgba(132,204,22,0.15)", Icon: Zap    },
};

const shortName = (name: string) =>
  name
    .replace("Headquarters", "HQ")
    .replace("Energy Plant", "Energy")
    .replace("Supply Depot", "Depot")
    .replace("Missile Silo", "Silo")
    .replace("Radar Array", "Radar")
    .replace("Radar Jammer", "Jammer")
    .replace("Metal Marine", "Marine")
    .replace("Biosphere Engine", "Biosphere")
    .replace("Terrain Destabilizer", "Destabzr")
    .replace("Weather Control", "Weather")
    .replace("Seismic Sensor", "Seismic")
    .replace("Tunnel Entrance", "Tunnel");

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
    <div
      className="mm-panel border-x-0 border-b-0 font-mono"
      style={{ background: "linear-gradient(180deg,rgba(11,20,32,0.98),rgba(5,9,19,0.97))" }}
    >
      {/* Top separator */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(55,216,255,0.22) 50%,transparent)" }} />

      <div className="grid grid-cols-[1.7fr_1fr] gap-2 p-2">

        {/* ── BUILD CONTROL ── */}
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(55,216,255,0.65)" }}>BUILD CONTROL</div>
              <div className="text-[11px] font-black tracking-[0.06em]" style={{ color: "rgba(226,232,240,0.9)" }}>INFRASTRUCTURE / DEFENSES / SYSTEMS</div>
            </div>
            {/* Category legend */}
            <div className="hidden gap-1 lg:flex">
              {(["BASE", "INTEL", "WEAPONS", "ECOLOGY"] as const).map((cat) => {
                const { label, color, Icon } = categoryMeta[cat];
                return (
                  <span
                    key={cat}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
                    style={{
                      border: `1px solid ${color}40`,
                      background: `${color}12`,
                      color,
                      clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                    }}
                  >
                    <Icon className="h-2.5 w-2.5" /> {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1 xl:grid-cols-8">
            {buildOrder.map((t) => {
              const spec = BUILDINGS[t];
              const cost = getBuildingCost(state.buildings, "PLAYER", t);
              const sel = state.selectedBuild === t;
              const ok = canAfford(cost.funds, cost.energy);
              const cat = buildCategory[t];
              const meta = categoryMeta[cat];
              const Icon = meta.Icon;

              return (
                <BuildButton
                  key={t}
                  selected={sel}
                  affordable={ok}
                  onClick={() => selectBuild(sel ? null : t)}
                  title={formatCostPressure(state.buildings, "PLAYER", t)}
                  hotkey={spec.hotkey}
                  icon={<Icon className="h-3 w-3" />}
                  name={shortName(spec.name)}
                  costLabel={`$${cost.funds}${cost.energy ? ` · ${cost.energy}E` : ""}`}
                  accentColor={sel ? "var(--hud-energy)" : meta.color}
                  selectionColor="var(--hud-energy)"
                />
              );
            })}
          </div>
        </div>

        {/* ── STRIKE CONTROL ── */}
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(240,76,76,0.7)" }}>STRIKE DOCTRINES</div>
              <div className="text-[11px] font-black tracking-[0.06em]" style={{ color: "rgba(240,76,76,0.9)" }}>LAUNCH CONTROL</div>
            </div>
            <div
              className="px-2 py-0.5 text-[9px] uppercase tracking-widest"
              style={{
                border: "1px solid rgba(240,76,76,0.35)",
                background: "rgba(240,76,76,0.1)",
                color: "rgba(240,76,76,0.9)",
                clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
              }}
            >
              {readyWeapons}/{weaponOrder.length} armed
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {weaponOrder.map((t) => {
              const cost = WEAPON_COSTS[t];
              const lbl = WEAPON_LABELS[t];
              const sel = state.selectedWeapon === t;
              const needs = t === "TRANSPORT_POD" ? hasMechBay : t === "EMP" ? hasEmp : hasLauncher;
              const ok = canAfford(cost.funds, cost.energy) && needs;
              const icon =
                t === "AA" ? <Crosshair className="h-3 w-3" /> :
                t === "EMP" ? <Zap className="h-3 w-3" /> :
                t === "TUNNEL_BUSTER" ? <Skull className="h-3 w-3" /> :
                <Rocket className="h-3 w-3" />;

              return (
                <BuildButton
                  key={t}
                  selected={sel}
                  affordable={ok}
                  onClick={() => selectWeapon(sel ? null : t)}
                  title={lbl.desc + (needs ? "" : " (Requires launcher)")}
                  hotkey={lbl.hotkey}
                  icon={icon}
                  name={lbl.name}
                  costLabel={`$${cost.funds} · ${cost.energy}E`}
                  accentColor={sel ? "var(--hud-player)" : "rgba(240,76,76,0.75)"}
                  selectionColor="var(--hud-player)"
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div
        className="hidden justify-between border-t px-2 pb-1 pt-1 text-[8px] uppercase tracking-widest md:flex"
        style={{ borderColor: "var(--hud-line)", color: "rgba(100,116,139,0.5)" }}
      >
        <span>Left island → BUILD · Right island → FIRE · ESC / Right-click → cancel</span>
        <span>1–0 build · Q–\ weapons · V layer · SPACE pause</span>
      </div>
    </div>
  );
}

function BuildButton({
  selected, affordable, onClick, title, hotkey, icon, name, costLabel, accentColor, selectionColor,
}: {
  selected: boolean; affordable: boolean; onClick: () => void; title: string;
  hotkey: string; icon: ReactNode; name: string; costLabel: string;
  accentColor: string; selectionColor: string;
}) {
  const borderColor = selected
    ? selectionColor
    : affordable
    ? "rgba(100,116,139,0.3)"
    : "rgba(30,41,59,0.5)";

  const bgColor = selected
    ? `${selectionColor}18`
    : affordable
    ? "rgba(5,9,19,0.7)"
    : "rgba(2,6,14,0.85)";

  const boxShadow = selected
    ? `0 0 14px ${selectionColor}40, inset 0 1px 0 rgba(255,255,255,0.06)`
    : "inset 0 1px 0 rgba(255,255,255,0.04)";

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "relative min-h-[54px] overflow-hidden p-1.5 text-left transition-all duration-150",
        !affordable && !selected && "grayscale opacity-45"
      )}
      style={{
        border: `1px solid ${borderColor}`,
        background: bgColor,
        boxShadow,
        clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
      }}
    >
      {/* Hotkey badge */}
      <div
        className="absolute right-1 top-1 px-1 text-[7px] font-black"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.5)",
          color: "rgba(203,213,225,0.8)",
        }}
      >
        {hotkey}
      </div>

      {/* Icon cell */}
      <div
        className="mb-1 grid h-5 w-6 place-items-center"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: selected ? `${selectionColor}22` : "rgba(0,0,0,0.35)",
          color: accentColor,
        }}
      >
        {icon}
      </div>

      {/* Name */}
      <div
        className="truncate text-[8px] font-bold uppercase leading-tight"
        style={{ color: selected ? selectionColor : "rgba(203,213,225,0.85)" }}
      >
        {name}
      </div>

      {/* Cost */}
      <div className="mt-0.5 text-[7px]" style={{ color: "rgba(246,196,83,0.8)" }}>
        {costLabel}
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 h-px transition-all duration-150"
        style={{
          width: selected ? "100%" : affordable ? "60%" : "20%",
          background: accentColor,
          opacity: selected ? 0.9 : 0.4,
          boxShadow: selected ? `0 0 6px ${accentColor}` : "none",
        }}
      />
    </button>
  );
}
