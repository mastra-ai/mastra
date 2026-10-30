import { useState, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach(notify => notify()), 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

function formatElapsed(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** "0:07" counting up from `since` (or from mount while the run has no start time yet). */
export function ElapsedTime({ since }: { since?: string }) {
  const [mountedAt] = useState(nowInSeconds);
  const now = useSyncExternalStore(subscribe, nowInSeconds);
  const start = since ? Math.floor(new Date(since).getTime() / 1000) : mountedAt;
  return <time className="tabular-nums">{formatElapsed(now - start)}</time>;
}
