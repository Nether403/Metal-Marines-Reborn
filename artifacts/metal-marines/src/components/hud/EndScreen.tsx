import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { RuntimeState, MissionDef, CommanderProfile, ReplayCommand } from "@/game/types";
import { useGame } from "@/game/store";
import { COMMANDERS } from "@/data/commanders";
import { MISSIONS } from "@/data/missions";
import { createReplaySnapshot, formatReplayCommandLine } from "@/game/replay";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [logOpen, setLogOpen] = useState(false);

  if (win) markCleared(mission.id);

  const nextMission = MISSIONS[mission.index] ?? null;
  const commands = state.replay.commands;

  const exportReplay = () => {
    const snapshot = createReplaySnapshot(
      state,
      state.replay.commands,
      state.replay.hashes,
      state.replay.tickDt
    );
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `mm-replay-${mission.id}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center font-mono p-4">
      <div className="max-w-xl w-full border border-primary/40 bg-card/80 p-8 rounded shadow-[0_0_30px_rgba(34,197,94,0.25)] max-h-[min(92vh,880px)] overflow-y-auto">
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
          <Stat label="Replay Frames" v={state.replay.frame} />
          <Stat label="Replay Commands" v={commands.length} />
        </div>

        <CommandLogPanel commands={commands} open={logOpen} onOpenChange={setLogOpen} />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="font-mono border-primary/40"
            onClick={() => restart(mission.id)}
          >
            REPLAY
          </Button>
          <Button
            variant="outline"
            className="font-mono border-primary/40"
            onClick={exportReplay}
            title="Download command log + frame hashes as JSON (fixed tickDt — offline hash-verify ready)"
          >
            EXPORT REPLAY JSON
          </Button>
          {win && nextMission && (
            <Button
              className="font-mono bg-primary text-primary-foreground"
              onClick={() => restart(nextMission.id)}
            >
              NEXT: {nextMission.title}
            </Button>
          )}
          <Link href="/campaign">
            <Button variant="outline" className="font-mono border-primary/40" onClick={() => end()}>
              THEATER COMMAND
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

function CommandLogPanel({
  commands,
  open,
  onOpenChange,
}: {
  commands: ReplayCommand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mb-6">
      <div className="flex items-center justify-between gap-2 border border-primary/20 bg-black/40 px-3 py-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Command Log
        </span>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-mono text-xs h-7 px-2 text-primary hover:text-primary"
          >
            {open ? "HIDE" : "SHOW"} ({commands.length})
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div
          className="mt-0 max-h-48 overflow-y-auto border border-t-0 border-primary/20 bg-black/60 px-3 py-2 text-[11px] leading-relaxed text-foreground/90"
          role="log"
          aria-label="Replay command log"
        >
          {commands.length === 0 ? (
            <div className="text-muted-foreground italic">No player commands recorded.</div>
          ) : (
            <ul className="space-y-0.5 font-mono">
              {commands.map((c, i) => (
                <li key={`${c.frame}-${c.type}-${i}`} className="whitespace-nowrap">
                  {formatReplayCommandLine(c)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
