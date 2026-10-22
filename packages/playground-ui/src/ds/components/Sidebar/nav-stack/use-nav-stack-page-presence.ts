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

    // Resolves at once when nothing animates (reduced motion, jsdom). A transition reversed by
    // re-activating the page rejects `finished`, and the cleanup has already cancelled the unmount.
    let cancelled = false;
    const transitions = ref.current?.getAnimations?.() ?? [];
    Promise.all(transitions.map(animation => animation.finished)).then(
      () => {
        if (!cancelled) setPresent(false);
      },
      () => {},
    );

    return () => {
      cancelled = true;
    };
  }, [active, present]);

  return { ref, present, animateIn };
}
