import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadTraceRowContext } from './thread-trace-row-context';
import type { ThreadTraceRowContextValue } from './thread-trace-row-context';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/lib/utils';

export const THREAD_TRACE_SPANS_TAB = 'spans';

export interface ThreadTraceRowProps extends ComponentProps<'div'> {
  traceId: string;
  /** The oldest trace; its details column gets the top border of the list. */
  isFirst?: boolean;
}

// Module-level so the callback ref keeps its identity and React only invokes it on mount/unmount.
const scrollIntoViewOnMount = (row: HTMLDivElement | null) => {
  row?.scrollIntoView({ block: 'start' });
};

/**
 * One agent turn: the messages column on the left and the details column on the right. The whole
 * row is dimmed unless it is the first one in view, hovered, or its span is open in the side panel,
 * so the reader keeps track of which turn they are on without hovering.
 */
export function ThreadTraceRow({ traceId, isFirst = false, className, children, ...props }: ThreadTraceRowProps) {
  const root = useThreadTrace();

  const selectedSpanId = root.selected?.traceId === traceId ? root.selected.spanId : undefined;
  const featuredSpanIds = root.highlight?.traceId === traceId ? root.highlight.spanIds : undefined;
  const revealSpanId = featuredSpanIds?.at(-1);
  const isActive = selectedSpanId !== undefined;
  const isCurrent = root.currentTraceId === traceId;
  const isExpanded = root.expandedTraceIds.has(traceId);
  const isAnchor = root.anchorTraceId === traceId;

  // A long trace is clamped to the real height of its messages column (not a nominal row height),
  // so the timeline never dwarfs the turn it belongs to. The refs live here because the messages
  // and the timeline are sibling parts.
  const messages = useMeasuredAutoHeight<HTMLDivElement>();
  const timeline = useMeasuredAutoHeight<HTMLDivElement>();
  const detailsHeader = useMeasuredAutoHeight<HTMLDivElement>();

  // Controlled so a highlight can bring the span tree back: the timeline is unmounted on other
  // tabs, and a highlight nobody can see is just a no-op.
  const [tab, setTab] = useState<string>(THREAD_TRACE_SPANS_TAB);

  const { highlightSpans: rootHighlightSpans, setTraceExpanded } = root;
  const highlightSpans = useCallback(
    (spanIds: string[]) => {
      setTab(THREAD_TRACE_SPANS_TAB);
      rootHighlightSpans(traceId, spanIds);
    },
    [rootHighlightSpans, traceId],
  );
  const setExpanded = useCallback(
    (expanded: boolean) => setTraceExpanded(traceId, expanded),
    [setTraceExpanded, traceId],
  );

  const contextValue = useMemo<ThreadTraceRowContextValue>(
    () => ({
      traceId,
      isFirst,
      isActive,
      isCurrent,
      isExpanded,
      isAnchor,
      selectedSpanId,
      featuredSpanIds,
      revealSpanId,
      highlightSpans,
      setExpanded,
      tab,
      setTab,
      messagesRef: messages.ref,
      timelineRef: timeline.ref,
      detailsHeaderRef: detailsHeader.ref,
      messagesHeight: messages.height,
      timelineHeight: timeline.height,
      detailsHeaderHeight: detailsHeader.height,
    }),
    [
      traceId,
      isFirst,
      isActive,
      isCurrent,
      isExpanded,
      isAnchor,
      selectedSpanId,
      featuredSpanIds,
      revealSpanId,
      highlightSpans,
      setExpanded,
      tab,
      messages.ref,
      timeline.ref,
      detailsHeader.ref,
      messages.height,
      timeline.height,
      detailsHeader.height,
    ],
  );

  return (
    <ThreadTraceRowContext.Provider value={contextValue}>
      <div
        data-slot="thread-trace-row"
        className={cn(
          // Same fixed messages width as the trace panel; the details column takes the rest.
          'group grid grid-cols-[24rem_minmax(0,1fr)] pr-4 pl-14 transition-opacity hover:opacity-100',
          isActive || isCurrent ? 'opacity-100' : 'opacity-50',
          className,
        )}
        data-trace-id={traceId}
        data-active={isActive || undefined}
        ref={isAnchor ? scrollIntoViewOnMount : undefined}
        {...props}
      >
        {children}
      </div>
    </ThreadTraceRowContext.Provider>
  );
}
