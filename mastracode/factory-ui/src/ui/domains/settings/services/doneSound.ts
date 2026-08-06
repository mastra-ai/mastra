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

export function loadDoneSound(): DoneSound {
  try {
    const stored = localStorage.getItem(DONE_SOUND_KEY);
    if (DONE_SOUND_OPTIONS.some(option => option.value === stored)) return stored as DoneSound;
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

/** Short synthesized motifs per sound; frequencies are standard note pitches. */
const SOUND_NOTES: Record<Exclude<DoneSound, 'none'>, Note[]> = {
  // Gentle two-note "ding" (A5 → E6).
  chime: [note(880, 0, 0.2, 'sine'), note(1318.51, 0.1, 0.3, 'sine')],
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

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  return context;
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
    for (const { frequency, offset, duration, type, peak } of SOUND_NOTES[sound]) {
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
  } catch {
    // Sound is optional; audio failures must never surface in the UI.
  }
}
