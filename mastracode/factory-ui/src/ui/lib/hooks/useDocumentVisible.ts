import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeToVisibility, () => document.visibilityState === 'visible');
}

/** How long a hidden tab keeps its live streams before releasing them. */
export const HIDDEN_STREAM_GRACE_MS = 30_000;

/**
 * True while the tab is visible or has been hidden for less than `graceMs`.
 * Gate long-lived streams on this so a quick tab switch keeps the stream (no
 * teardown, resubscribe and resync on return) while a tab left in the
 * background still releases its connection.
 */
export function useRecentlyVisible(graceMs = HIDDEN_STREAM_GRACE_MS): boolean {
  const visible = useDocumentVisible();
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    if (visible) return;
    const timeout = window.setTimeout(() => setGraceExpired(true), graceMs);
    return () => {
      window.clearTimeout(timeout);
      setGraceExpired(false);
    };
  }, [visible, graceMs]);

  return visible || !graceExpired;
}
