/** Layered synthesized SFX — API is stable for later sample hot-swap. */

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
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        audioCtx.currentTime + duration
      );
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

const noiseBurst = (duration: number, gain = 0.08, filterFreq = 800, type: BiquadFilterType = "lowpass") => {
  if (!audioCtx || muted) return;
  resume();
  try {
    const frames = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const env = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
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
      tone(520, 0.05, "triangle", 0.03);
      tone(780, 0.07, "square", 0.028);
      noiseBurst(0.05, 0.025, 1800, "bandpass");
      break;
    case "launch":
      noiseBurst(0.16, 0.06, 1400);
      tone(260, 0.28, "sawtooth", 0.055, 70);
      setTimeout(() => tone(180, 0.24, "sawtooth", 0.04, 55), 40);
      setTimeout(() => noiseBurst(0.1, 0.035, 900), 70);
      break;
    case "explosion":
      noiseBurst(0.42, 0.14, 700);
      tone(70, 0.48, "square", 0.08, 32);
      setTimeout(() => noiseBurst(0.28, 0.07, 280), 35);
      setTimeout(() => tone(55, 0.35, "sawtooth", 0.04, 28), 60);
      break;
    case "alert":
      tone(920, 0.09, "square", 0.055);
      setTimeout(() => tone(720, 0.09, "square", 0.05), 110);
      setTimeout(() => tone(920, 0.1, "square", 0.055), 230);
      break;
    case "land":
      noiseBurst(0.18, 0.08, 450);
      tone(160, 0.3, "square", 0.065, 70);
      setTimeout(() => noiseBurst(0.1, 0.04, 300), 50);
      break;
    case "victory":
      tone(523, 0.16, "triangle", 0.07);
      setTimeout(() => tone(659, 0.16, "triangle", 0.07), 140);
      setTimeout(() => tone(784, 0.2, "triangle", 0.07), 280);
      setTimeout(() => tone(1046, 0.35, "triangle", 0.06), 440);
      break;
    case "defeat":
      noiseBurst(0.45, 0.09, 220);
      tone(200, 0.5, "sawtooth", 0.07, 70);
      setTimeout(() => tone(120, 0.6, "sawtooth", 0.05, 40), 260);
      break;
    case "intercept":
      noiseBurst(0.07, 0.045, 2400, "highpass");
      tone(1400, 0.08, "square", 0.045, 500);
      setTimeout(() => tone(900, 0.05, "triangle", 0.03), 40);
      break;
    case "click":
      tone(480, 0.035, "square", 0.028);
      break;
    case "mech_step":
      noiseBurst(0.045, 0.035, 550);
      tone(85, 0.055, "square", 0.028);
      break;
  }
};
