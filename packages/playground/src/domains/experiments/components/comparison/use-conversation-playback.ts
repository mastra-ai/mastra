import { useEffect, useState, useSyncExternalStore } from 'react';

// Illustrative pacing only: saved experiment timings are not streaming timestamps.
const TURN_MS = 4000;
const REVEAL_END_MS = 3000;
const TICK_MS = 100;
const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const reducedMotionSnapshot = () => window.matchMedia(motionQuery).matches;

export function useConversationPlayback(turnCount: number) {
  const [clock, setClock] = useState({ position: 0, playing: false });
  const [speed, setSpeed] = useState(1);
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedMotionSnapshot, () => true);
  const end = turnCount * TURN_MS;
  const turnIndex = Math.min(turnCount - 1, Math.floor(clock.position / TURN_MS));
  const elapsed = clock.position - turnIndex * TURN_MS;
  const complete = clock.position >= end;
  const fraction = Math.min(1, Math.max(0, (elapsed - 500) / (REVEAL_END_MS - 500)));

  useEffect(() => {
    if (!clock.playing) return;
    const timer = window.setInterval(() => {
      setClock(current => {
        const position = Math.min(end, current.position + TICK_MS * speed);
        return { position, playing: position < end };
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [clock.playing, end, speed]);

  const seek = (index: number) =>
    setClock({
      position: Math.max(0, Math.min(turnCount - 1, index)) * TURN_MS + REVEAL_END_MS,
      playing: false,
    });

  return {
    turnIndex,
    fraction: reducedMotion && fraction > 0 ? 1 : fraction,
    playing: clock.playing,
    complete,
    speed,
    seek,
    toggle: () => setClock(current => ({ position: complete ? 0 : current.position, playing: !current.playing })),
    restart: () => setClock({ position: 0, playing: false }),
    changeSpeed: () => setSpeed(current => (current === 1 ? 2 : current === 2 ? 0.5 : 1)),
  };
}
