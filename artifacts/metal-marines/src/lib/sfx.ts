/** Richer synthesized SFX (noise bursts + layered tones) — hot-swappable later for real samples. */

const audioCtx: AudioContext | null =
  typeof window !== "undefined" && "AudioContext" in window
    ? new AudioContext()
    : null;

let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};

const resume = () => {
  if (audioCtx?.state === "suspended") void audioCtx.resume();
};

const tone = (
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.05,
  freqEnd?: number
) => {
  if (!audioCtx || muted) return;
  resume();
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), audioCtx.currentTime + duration);
    }
    g.gain.value = gain;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    /* ignore autoplay blocks */
  }
};

const noiseBurst = (duration: number, gain = 0.08, filterFreq = 800) => {
  if (!audioCtx || muted) return;
  resume();
  try {
    const frames = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = audioCtx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    src.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  } catch {
    /* ignore */
  }
};

export const sfx = (name: string) => {
  switch (name) {
    case "place_building":
      tone(660, 0.06, "square", 0.035);
      tone(990, 0.08, "triangle", 0.025);
      break;
    case "launch":
      noiseBurst(0.12, 0.05, 1200);
      tone(220, 0.22, "sawtooth", 0.05, 90);
      setTimeout(() => tone(160, 0.2, "sawtooth", 0.035, 70), 50);
      break;
    case "explosion":
      noiseBurst(0.35, 0.12, 600);
      tone(90, 0.4, "square", 0.07, 40);
      setTimeout(() => noiseBurst(0.25, 0.06, 300), 40);
      break;
    case "alert":
      tone(880, 0.1, "square", 0.05);
      setTimeout(() => tone(880, 0.1, "square", 0.05), 160);
      break;
    case "land":
      noiseBurst(0.15, 0.07, 400);
      tone(140, 0.28, "square", 0.06, 80);
      break;
    case "victory":
      tone(523, 0.18, "triangle", 0.07);
      setTimeout(() => tone(659, 0.18, "triangle", 0.07), 160);
      setTimeout(() => tone(784, 0.32, "triangle", 0.07), 320);
      break;
    case "defeat":
      noiseBurst(0.4, 0.08, 250);
      tone(220, 0.45, "sawtooth", 0.07, 80);
      setTimeout(() => tone(140, 0.55, "sawtooth", 0.05, 50), 280);
      break;
    case "intercept":
      noiseBurst(0.06, 0.04, 2000);
      tone(1200, 0.07, "square", 0.04, 600);
      break;
    case "click":
      tone(440, 0.04, "square", 0.03);
      break;
    case "mech_step":
      noiseBurst(0.04, 0.03, 500);
      tone(90, 0.05, "square", 0.025);
      break;
  }
};
