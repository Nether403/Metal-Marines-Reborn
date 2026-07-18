import { BUILDINGS, MAX_AIRCRAFT_PER_SIDE, MAX_VEHICLES_PER_SIDE, WEAPON_COSTS, WEAPON_LABELS } from "@/game/constants";
import { formatCostPressure, getBuildingCost } from "@/game/economy";
import type { BuildingType, FactoryDoctrine, GunshipStrikePriority, ProjectileType, RuntimeState } from "@/game/types";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { Crosshair, Hammer, LayoutGrid, Radio, Rocket, Shield, Skull, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const buildOrder: BuildingType[] = [
  "HQ",
  "ENERGY_PLANT",
  "SUPPLY_DEPOT",
  "FACTORY",
  "RADAR",
  "RADAR_JAMMER",
  "DUMMY_BASE",
  "DUMMY_COVER",
  "TUNNEL_ENTRANCE",
  "SEISMIC_SENSOR",
  "TERRAIN_DESTABILIZER",
  "WEATHER_CONTROL",
  "BIOSPHERE_ENGINE",
  "MISSILE_LAUNCHER",
  "ICBM_SILO",
  "EMP_CANNON",
  "METAL_MARINE_BASE",
  "AA_GUN",
  "GUN_TURRET",
  "GUN_POD",
  "LAND_MINE",
];

const weaponOrder: ProjectileType[] = ["ICBM", "DUMMY", "AA", "TRANSPORT_POD", "EMP", "TUNNEL_BUSTER"];

const buildCategory: Record<BuildingType, "BASE" | "INTEL" | "WEAPONS" | "ECOLOGY"> = {
  HQ: "BASE",
  ENERGY_PLANT: "BASE",
  SUPPLY_DEPOT: "BASE",
  FACTORY: "BASE",
  DUMMY_BASE: "BASE",
  DUMMY_COVER: "BASE",
  RADAR: "INTEL",
  RADAR_JAMMER: "INTEL",
  TUNNEL_ENTRANCE: "INTEL",
  SEISMIC_SENSOR: "INTEL",
  TERRAIN_DESTABILIZER: "ECOLOGY",
  WEATHER_CONTROL: "ECOLOGY",
  BIOSPHERE_ENGINE: "ECOLOGY",
  MISSILE_LAUNCHER: "WEAPONS",
  ICBM_SILO: "WEAPONS",
  EMP_CANNON: "WEAPONS",
  METAL_MARINE_BASE: "WEAPONS",
  AA_GUN: "WEAPONS",
  GUN_TURRET: "WEAPONS",
  GUN_POD: "WEAPONS",
  LAND_MINE: "WEAPONS",
};

type Category = "BASE" | "INTEL" | "WEAPONS" | "ECOLOGY";
type FilterTab = "ALL" | Category;

const categoryMeta: Record<Category, { label: string; color: string; glow: string; Icon: React.FC<{ className?: string }> }> = {
  BASE:    { label: "Base",    color: "rgba(55,216,255,0.8)",  glow: "rgba(55,216,255,0.2)",  Icon: Hammer },
  INTEL:   { label: "Intel",  color: "rgba(168,85,247,0.8)",  glow: "rgba(168,85,247,0.2)",  Icon: Radio  },
  WEAPONS: { label: "Weapons",color: "rgba(240,76,76,0.85)",  glow: "rgba(240,76,76,0.2)",   Icon: Shield },
  ECOLOGY: { label: "Eco",    color: "rgba(132,204,22,0.8)",  glow: "rgba(132,204,22,0.15)", Icon: Zap    },
};

const filterTabs: { id: FilterTab; label: string; color: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "ALL", label: "All", color: "rgba(148,163,184,0.85)", Icon: LayoutGrid },
  { id: "BASE", label: "Base", color: categoryMeta.BASE.color, Icon: categoryMeta.BASE.Icon },
  { id: "INTEL", label: "Intel", color: categoryMeta.INTEL.color, Icon: categoryMeta.INTEL.Icon },
  { id: "WEAPONS", label: "Weapons", color: categoryMeta.WEAPONS.color, Icon: categoryMeta.WEAPONS.Icon },
  { id: "ECOLOGY", label: "Eco", color: categoryMeta.ECOLOGY.color, Icon: categoryMeta.ECOLOGY.Icon },
];

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
  const selectMechWeapon = useGame((s) => s.selectMechWeapon);
  const selectMechTier = useGame((s) => s.selectMechTier);
  const setFactoryDoctrine = useGame((s) => s.setFactoryDoctrine);
  const setGunshipPriority = useGame((s) => s.setGunshipPriority);
  const [filter, setFilter] = useState<FilterTab>("BASE");

  // Hotkeys can select a building outside the active tab — follow the selection.
  useEffect(() => {
    if (!state.selectedBuild) return;
    const cat = buildCategory[state.selectedBuild];
    setFilter((prev) => (prev === "ALL" || prev === cat ? prev : cat));
  }, [state.selectedBuild]);

  const canAfford = (f: number, e: number) => state.playerFunds >= f && state.playerEnergy >= e;
  const hasLauncher = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "MISSILE_LAUNCHER" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const hasIcbmSilo = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "ICBM_SILO" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const hasMechBay = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "METAL_MARINE_BASE" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const hasEmp = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "EMP_CANNON" && b.hp > 0 && b.buildTimeRemaining <= 0 && (b.disabledUntil ?? 0) <= state.elapsed
  );
  const hasFactory = state.buildings.some(
    (b) => b.side === "PLAYER" && b.type === "FACTORY" && b.hp > 0 && b.buildTimeRemaining <= 0
  );
  const playerApcCount = state.vehicles.filter((v) => v.owner === "PLAYER" && v.hp > 0).length;
  const playerGunshipCount = state.aircraft.filter((a) => a.owner === "PLAYER" && a.hp > 0).length;

  const factoryDoctrines: { id: FactoryDoctrine; label: string; title: string }[] = [
    { id: "AUTO", label: "Auto", title: "Balanced: garrison APCs first, then gunship assault" },
    { id: "APC", label: "APC", title: "Prefer garrison APCs only (no gunships)" },
    { id: "GUNSHIP", label: "Gunship", title: "Prefer gunship assault; APCs only vs invaders" },
    { id: "HOLD", label: "Hold", title: "Halt Factory unit production" },
  ];

  const gunshipPriorities: { id: GunshipStrikePriority; label: string; title: string }[] = [
    { id: "AUTO", label: "Auto", title: "Gunships prefer HQ, then AA, then nearest" },
    { id: "HQ", label: "HQ", title: "Prioritize enemy Headquarters" },
    { id: "AA", label: "AA", title: "Prioritize enemy AA Batteries" },
    { id: "ENERGY", label: "Energy", title: "Prioritize enemy Energy Plants" },
    { id: "MISSILE", label: "Missile", title: "Prioritize Missile / ICBM Silos" },
  ];

  const readyWeapons = weaponOrder.filter((t) => {
    if (t === "TRANSPORT_POD") return hasMechBay;
    if (t === "EMP") return hasEmp;
    if (t === "ICBM") return hasIcbmSilo;
    return hasLauncher;
  }).length;

  const categoryCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      ALL: buildOrder.length,
      BASE: 0,
      INTEL: 0,
      WEAPONS: 0,
      ECOLOGY: 0,
    };
    for (const t of buildOrder) counts[buildCategory[t]] += 1;
    return counts;
  }, []);

  const visibleBuilds = useMemo(
    () => (filter === "ALL" ? buildOrder : buildOrder.filter((t) => buildCategory[t] === filter)),
    [filter]
  );

  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return (
    <div
      className="mm-panel shrink-0 border-x-0 border-b-0 font-mono"
      style={{ background: "linear-gradient(180deg,rgba(11,20,32,0.98),rgba(5,9,19,0.97))" }}
    >
      {/* Top separator */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(55,216,255,0.22) 50%,transparent)" }} />

      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1.7fr_1fr]">

        {/* ── BUILD CONTROL ── */}
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(55,216,255,0.65)" }}>BUILD CONTROL</div>
              <div className="text-[11px] font-black tracking-[0.06em]" style={{ color: "rgba(226,232,240,0.9)" }}>
                {filter === "ALL" ? "ALL SYSTEMS" : `${categoryMeta[filter].label.toUpperCase()} SYSTEMS`}
              </div>
            </div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(100,116,139,0.65)" }}>
              {visibleBuilds.length}/{buildOrder.length} shown
            </div>
          </div>

          {/* Category filter tabs — always visible (not lg-only legend) */}
          <div
            className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Build categories"
          >
            {filterTabs.map((tab) => {
              const active = filter === tab.id;
              const count = categoryCounts[tab.id];
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className="flex shrink-0 items-center gap-1 px-2 py-1 text-[8px] uppercase tracking-wider transition-colors"
                  style={{
                    border: `1px solid ${active ? tab.color : `${tab.color}40`}`,
                    background: active ? `${tab.color}22` : `${tab.color}0a`,
                    color: active ? tab.color : "rgba(148,163,184,0.85)",
                    boxShadow: active ? `0 0 10px ${tab.color}28` : "none",
                    clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                  }}
                >
                  <Icon className="h-2.5 w-2.5" />
                  <span>{tab.label}</span>
                  <span
                    className="ml-0.5 min-w-[1rem] text-center text-[7px] font-black"
                    style={{ color: active ? tab.color : "rgba(100,116,139,0.8)" }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scrollable chip grid — caps height on short viewports */}
          <div
            className="max-h-[min(28vh,168px)] overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-color:rgba(55,216,255,0.35)_transparent] [scrollbar-width:thin]"
            role="tabpanel"
          >
            <div
              className={cn(
                "grid gap-1",
                filter === "ALL"
                  ? "grid-cols-4 sm:grid-cols-5 xl:grid-cols-7"
                  : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
              )}
            >
              {visibleBuilds.map((t) => {
                const spec = BUILDINGS[t];
                const cost = getBuildingCost(state.buildings, "PLAYER", t);
                const sel = state.selectedBuild === t;
                const ok = canAfford(cost.funds, cost.energy);
                const cat = buildCategory[t];
                const meta = categoryMeta[cat];
                const Icon = meta.Icon;
                const iconSrc = `${baseUrl}game-assets/icons/${t}.png`;

                return (
                  <BuildButton
                    key={t}
                    selected={sel}
                    affordable={ok}
                    onClick={() => selectBuild(sel ? null : t)}
                    title={formatCostPressure(state.buildings, "PLAYER", t)}
                    hotkey={spec.hotkey}
                    iconSrc={iconSrc}
                    fallbackIcon={<Icon className="h-3 w-3" />}
                    name={shortName(spec.name)}
                    costLabel={`$${cost.funds}${cost.energy ? ` · ${cost.energy}E` : ""}`}
                    accentColor={sel ? "var(--hud-energy)" : meta.color}
                    selectionColor="var(--hud-energy)"
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── STRIKE CONTROL ── */}
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(240,76,76,0.7)" }}>STRIKE DOCTRINES</div>
              <div className="text-[11px] font-black tracking-[0.06em]" style={{ color: "rgba(240,76,76,0.9)" }}>LAUNCH CONTROL</div>
            </div>
            <div
              className="shrink-0 px-2 py-0.5 text-[9px] uppercase tracking-widest"
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

          <div className="max-h-[min(28vh,168px)] overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-color:rgba(240,76,76,0.35)_transparent] [scrollbar-width:thin]">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {weaponOrder.map((t) => {
                const cost = WEAPON_COSTS[t];
                const lbl = WEAPON_LABELS[t];
                const sel = state.selectedWeapon === t;
                const needs =
                  t === "TRANSPORT_POD" ? hasMechBay :
                  t === "EMP" ? hasEmp :
                  t === "ICBM" ? hasIcbmSilo :
                  hasLauncher;
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
                    title={lbl.desc + (needs ? "" : " (Requires launcher/silo)")}
                    hotkey={lbl.hotkey}
                    fallbackIcon={icon}
                    name={lbl.name}
                    costLabel={`$${cost.funds} · ${cost.energy}E`}
                    accentColor={sel ? "var(--hud-player)" : "rgba(240,76,76,0.75)"}
                    selectionColor="var(--hud-player)"
                  />
                );
              })}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1">
              {(["GUNNER_I", "GUNNER_II"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => selectMechTier(tier)}
                  className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
                  style={{
                    border: `1px solid ${state.selectedMechTier === tier ? "rgba(239,68,68,0.8)" : "rgba(148,163,184,0.3)"}`,
                    background: state.selectedMechTier === tier ? "rgba(239,68,68,0.2)" : "rgba(15,23,42,0.6)",
                    color: state.selectedMechTier === tier ? "#fecaca" : "#94a3b8",
                  }}
                  title={tier === "GUNNER_II" ? "Upgraded Marine (+HP/dmg, premium drop cost)" : "Standard Gunner-I"}
                >
                  {tier === "GUNNER_I" ? "Gunner I" : "Gunner II"}
                </button>
              ))}
              {(["NORMAL", "ANTI_MMR", "ANTI_POD"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => selectMechWeapon(mode)}
                  className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
                  style={{
                    border: `1px solid ${state.selectedMechWeapon === mode ? "rgba(55,216,255,0.8)" : "rgba(148,163,184,0.3)"}`,
                    background: state.selectedMechWeapon === mode ? "rgba(55,216,255,0.15)" : "rgba(15,23,42,0.6)",
                    color: state.selectedMechWeapon === mode ? "#7dd3fc" : "#94a3b8",
                  }}
                  title={
                    mode === "NORMAL" ? "Balanced vs Marines and Gun Pods" :
                    mode === "ANTI_MMR" ? "+50% vs enemy Marines, -50% vs Gun Pods" :
                    "+50% vs Gun Pods, -50% vs Marines"
                  }
                >
                  {mode === "ANTI_MMR" ? "Anti-MMR" : mode === "ANTI_POD" ? "Anti-POD" : "Normal"}
                </button>
              ))}
            </div>

            {hasFactory && (
              <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="px-1 text-[8px] uppercase tracking-wider"
                    style={{ color: "rgba(251,191,36,0.75)" }}
                    title="Factory unit production"
                  >
                    Factory {playerApcCount}/{MAX_VEHICLES_PER_SIDE} APC · {playerGunshipCount}/{MAX_AIRCRAFT_PER_SIDE} GS
                  </span>
                  {factoryDoctrines.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setFactoryDoctrine(d.id)}
                      className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
                      style={{
                        border: `1px solid ${state.playerFactoryDoctrine === d.id ? "rgba(251,191,36,0.85)" : "rgba(148,163,184,0.3)"}`,
                        background: state.playerFactoryDoctrine === d.id ? "rgba(251,191,36,0.18)" : "rgba(15,23,42,0.6)",
                        color: state.playerFactoryDoctrine === d.id ? "#fde68a" : "#94a3b8",
                      }}
                      title={d.title}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="px-1 text-[8px] uppercase tracking-wider"
                    style={{ color: "rgba(125,211,252,0.75)" }}
                    title="Gunship strike priority"
                  >
                    Strike
                  </span>
                  {gunshipPriorities.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setGunshipPriority(p.id)}
                      className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
                      style={{
                        border: `1px solid ${state.playerGunshipPriority === p.id ? "rgba(56,189,248,0.85)" : "rgba(148,163,184,0.3)"}`,
                        background: state.playerGunshipPriority === p.id ? "rgba(14,165,233,0.18)" : "rgba(15,23,42,0.6)",
                        color: state.playerGunshipPriority === p.id ? "#7dd3fc" : "#94a3b8",
                      }}
                      title={p.title}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div
        className="hidden justify-between border-t px-2 pb-1 pt-1 text-[8px] uppercase tracking-widest md:flex"
        style={{ borderColor: "var(--hud-line)", color: "rgba(100,116,139,0.5)" }}
      >
        <span>Tabs filter builds · Left island → BUILD · Right island → FIRE · ESC / Right-click → cancel</span>
        <span>1–0 build · Q–\ weapons · V layer · SPACE pause</span>
      </div>
    </div>
  );
}

function BuildButton({
  selected, affordable, onClick, title, hotkey, iconSrc, fallbackIcon, name, costLabel, accentColor, selectionColor,
}: {
  selected: boolean; affordable: boolean; onClick: () => void; title: string;
  hotkey: string; iconSrc?: string; fallbackIcon?: ReactNode; name: string; costLabel: string;
  accentColor: string; selectionColor: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
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
        "relative min-h-[48px] overflow-hidden p-1 text-left transition-all duration-150 sm:min-h-[52px] sm:p-1.5",
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

      {/* Icon cell — atlas art with glyph fallback */}
      <div
        className="mb-0.5 grid h-5 w-6 place-items-center sm:mb-1 sm:h-6 sm:w-7"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: selected ? `${selectionColor}22` : "rgba(0,0,0,0.35)",
          color: accentColor,
        }}
      >
        {iconSrc && !imgFailed ? (
          <img
            src={iconSrc}
            alt=""
            className="h-4 w-4 object-contain sm:h-5 sm:w-5"
            onError={() => setImgFailed(true)}
          />
        ) : (
          fallbackIcon
        )}
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
