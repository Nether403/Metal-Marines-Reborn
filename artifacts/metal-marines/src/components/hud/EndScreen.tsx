import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { RuntimeState, MissionDef, CommanderProfile } from "@/game/types";
import { useGame } from "@/game/store";
import { COMMANDERS } from "@/data/commanders";
import { MISSIONS } from "@/data/missions";

export default function EndScreen({
  state,
  mission,
}: {
  state: RuntimeState;
  mission: MissionDef;
}) {
  const restart = useGame((s) => s.startMission);
  const end = useGame((s) => s.endMission);
  const markCleared = useGame((s) => s.markCleared);
  const cmd: CommanderProfile = COMMANDERS[mission.commanderId];
  const win = state.status === "VICTORY";

  if (win) markCleared(mission.id);

  const nextMission = MISSIONS[mission.index] ?? null;

  return (
    <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center font-mono p-4">
      <div className="max-w-xl w-full border border-primary/40 bg-card/80 p-8 rounded shadow-[0_0_30px_rgba(34,197,94,0.25)]">
        <div
          className={`text-5xl font-black tracking-tighter mb-2 ${
            win ? "text-primary" : "text-destructive"
          } drop-shadow-[0_0_15px_currentColor]`}
        >
          {win ? "MISSION COMPLETE" : "MISSION FAILED"}
        </div>
        <div className="text-sm text-muted-foreground mb-6 uppercase tracking-widest">
          {mission.title} :: {cmd.name}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-6">
          <Stat label="Time" v={`${Math.floor(state.elapsed / 60)}m ${Math.floor(state.elapsed % 60)}s`} />
          <Stat label="Missiles Fired" v={state.stats.missilesFired} />
          <Stat label="Marines Dropped" v={state.stats.marinesDeployed} />
          <Stat label="Enemy Buildings Destroyed" v={state.stats.buildingsDestroyed} />
          <Stat label="Buildings Lost" v={state.stats.buildingsLost} />
          <Stat label="Result" v={win ? "VICTORY" : "DEFEAT"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="font-mono border-primary/40"
            onClick={() => restart(mission.id)}
          >
            REPLAY
          </Button>
          {win && nextMission && (
            <Button
              className="font-mono bg-primary text-primary-foreground"
              onClick={() => restart(nextMission.id)}
            >
              NEXT: {nextMission.title}
            </Button>
          )}
          <Link href="/missions">
            <Button variant="outline" className="font-mono border-primary/40" onClick={() => end()}>
              MISSION SELECT
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="font-mono" onClick={() => end()}>
              MAIN MENU
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string | number }) {
  return (
    <div className="border border-primary/20 px-3 py-2 bg-black/40 flex justify-between">
      <span className="text-muted-foreground text-xs uppercase">{label}</span>
      <span className="text-foreground font-bold">{v}</span>
    </div>
  );
}
