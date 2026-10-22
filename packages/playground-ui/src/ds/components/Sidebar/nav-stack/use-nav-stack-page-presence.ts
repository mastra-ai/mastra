import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a nav stack page mounted while it is active and while its exit transition runs, then
 * unmounts it, so inactive pages never sit in the layout. `animateIn` turns on once the page is
 * activated after the first render: the page shown on load appears without fading in.
 */
export function useNavStackPagePresence(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(active);
  const [animateIn, setAnimateIn] = useState(false);
  const [prevActive, setPrevActive] = useState(active);

  if (active !== prevActive) {
    setPrevActive(active);
    if (active) {
      setPresent(true);
      setAnimateIn(true);
    }
  }

  useEffect(() => {
    if (active || !present) return;

    // Waits only for the page's own transitions, so an endless animation passed in `className`
    // can't hold it mounted. Resolves at once when nothing transitions (reduced motion, jsdom).
    // A cancelled transition settles too; one reversed by re-activating the page is ignored
    // because the cleanup has already cancelled the unmount.
    let cancelled = false;
    const transitions = (ref.current?.getAnimations?.() ?? []).filter(animation => 'transitionProperty' in animation);
    void Promise.allSettled(transitions.map(animation => animation.finished)).then(() => {
      if (!cancelled) setPresent(false);
    });

    return () => {
      cancelled = true;
    };
  }, [active, present]);

  return { ref, present, animateIn };
}
