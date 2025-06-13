import { useCallback, useState } from 'react';

/**
 * Tracks whether or not the given element is currently in view.
 * This is to replace framer-motion's `useInView` which has issues
 * tracking a ref that is set at a time other than mount.
 */
export const useInView = () => {
  const [inView, setInView] = useState(false);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new IntersectionObserver(([entry]) => {
        setInView(entry.isIntersecting);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
  }, []);

  return { inView, setRef };
};
