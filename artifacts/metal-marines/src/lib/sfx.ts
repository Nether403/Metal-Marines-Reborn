const audioCtx: AudioContext | null =
  typeof window !== "undefined" && "AudioContext" in window
    ? new AudioContext()
    : null;

let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};

const beep = (freq: number, duration: number, type: OscillatorType = "sine", gain = 0.05) => {
  if (!audioCtx || muted) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
};

export const sfx = (name: string) => {
  switch (name) {
    case "place_building":
      beep(660, 0.08, "square", 0.04);
      break;
    case "launch":
      beep(220, 0.15, "sawtooth", 0.05);
      setTimeout(() => beep(180, 0.18, "sawtooth", 0.04), 60);
      break;
    case "explosion":
      beep(90, 0.35, "square", 0.08);
      setTimeout(() => beep(60, 0.3, "sawtooth", 0.06), 40);
      break;
    case "alert":
      beep(880, 0.1, "square", 0.05);
      setTimeout(() => beep(880, 0.1, "square", 0.05), 160);
      break;
    case "land":
      beep(140, 0.25, "square", 0.07);
      break;
    case "victory":
      beep(523, 0.18, "triangle", 0.07);
      setTimeout(() => beep(659, 0.18, "triangle", 0.07), 160);
      setTimeout(() => beep(784, 0.32, "triangle", 0.07), 320);
      break;
    case "defeat":
      beep(220, 0.4, "sawtooth", 0.07);
      setTimeout(() => beep(160, 0.6, "sawtooth", 0.06), 320);
      break;
    case "intercept":
      beep(1200, 0.06, "square", 0.04);
      break;
    case "click":
      beep(440, 0.04, "square", 0.03);
      break;
  }
};
