#!/usr/bin/env python3
"""Bake procedural combat SFX WAVs for hot-swap behind sfx().

Replace files under artifacts/metal-marines/public/game-assets/sfx/ with
recorded samples anytime — filenames stay launch.wav / explosion.wav / land.wav.
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "artifacts/metal-marines/public/game-assets/sfx"
SAMPLE_RATE = 22050


def _clamp(x: float) -> float:
    return max(-1.0, min(1.0, x))


def write_wav(path: Path, samples: list[float], rate: int = SAMPLE_RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        frames = b"".join(
            struct.pack("<h", int(_clamp(s) * 32767.0)) for s in samples
        )
        wf.writeframes(frames)


def noise(n: int, seed: int) -> list[float]:
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(n)]


def env_exp(i: int, n: int, power: float = 2.0) -> float:
    if n <= 1:
        return 0.0
    t = i / (n - 1)
    return (1.0 - t) ** power


def tone(n: int, freq0: float, freq1: float | None = None, phase0: float = 0.0) -> list[float]:
    out: list[float] = []
    phase = phase0
    for i in range(n):
        t = i / max(1, n - 1)
        freq = freq0 if freq1 is None else freq0 + (freq1 - freq0) * t
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        out.append(math.sin(phase))
    return out


def mix(*layers: list[float]) -> list[float]:
    length = max((len(l) for l in layers), default=0)
    out = [0.0] * length
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    peak = max((abs(v) for v in out), default=1.0) or 1.0
    gain = 0.92 / peak
    return [v * gain for v in out]


def pad(samples: list[float], n: int, value: float = 0.0) -> list[float]:
    if len(samples) >= n:
        return samples[:n]
    return samples + [value] * (n - len(samples))


def make_launch() -> list[float]:
    """Whoosh + descending saw growl — missile leave pad."""
    n = int(SAMPLE_RATE * 0.38)
    raw = noise(n, seed=11)
    whoosh = [
        raw[i] * env_exp(i, n, 1.4) * (0.35 + 0.65 * (i / n))
        for i in range(n)
    ]
    # Mild highpass feel: subtract running mean
    acc = 0.0
    filtered = []
    for v in whoosh:
        acc = acc * 0.92 + v * 0.08
        filtered.append(v - acc)

    growl_n = int(SAMPLE_RATE * 0.32)
    g0 = tone(growl_n, 260, 70)
    g1 = tone(growl_n, 180, 55, phase0=1.7)
    growl = [
        (0.55 * g0[i] + 0.35 * g1[i] + 0.15 * ((i * 17) % 7) / 7.0)
        * env_exp(i, growl_n, 1.8)
        for i in range(growl_n)
    ]
    tail = noise(int(SAMPLE_RATE * 0.12), seed=19)
    tail = [tail[i] * env_exp(i, len(tail), 2.2) * 0.35 for i in range(len(tail))]
    return mix(pad(filtered, n), pad(growl, n), pad([0.0] * 70 + tail, n))


def make_explosion() -> list[float]:
    """Low boom + crackle — building/missile detonation."""
    n = int(SAMPLE_RATE * 0.55)
    raw = noise(n, seed=42)
    body = [raw[i] * env_exp(i, n, 1.6) for i in range(n)]
    # Soft lowpass
    lp = []
    acc = 0.0
    for v in body:
        acc = acc * 0.85 + v * 0.15
        lp.append(acc)

    boom_n = int(SAMPLE_RATE * 0.48)
    boom = tone(boom_n, 70, 32)
    boom2 = tone(boom_n, 55, 28, phase0=2.1)
    boom_layer = [
        (0.7 * boom[i] + 0.45 * boom2[i]) * env_exp(i, boom_n, 1.3)
        for i in range(boom_n)
    ]

    crack_n = int(SAMPLE_RATE * 0.18)
    crack = noise(crack_n, seed=7)
    crack = [crack[i] * env_exp(i, crack_n, 3.0) * 0.55 for i in range(crack_n)]
    # Offset crack slightly
    delayed = [0.0] * int(SAMPLE_RATE * 0.035) + crack
    return mix(pad(lp, n), pad(boom_layer, n), pad(delayed, n))


def make_land() -> list[float]:
    """Thud + grit — mech drop pod impact."""
    n = int(SAMPLE_RATE * 0.34)
    raw = noise(n, seed=99)
    thud_noise = []
    acc = 0.0
    for i, v in enumerate(raw):
        acc = acc * 0.78 + v * 0.22
        thud_noise.append(acc * env_exp(i, n, 2.0))

    thud_n = int(SAMPLE_RATE * 0.28)
    thud = tone(thud_n, 160, 70)
    thud2 = tone(thud_n, 95, 40, phase0=0.9)
    thud_layer = [
        (0.65 * thud[i] + 0.4 * thud2[i]) * env_exp(i, thud_n, 1.7)
        for i in range(thud_n)
    ]
    grit_n = int(SAMPLE_RATE * 0.12)
    grit = noise(grit_n, seed=3)
    grit = [grit[i] * env_exp(i, grit_n, 2.5) * 0.4 for i in range(grit_n)]
    delayed = [0.0] * int(SAMPLE_RATE * 0.04) + grit
    return mix(pad(thud_noise, n), pad(thud_layer, n), pad(delayed, n))


def main() -> None:
    banks = {
        "launch.wav": make_launch(),
        "explosion.wav": make_explosion(),
        "land.wav": make_land(),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, samples in banks.items():
        path = OUT_DIR / name
        write_wav(path, samples)
        dur = len(samples) / SAMPLE_RATE
        print(f"wrote {path.relative_to(ROOT)} ({dur:.3f}s, {len(samples)} frames)")


if __name__ == "__main__":
    main()
