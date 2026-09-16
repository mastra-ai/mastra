/**
 * Completion-sound preference + playback.
 *
 * Played when an agent run finishes in a workspace. Every sound is
 * synthesized with the Web Audio API so there's no audio asset to ship.
 * Environments without an AudioContext (tests, older browsers) or with
 * autoplay restrictions simply stay silent — the solid done-dot in the
 * sidebar is the reliable signal, the sound is a nicety on top.
 */

export type DoneSound = 'none' | 'chime' | 'arcade' | 'fanfare';

export const DONE_SOUND_OPTIONS: { value: DoneSound; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'chime', label: 'Chime' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'fanfare', label: 'Fanfare' },
];

const DONE_SOUND_KEY = 'mastracode.doneSound';
const DEFAULT_DONE_SOUND: DoneSound = 'chime';

function isDoneSound(value: unknown): value is DoneSound {
  return DONE_SOUND_OPTIONS.some(option => option.value === value);
}

export function loadDoneSound(): DoneSound {
  try {
    const stored = localStorage.getItem(DONE_SOUND_KEY);
    if (isDoneSound(stored)) return stored;
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_DONE_SOUND;
}

export function saveDoneSound(sound: DoneSound): void {
  try {
    localStorage.setItem(DONE_SOUND_KEY, sound);
  } catch {
    /* non-fatal */
  }
}

/** Calibrated against each other: `tail.wet` only lands right because the impulse is peak-normalized and the convolver's own normalization is off. */
const CHIME = {
  voices: [
    { frequency: 320, peak: 0.5, offset: 0, attack: 0.145, decay: 0.35 },
    { frequency: 427.65, peak: 0.48, offset: 0.1, attack: 0.145, decay: 0.35 },
    { frequency: 80, peak: 0.48, offset: 0, attack: 0.03, decay: 0.105 },
  ],
  drive: 1.6,
  master: 0.6,
  tail: { seconds: 2.2, decay: 3.2, lowpass: 2600, wet: 0.00195, seed: 0x6d61737 },
} as const;

interface Note {
  frequency: number;
  offset: number;
  duration: number;
  type: OscillatorType;
  peak: number;
}

const note = (frequency: number, offset: number, duration: number, type: OscillatorType, peak = 0.06): Note => ({
  frequency,
  offset,
  duration,
  type,
  peak,
});

/** Short synthesized motifs; frequencies are standard note pitches. */
const SOUND_NOTES: Record<Exclude<DoneSound, 'none' | 'chime'>, Note[]> = {
  // Coin-pickup blip (B5 → E6, square wave — quieter, square carries more energy).
  arcade: [note(987.77, 0, 0.08, 'square', 0.035), note(1318.51, 0.08, 0.25, 'square', 0.035)],
  // Rising triad fanfare (C5 → E5 → G5 → C6).
  fanfare: [
    note(523.25, 0, 0.12, 'triangle'),
    note(659.25, 0.1, 0.12, 'triangle'),
    note(783.99, 0.2, 0.12, 'triangle'),
    note(1046.5, 0.3, 0.35, 'triangle'),
  ],
};

function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048);
  const limit = Math.tanh(drive);
  for (let i = 0; i < curve.length; i += 1) {
    curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * drive) / limit;
  }
  return curve;
}

const SATURATION_CURVE = saturationCurve(CHIME.drive);

function seededNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x80000000 - 1;
  };
}

let context: AudioContext | null = null;
let tailSend: AudioNode | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  return context;
}

function buildTailImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * CHIME.tail.seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    const noise = seededNoise(CHIME.tail.seed + channel);
    for (let i = 0; i < length; i += 1) {
      samples[i] = noise() * (1 - i / length) ** CHIME.tail.decay;
      peak = Math.max(peak, Math.abs(samples[i]));
    }
  }
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) samples[i] /= peak;
  }

  return buffer;
}

function getTailSend(ctx: AudioContext): AudioNode {
  if (tailSend) return tailSend;

  const send = ctx.createBiquadFilter();
  send.type = 'lowpass';
  send.frequency.value = CHIME.tail.lowpass;

  const convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.buffer = buildTailImpulse(ctx);

  const wet = ctx.createGain();
  wet.gain.value = CHIME.tail.wet;

  send.connect(convolver);
  convolver.connect(wet);
  wet.connect(ctx.destination);

  tailSend = send;
  return send;
}

function playChime(ctx: AudioContext): void {
  const saturation = ctx.createWaveShaper();
  saturation.curve = SATURATION_CURVE;
  saturation.oversample = '4x';

  const master = ctx.createGain();
  master.gain.value = CHIME.master;

  saturation.connect(master);
  master.connect(ctx.destination);
  master.connect(getTailSend(ctx));

  for (const { frequency, peak, offset, attack, decay } of CHIME.voices) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    oscillator.connect(gain);
    gain.connect(saturation);
    oscillator.start(start);
    oscillator.stop(start + attack + decay);
  }
}

function playNotes(ctx: AudioContext, notes: Note[]): void {
  for (const { frequency, offset, duration, type, peak } of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}

/**
 * Plays the given sound, or the user's saved preference when omitted.
 * Never throws.
 */
export function playDoneSound(sound: DoneSound = loadDoneSound()): void {
  try {
    if (sound === 'none') return;
    const ctx = getContext();
    if (!ctx) return;
    // Autoplay policies leave contexts suspended until a user gesture; the
    // sidebar only exists after interaction, so resuming usually succeeds.
    if (ctx.state === 'suspended') void ctx.resume();
    if (sound === 'chime') playChime(ctx);
    else playNotes(ctx, SOUND_NOTES[sound]);
  } catch {
    // Sound is optional; audio failures must never surface in the UI.
  }
}
