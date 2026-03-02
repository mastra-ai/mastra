import { useEffect, useState, type RefObject } from 'react';

export function useHasOverflow(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const viewport = ref.current;
    if (!viewport) return;

    const check = () => {
      setHasOverflow(viewport.scrollHeight > viewport.clientHeight);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(viewport);
    const contentDiv = viewport.firstElementChild;
    if (contentDiv) observer.observe(contentDiv);

    return () => observer.disconnect();
  }, [ref, enabled]);

  return enabled && hasOverflow;
}
