import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

const REVEAL_STEP = 30;

export function ColumnReveal<T>({
  items,
  pinned,
  children,
}: {
  items: readonly T[];
  pinned?: (item: T) => boolean;
  children: (items: readonly T[]) => ReactNode;
}) {
  const [revealed, setRevealed] = useState(REVEAL_STEP);
  const pinnedIndex = pinned === undefined ? -1 : items.findIndex(pinned);
  const count = Math.max(revealed, pinnedIndex + 1);

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
      {children(items.slice(0, count))}
      {count < items.length && <div key={revealed} ref={sentinelRef} aria-hidden className="h-px shrink-0" />}
    </>
  );
}
