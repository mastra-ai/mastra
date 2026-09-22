import { useEffect } from 'react';
import { useFilterBarContext } from './filter-bar-context';

/** Keeps a leaving node in the DOM until its exit animation has played, then releases it. */
export function useSettleOnLeave(id: string, leaving: boolean, rootRef: React.RefObject<HTMLElement | null>) {
  const { settleRemove } = useFilterBarContext();
  useEffect(() => {
    const root = rootRef.current;
    if (!leaving || !root) return;
    const animations = typeof root.getAnimations === 'function' ? root.getAnimations({ subtree: true }) : [];
    if (animations.length === 0) {
      settleRemove(id);
      return;
    }
    let cancelled = false;
    Promise.all(animations.map(animation => animation.finished))
      .then(() => {
        if (!cancelled) settleRemove(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leaving, id, settleRemove, rootRef]);
}
