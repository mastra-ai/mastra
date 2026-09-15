import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { useVisibleTraceRows } from '../../hooks/use-visible-trace-rows';
import { ThreadTraceContext } from './thread-trace-context';
import type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceRootProps extends ComponentProps<'div'> {
  /** Trace ids in reading order (oldest first); must match the order of the rendered rows. */
  traceIds: string[];
  /**
   * The row to start from: it mounts expanded and is scrolled into view once. Only read at mount,
   * so a row that arrives on a later page is left alone.
   */
  anchorTraceId?: string | null;
}

/**
 * Owns the interaction state of a thread rendered as its traces: the selected span, the
 * highlighted spans, which rows are expanded, and which rows are on screen. Layout parts read it
 * through `useThreadTrace()` / `useThreadTraceRow()`; the root itself is the outer grid that gains a
 * side column while a span is selected.
 */
export function ThreadTraceRoot({ traceIds, anchorTraceId, className, children, ...props }: ThreadTraceRootProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleTraceIds, currentTraceId } = useVisibleTraceRows(listRef, traceIds);

  const [selected, setSelected] = useState<ThreadTraceSelectedSpan | null>(null);
  const [highlight, setHighlight] = useState<ThreadTraceHighlight | null>(null);
  const [anchor] = useState(() => anchorTraceId ?? null);
  // Selecting a span expands its row and it stays expanded until the reader collapses it with "Show less".
  const [expandedTraceIds, setExpandedTraceIds] = useState<ReadonlySet<string>>(() => new Set(anchor ? [anchor] : []));

  const setTraceExpanded = useCallback((traceId: string, expanded: boolean) => {
    setExpandedTraceIds(current => {
      if (current.has(traceId) === expanded) return current;
      const next = new Set(current);
      if (expanded) next.add(traceId);
      else next.delete(traceId);
      return next;
    });
  }, []);

  const selectSpan = useCallback(
    (traceId: string, spanId: string | undefined) => {
      setSelected(spanId ? { traceId, spanId } : null);
      if (spanId) setTraceExpanded(traceId, true);
      // Closing the panel also ends the highlight, like clearing the URL param on the traces page.
      if (!spanId) setHighlight(null);
    },
    [setTraceExpanded],
  );

  // Fades the other spans and brings the last (most specific, deepest) span into view, since it is
  // the one most likely to sit below the fold. Opening a span's detail panel stays a separate,
  // deliberate click so highlighting does not hijack the side panel.
  const highlightSpans = useCallback(
    (traceId: string, spanIds: string[]) => {
      if (spanIds.length === 0) {
        setHighlight(null);
        return;
      }
      setHighlight({ traceId, spanIds });
      setTraceExpanded(traceId, true);
    },
    [setTraceExpanded],
  );

  const scrollToTrace = useCallback((traceId: string) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-trace-id]') ?? [];
    for (const row of rows) {
      if (row.dataset.traceId === traceId) {
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }, []);

  const contextValue = useMemo<ThreadTraceContextValue>(
    () => ({
      traceIds,
      anchorTraceId: anchor,
      selected,
      selectSpan,
      highlight,
      highlightSpans,
      expandedTraceIds,
      setTraceExpanded,
      visibleTraceIds,
      currentTraceId,
      scrollToTrace,
      listRef,
    }),
    [
      traceIds,
      anchor,
      selected,
      selectSpan,
      highlight,
      highlightSpans,
      expandedTraceIds,
      setTraceExpanded,
      visibleTraceIds,
      currentTraceId,
      scrollToTrace,
    ],
  );

  return (
    <ThreadTraceContext.Provider value={contextValue}>
      <div
        data-slot="thread-trace"
        className={cn(
          'grid h-full min-h-0',
          selected ? 'grid-cols-[minmax(0,1fr)_minmax(0,40%)]' : 'grid-cols-[minmax(0,1fr)]',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ThreadTraceContext.Provider>
  );
}
