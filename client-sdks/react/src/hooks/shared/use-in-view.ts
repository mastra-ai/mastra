import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

export type UseInViewOptions = {
  /**
   * Scroll container to observe against. When omitted, the browser viewport is used.
   * Pass the list's own scroll viewport so the sentinel only fires when scrolled
   * into view inside that container.
   */
  root?: RefObject<HTMLElement | null>;
};

/**
 * Tracks whether or not the given element is currently in view.
 * This is to replace framer-motion's `useInView` which has issues
 * tracking a ref that is set at a time other than mount.
 *
 * The observer is created in an effect (not in the callback ref) so that an
 * ancestor `root` ref, which React assigns after descendant refs, is already
 * populated when the observer is constructed.
 */
export const useInView = ({ root }: UseInViewOptions = {}) => {
  const [inView, setInView] = useState(false);
  const [node, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setInView(entry.isIntersecting);
      },
      { root: root?.current ?? null },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root]);

  return { inView, setRef };
};
