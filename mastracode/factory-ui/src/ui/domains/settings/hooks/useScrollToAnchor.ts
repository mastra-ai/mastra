import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/** Scrolls a section linked by URL hash into view once its content has loaded; the browser cannot, the section renders after navigation. */
export function useScrollToAnchor(anchor: string, ready: boolean) {
  const { hash, key } = useLocation();
  const scrolledForRef = useRef<string>(undefined);

  useEffect(() => {
    if (!ready || hash !== `#${anchor}` || scrolledForRef.current === key) return;
    scrolledForRef.current = key;
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  }, [anchor, hash, key, ready]);
}
