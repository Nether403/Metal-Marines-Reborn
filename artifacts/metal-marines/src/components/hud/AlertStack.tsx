import type { RuntimeState } from "@/game/types";
import { AlertTriangle } from "lucide-react";

export default function AlertStack({ state }: { state: RuntimeState }) {
  if (state.alerts.length === 0) return null;
  return (
    <div className="absolute top-16 right-4 flex flex-col gap-1.5 pointer-events-none z-20 font-mono">
      {state.alerts.slice(-4).map((a) => (
        <div
          key={a.id}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs uppercase tracking-wider animate-in fade-in slide-in-from-right ${
            a.level === "crit"
              ? "bg-destructive/30 border-destructive text-destructive shadow-[0_0_12px_rgba(239,68,68,0.6)]"
              : a.level === "warn"
              ? "bg-yellow-500/20 border-yellow-500/70 text-yellow-200"
              : "bg-primary/15 border-primary/50 text-primary"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-bold">{a.text}</span>
        </div>
      ))}
    </div>
  );
}
