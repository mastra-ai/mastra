import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (progress: number) => (progress === 1 ? 1 : 1 - 2 ** (-10 * progress));

/** Animates a number from its previous value (0 on mount) to `target`. */
export function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const next = from + (target - from) * easeOutExpo(progress);
      fromRef.current = next;
      setValue(Math.round(next));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
