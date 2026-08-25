import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

/**
 * Cards revealed per step. Every card mounts a run spec, an activity read and a
 * status pass, all replayed on each list poll, and a column can hold hundreds —
 * a step is already more than a column shows at once.
 */
const REVEAL_STEP = 30;

/**
 * Renders a column's cards a step at a time, extending as its own scroller
 * nears the end. `pinned` keeps a deeplinked card rendered however deep it
 * sits: the board scrolls to it by finding it in the DOM.
 */
export function ColumnReveal<T>({
  items,
  pinned,
  renderItem,
}: {
  items: readonly T[];
  pinned?: (item: T) => boolean;
  renderItem: (item: T) => ReactNode;
}) {
  const [revealed, setRevealed] = useState(REVEAL_STEP);
  const pinnedIndex = pinned === undefined ? -1 : items.findIndex(pinned);
  const count = Math.max(revealed, pinnedIndex + 1);

  // Keyed by what is revealed, so each step remounts the sentinel and observes
  // it again. An observer only reports crossings: a sentinel that never leaves
  // view — a lane whose cards all fit — would otherwise report once and stall
  // with the rest of the column unrendered.
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setRevealed(current => current + REVEAL_STEP);
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {items.slice(0, count).map(renderItem)}
      {count < items.length && <div key={count} ref={sentinelRef} aria-hidden className="h-px shrink-0" />}
    </>
  );
}
