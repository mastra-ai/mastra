import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Which `[data-trace-id]` rows inside `listRef` are on screen, and the topmost one, so the
 * thread rail can mark them like the chat page does.
 */
export function useVisibleTraceRows(listRef: RefObject<HTMLDivElement | null>, traceIds: string[]) {
  const [visibleSet, setVisibleSet] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const root = listRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        setVisibleSet(current => {
          const next = new Set(current);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.traceId;
            if (!id) continue;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      { root, threshold: 0.1 },
    );

    root.querySelectorAll<HTMLElement>('[data-trace-id]').forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [listRef, traceIds]);

  const visibleTraceIds = useMemo(() => traceIds.filter(id => visibleSet.has(id)), [traceIds, visibleSet]);
  return { visibleTraceIds, currentTraceId: visibleTraceIds[0] };
}
