import { useCallback, useRef } from 'react';

export type SoundKind = 'move' | 'capture' | 'check' | 'end';

function createNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  now: number,
  duration: number,
  filterFreq: number,
  q: number,
  volume: number
) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / sampleCount) * 4.2);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, now);
  filter.Q.setValueAtTime(q, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start(now);
  src.stop(now + duration + 0.01);
}

function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
  duration: number,
  wave: OscillatorType,
  freqStart: number,
  freqEnd: number,
  peakGain: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(freqStart, startTime);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freqEnd),
      startTime + duration
    );
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.015);
}

export function useChessSound(enabled: boolean) {
  const audioRef = useRef<AudioContext | null>(null);
  const outputRef = useRef<GainNode | null>(null);

  const playSound = useCallback(
    (type: SoundKind) => {
      if (!enabled) return;

      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;

        if (!audioRef.current) {
          const ctx = new AC();
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.setValueAtTime(-14, ctx.currentTime);
          compressor.knee.setValueAtTime(10, ctx.currentTime);
          compressor.ratio.setValueAtTime(6, ctx.currentTime);
          compressor.attack.setValueAtTime(0.002, ctx.currentTime);
          compressor.release.setValueAtTime(0.12, ctx.currentTime);

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(1.85, ctx.currentTime);

          masterGain.connect(compressor);
          compressor.connect(ctx.destination);

          audioRef.current = ctx;
          outputRef.current = masterGain;
        }

        const ctx = audioRef.current;
        const dest = outputRef.current || ctx.destination;

        const synthesizeClassic = () => {
          const now = ctx.currentTime;

          // Loud, crisp single classic wooden chess-piece acoustics
          if (type === 'move') {
            createNoiseBurst(ctx, dest, now, 0.05, 820, 2.0, 0.58);
            playTone(ctx, dest, now, 0.085, 'triangle', 215, 84, 0.62);
            playTone(ctx, dest, now, 0.06, 'sine', 130, 68, 0.42);
          } else if (type === 'capture') {
            createNoiseBurst(ctx, dest, now, 0.065, 1250, 1.8, 0.78);
            playTone(ctx, dest, now, 0.105, 'triangle', 300, 92, 0.76);
            createNoiseBurst(ctx, dest, now + 0.032, 0.045, 980, 2.2, 0.48);
            playTone(ctx, dest, now + 0.03, 0.07, 'sine', 175, 72, 0.44);
          } else if (type === 'check') {
            createNoiseBurst(ctx, dest, now, 0.045, 1050, 1.9, 0.48);
            playTone(ctx, dest, now, 0.13, 'triangle', 493.88, 466.16, 0.55);
            playTone(ctx, dest, now + 0.08, 0.16, 'sine', 659.25, 622.25, 0.52);
          } else {
            playTone(ctx, dest, now, 0.18, 'triangle', 392, 392, 0.52);
            playTone(ctx, dest, now + 0.095, 0.2, 'triangle', 493.88, 493.88, 0.52);
            playTone(ctx, dest, now + 0.19, 0.28, 'sine', 587.33, 587.33, 0.56);
          }
        };

        if (ctx.state === 'suspended') {
          ctx.resume().then(synthesizeClassic).catch(() => {});
        } else {
          synthesizeClassic();
        }
      } catch {
        // Ignore audio playback errors
      }
    },
    [enabled]
  );

  return playSound;
}
