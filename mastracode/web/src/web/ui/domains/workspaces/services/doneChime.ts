/**
 * Best-effort completion chime for workspace agent runs.
 *
 * Synthesized with the Web Audio API so there's no audio asset to ship.
 * Environments without an AudioContext (tests, older browsers) or with
 * autoplay restrictions simply stay silent — the solid done-dot in the
 * sidebar is the reliable signal, the sound is a nicety on top.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  return context;
}

/** Plays a gentle two-note "ding" (A5 → E6). Never throws. */
export function playDoneChime(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    // Autoplay policies leave contexts suspended until a user gesture; the
    // sidebar only exists after interaction, so resuming usually succeeds.
    if (ctx.state === 'suspended') void ctx.resume();
    const note = (frequency: number, offset: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    };
    note(880, 0, 0.2);
    note(1318.51, 0.1, 0.3);
  } catch {
    // Sound is optional; audio failures must never surface in the sidebar.
  }
}
