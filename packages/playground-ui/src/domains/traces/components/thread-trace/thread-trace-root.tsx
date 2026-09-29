import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { useVisibleTraceRows } from '../../hooks/use-visible-trace-rows';
import { ThreadTraceContext } from './thread-trace-context';
import type {
  ThreadTraceContextValue,
  ThreadTraceHighlight,
  ThreadTraceLayout,
  ThreadTraceSelectedSpan,
} from './thread-trace-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceRootProps extends ComponentProps<'div'> {
  /** Trace ids in reading order (oldest first); must match the order of the rendered rows. */
  traceIds: string[];
  /**
   * The row to start from: it is scrolled into view once. Only read at mount,
   * so a row that arrives on a later page is left alone.
   */
  anchorTraceId?: string | null;
  /** Fires when the trace or span column opens or closes. */
  onLayoutChange?: (layout: ThreadTraceLayout) => void;
}

const LAYOUT_COLUMNS: Record<ThreadTraceLayout, string> = {
  conversation: 'grid-cols-[minmax(0,1fr)_0fr_0fr]',
  trace: 'grid-cols-[minmax(0,1fr)_1fr_0fr]',
  // Below xl three equal columns get too narrow: give the conversation less room while a span is open.
  span: 'grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_1fr_1fr]',
};

/**
 * Owns the interaction state of a thread rendered as its traces: the open trace, the selected
 * span, the highlighted spans, and which rows are on screen. Layout parts read it through
 * `useThreadTrace()` / `useThreadTraceRow()`; the root itself is the outer grid —
 * `[conversation] [trace] [span]` — whose trace and span cells collapse to zero while closed.
 */
export function ThreadTraceRoot({
  traceIds,
  anchorTraceId,
  onLayoutChange,
  className,
  children,
  ...props
}: ThreadTraceRootProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleTraceIds, currentTraceId } = useVisibleTraceRows(listRef, traceIds);

  const [anchor] = useState(() => anchorTraceId ?? null);
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ThreadTraceSelectedSpan | null>(null);
  const [highlight, setHighlight] = useState<ThreadTraceHighlight | null>(null);

  // Showing another turn's trace drops the span and highlight that belonged to the previous one.
  const openTrace = useCallback((traceId: string | null) => {
    setOpenTraceId(traceId);
    setSelected(current => (current && current.traceId === traceId ? current : null));
    setHighlight(current => (current && current.traceId === traceId ? current : null));
  }, []);

  const toggleTrace = useCallback(
    (traceId: string) => openTrace(openTraceId === traceId ? null : traceId),
    [openTrace, openTraceId],
  );

  const selectSpan = useCallback(
    (traceId: string, spanId: string | undefined) => {
      if (!spanId) {
        setSelected(null);
        // Closing the span also ends the highlight, like clearing the URL param on the traces page.
        setHighlight(null);
        return;
      }
      openTrace(traceId);
      setSelected({ traceId, spanId });
    },
    [openTrace],
  );

  // Fades the other spans and brings the last (most specific, deepest) span into view. Opening a
  // span's detail stays a separate, deliberate click so highlighting does not hijack that column.
  const highlightSpans = useCallback(
    (traceId: string, spanIds: string[]) => {
      if (spanIds.length === 0) {
        setHighlight(null);
        return;
      }
      openTrace(traceId);
      setHighlight({ traceId, spanIds });
    },
    [openTrace],
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

  const layout: ThreadTraceLayout = selected ? 'span' : openTraceId ? 'trace' : 'conversation';

  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  useEffect(() => {
    onLayoutChangeRef.current?.(layout);
  }, [layout]);

  const contextValue = useMemo<ThreadTraceContextValue>(
    () => ({
      traceIds,
      anchorTraceId: anchor,
      openTraceId,
      openTrace,
      toggleTrace,
      selected,
      selectSpan,
      highlight,
      highlightSpans,
      layout,
      visibleTraceIds,
      currentTraceId,
      scrollToTrace,
      listRef,
    }),
    [
      traceIds,
      anchor,
      openTraceId,
      openTrace,
      toggleTrace,
      selected,
      selectSpan,
      highlight,
      highlightSpans,
      layout,
      visibleTraceIds,
      currentTraceId,
      scrollToTrace,
    ],
  );

  return (
    <ThreadTraceContext.Provider value={contextValue}>
      <div
        data-slot="thread-trace"
        data-layout={layout}
        className={cn(
          // The trace and span cells always exist and collapse to zero so opening/closing them
          // animates via `grid-template-columns`, like the trace panel's columns.
          'grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-in-out',
          LAYOUT_COLUMNS[layout],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ThreadTraceContext.Provider>
  );
}
