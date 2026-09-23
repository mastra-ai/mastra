import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadTraceRowContext } from './thread-trace-row-context';
import type { ThreadTraceRowContextValue } from './thread-trace-row-context';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/lib/utils';

export const THREAD_TRACE_MESSAGES_TAB = 'messages';

export interface ThreadTraceRowProps extends ComponentProps<'div'> {
  traceId: string;
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
export function ThreadTraceRow({ traceId, className, children, ...props }: ThreadTraceRowProps) {
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

  // Which view the messages column shows (Messages / Feedback / Scores), one per row.
  const [tab, setTab] = useState<string>(THREAD_TRACE_MESSAGES_TAB);
  // The clamp budget is the height of the *Messages* view: a short Feedback or Scores view
  // must not squash the span tree next to it, so the last Messages height is kept while
  // another view is showing.
  const [messagesViewHeight, setMessagesViewHeight] = useState<number | null>(null);
  if (tab === THREAD_TRACE_MESSAGES_TAB && messages.height !== messagesViewHeight) {
    setMessagesViewHeight(messages.height);
  }

  const { highlightSpans: rootHighlightSpans, setTraceExpanded } = root;
  const highlightSpans = useCallback(
    (spanIds: string[]) => rootHighlightSpans(traceId, spanIds),
    [rootHighlightSpans, traceId],
  );
  const setExpanded = useCallback(
    (expanded: boolean) => setTraceExpanded(traceId, expanded),
    [setTraceExpanded, traceId],
  );

  const contextValue = useMemo<ThreadTraceRowContextValue>(
    () => ({
      traceId,
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
      messagesHeight: messagesViewHeight,
      timelineHeight: timeline.height,
      detailsHeaderHeight: detailsHeader.height,
    }),
    [
      traceId,
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
      messagesViewHeight,
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
          'group grid grid-cols-[24rem_minmax(0,1fr)] border-b border-border pr-4 pl-14 transition-opacity hover:opacity-100',
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
