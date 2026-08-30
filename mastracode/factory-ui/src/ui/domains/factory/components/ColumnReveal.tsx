import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

// Every card mounts a run spec, an activity read and a status pass on each poll.
const REVEAL_STEP = 30;

// `pinned` keeps a deeplinked card rendered however deep it sits, so the board can scroll to it.
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

  // Keyed by the reveal, not by what is rendered: observers report crossings, and a pinned card holds the render count still.
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
      {count < items.length && <div key={revealed} ref={sentinelRef} aria-hidden className="h-px shrink-0" />}
    </>
  );
}
