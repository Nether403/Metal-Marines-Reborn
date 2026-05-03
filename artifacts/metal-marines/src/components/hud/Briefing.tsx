import type { MissionDef } from "@/game/types";
import { COMMANDERS } from "@/data/commanders";
import { Button } from "@/components/ui/button";

export default function Briefing({
  mission,
  onStart,
  onAbort,
}: {
  mission: MissionDef;
  onStart: () => void;
  onAbort: () => void;
}) {
  const cmd = COMMANDERS[mission.commanderId];
  return (
    <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center font-mono p-4">
      <div className="max-w-2xl w-full border border-primary/40 bg-card/90 p-6 rounded shadow-[0_0_30px_rgba(34,197,94,0.25)]">
        <div className="text-xs text-primary/70 uppercase tracking-widest mb-1">
          MISSION BRIEFING :: {String(mission.index).padStart(2, "0")}/06
        </div>
        <h2 className="text-3xl font-black text-primary tracking-tighter mb-1 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">
          {mission.title}
        </h2>
        <div className="text-xs text-destructive/80 uppercase mb-4">
          ENEMY COMMANDER :: {cmd.name}
        </div>
        <div className="flex gap-4 mb-5">
          <img
            src={cmd.imageUrl}
            alt={cmd.name}
            className="w-32 h-32 object-cover rounded border border-primary/30"
          />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-foreground/90 leading-relaxed">{cmd.bio}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{mission.briefing}</p>
          </div>
        </div>
        <div className="border border-primary/30 bg-black/40 p-3 mb-5">
          <div className="text-xs text-primary uppercase tracking-widest">Objective</div>
          <div className="text-foreground">{mission.objective}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" className="font-mono border-primary/40" onClick={onAbort}>
            ABORT
          </Button>
          <Button
            className="font-mono bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.5)]"
            onClick={onStart}
          >
            ENGAGE
          </Button>
        </div>
      </div>
    </div>
  );
}
