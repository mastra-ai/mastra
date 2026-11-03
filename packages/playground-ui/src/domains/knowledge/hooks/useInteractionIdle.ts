import { useCallback, useEffect, useRef, useState } from 'react';

/** Pure gate: idle once the last interaction is at least idleMs ago. */
export function isIdle(lastActivityAt: number, now: number, idleMs: number): boolean {
  return now - lastActivityAt >= idleMs;
}

/**
 * Tracks whether the user has left a surface alone for at least idleMs.
 * Wire `onActivity` to capture-phase pointer/wheel handlers on the surface;
 * `idle` flips false immediately on activity and back true after idleMs of
 * silence (checked on a 1s tick). Starts idle — a fresh page updates freely.
 */
export function useInteractionIdle(idleMs: number): { idle: boolean; onActivity: () => void } {
  const lastActivity = useRef(0);
  const [idle, setIdle] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setIdle(current => {
        const next = lastActivity.current === 0 || isIdle(lastActivity.current, Date.now(), idleMs);
        return next === current ? current : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [idleMs]);
  const onActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setIdle(false);
  }, []);
  return { idle, onActivity };
}
