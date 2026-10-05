import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { useVisibleTraceRows } from '../../hooks/use-visible-trace-rows';
import { ThreadTraceContext } from './thread-trace-context';
import type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
import { MessageScrollerProvider } from '@/ds/components/MessageScroller';
import { PanelGroup } from '@/lib/resize/panel-group';
import { cn } from '@/lib/utils';

export interface ThreadTraceRootProps extends ComponentProps<'div'> {
  /** Trace ids in reading order (oldest first); must match the order of the rendered rows. */
  traceIds: string[];
  /** Fires when the reader scrolls up to the oldest loaded row; load the previous page here. */
  onLoadOlder?: () => void;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
}

/**
 * Owns the interaction state of a thread rendered as its traces: the selected span, the
 * highlighted spans, which rows are expanded, and which rows are on screen. Layout parts read it
 * through `useThreadTrace()` / `useThreadTraceRow()`; the root itself is the resizable panel group that
 * gains a span column while a span is selected.
 */
export function ThreadTraceRoot({
  traceIds,
  onLoadOlder,
  onSelectedSpanChange,
  className,
  children,
  ...props
}: ThreadTraceRootProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleTraceIds, currentTraceId } = useVisibleTraceRows(listRef, traceIds);

  const [selected, setSelected] = useState<ThreadTraceSelectedSpan | null>(null);
  const [highlight, setHighlight] = useState<ThreadTraceHighlight | null>(null);
  // Selecting a span expands its row and it stays expanded until the reader collapses it with "Collapse".
  const [expandedTraceIds, setExpandedTraceIds] = useState<ReadonlySet<string>>(() => new Set());

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
      const next = spanId ? { traceId, spanId } : null;
      setSelected(next);
      onSelectedSpanChange?.(next);
      if (spanId) setTraceExpanded(traceId, true);
      // Closing the panel also ends the highlight, like clearing the URL param on the traces page.
      if (!spanId) setHighlight(null);
    },
    [setTraceExpanded, onSelectedSpanChange],
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
      {/* Chat-like: opens on the latest turn, follows it while rows grow until the reader scrolls
          up, and keeps the reading position when older turns are prepended. */}
      <MessageScrollerProvider
        defaultScrollPosition="end"
        autoScroll
        preserveScrollOnPrepend
        onReachStart={onLoadOlder}
      >
        <div data-slot="thread-trace" className={cn('flex h-full min-h-0', className)} {...props}>
          <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
            {children}
          </PanelGroup>
        </div>
      </MessageScrollerProvider>
    </ThreadTraceContext.Provider>
  );
}
