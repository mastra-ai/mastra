import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';

import { useVisibleTraceRows } from '../../hooks/use-visible-trace-rows';
import type { TraceNavigation } from '../trace-navigation';
import { TraceNavigationScope } from '../trace-navigation-scope';
import { ThreadTraceContext } from './thread-trace-context';
import type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/ds/components/MessageScroller';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';
import { cn } from '@/lib/utils';

export interface ThreadTraceRootProps extends ComponentProps<'div'> {
  /** Trace ids in reading order (oldest first); must match the order of the rendered rows. */
  traceIds: string[];
  /** Fires when the reader scrolls up to the oldest loaded row; load the previous page here. */
  onLoadOlder?: () => void;
  /**
   * Controlled selection (`null`: no span open), so the host knows which span to load the record of.
   * The root keeps its own when omitted.
   */
  selectedSpan?: ThreadTraceSelectedSpan | null;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
  /**
   * The resizable column beside the turns, shown while a span is open; typically a
   * `ThreadTrace.SpanDetail` fed with the open span's record.
   */
  spanDetail?: ReactNode;
  /** Where the thread opens things (each turn's trace, tools, agents…): the host's callbacks; text without them. */
  navigation?: TraceNavigation;
  /** The turns, oldest first: one `ThreadTrace.Row` per trace of `traceIds`. */
  children?: ReactNode;
}

/**
 * Owns the interaction state of a thread rendered as its traces: the selected span (unless the host
 * controls it), the highlighted spans, which rows are expanded, and which rows are on screen. It never
 * fetches: each part gets the records it draws from the host. Layout parts read it
 * through `useThreadTrace()` / `useThreadTraceRow()`. It lays the turns out in a scrolling list and, while a
 * span is open, its `spanDetail` slot in a resizable column beside them.
 */
export function ThreadTraceRoot({
  traceIds,
  onLoadOlder,
  selectedSpan,
  onSelectedSpanChange,
  spanDetail,
  navigation,
  className,
  children,
  ...props
}: ThreadTraceRootProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleTraceIds, currentTraceId } = useVisibleTraceRows(listRef, traceIds);

  const [ownSelected, setOwnSelected] = useState<ThreadTraceSelectedSpan | null>(null);
  const selected = selectedSpan !== undefined ? selectedSpan : ownSelected;
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
      setOwnSelected(next);
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
      <TraceNavigationScope navigation={navigation}>
        {/* Opens on the latest turn and keeps the reading position when older turns are prepended.
          No auto-follow: turns are settled before mount, so the only growth at the end comes from
          the reader expanding a row, which must not move the view. */}
        <MessageScrollerProvider defaultScrollPosition="end" preserveScrollOnPrepend onReachStart={onLoadOlder}>
          <div data-slot="thread-trace" className={cn('flex h-full min-h-0', className)} {...props}>
            <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
              <Panel id="thread-trace-main" minSize={320} className="flex min-h-0 min-w-0 flex-col">
                {/* Visible-row tracking observes `[data-trace-id]` inside this viewport. */}
                <MessageScroller data-slot="thread-trace-list" className="min-h-0 flex-1">
                  <MessageScrollerViewport ref={listRef} className="overflow-x-hidden">
                    <MessageScrollerContent data-slot="thread-trace-list-inner" className="relative min-h-full gap-0">
                      {children}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                </MessageScroller>
              </Panel>
              {selected && spanDetail && (
                <>
                  <PanelSeparator variant="pill" />
                  <Panel id="thread-trace-span" minSize={384} defaultSize="35%" maxSize="50%">
                    <div
                      data-slot="thread-trace-span-panel"
                      // Same chrome as the span column of the trace panel: flush to the edge, divided by a left border.
                      className="flex h-full min-h-0 min-w-0 animate-in flex-col overflow-hidden border-l border-border duration-300 fade-in-0"
                    >
                      {spanDetail}
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
        </MessageScrollerProvider>
      </TraceNavigationScope>
    </ThreadTraceContext.Provider>
  );
}
