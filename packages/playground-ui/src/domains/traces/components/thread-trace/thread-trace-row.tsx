import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadTraceRowContext } from './thread-trace-row-context';
import type { ThreadTraceRowContextValue } from './thread-trace-row-context';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { MessageScrollerItem } from '@/ds/components/MessageScroller';
import { Tabs } from '@/ds/components/Tabs';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/lib/utils';

export const THREAD_TRACE_MESSAGES_TAB = 'messages';

export interface ThreadTraceRowProps extends ComponentProps<'div'> {
  traceId: string;
}

/**
 * One agent turn: a `ThreadTrace.Divider` (turn label + tabs) above a `ThreadTrace.RowBody` holding
 * the messages column on the left and the details card on the right. The whole
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
      {/* Registers the row with the scroller so prepends of older turns keep the reading position.
          Rows measure their own columns, so they stay rendered off screen. */}
      <MessageScrollerItem messageId={traceId} className="[content-visibility:visible]">
        {/* The row is the tabs root, so the tab list in the divider drives the messages column. */}
        <Tabs<string>
          defaultTab={THREAD_TRACE_MESSAGES_TAB}
          value={tab}
          onValueChange={setTab}
          data-slot="thread-trace-row"
          className={cn(
            // `overflow-visible` overrides the tabs root scroll box so the messages column stays sticky.
            'group flex flex-col overflow-visible pb-4 transition-opacity hover:opacity-100',
            isActive || isCurrent ? 'opacity-100' : 'opacity-50',
            className,
          )}
          data-trace-id={traceId}
          data-active={isActive || undefined}
          {...props}
        >
          {children}
        </Tabs>
      </MessageScrollerItem>
    </ThreadTraceRowContext.Provider>
  );
}

export type ThreadTraceRowBodyProps = ComponentProps<'div'>;

/** The two columns of a row: the messages on the left and the details card on the right, each padded on x. */
export function ThreadTraceRowBody({ className, ...props }: ThreadTraceRowBodyProps) {
  return (
    <div
      data-slot="thread-trace-row-body"
      className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', className)}
      {...props}
    />
  );
}

export interface ThreadTraceDividerProps {
  /** Announces the turn, e.g. `Turn 1`. */
  label: string;
  /** Typically the row's `ThreadTrace.TabList`. */
  children?: ReactNode;
}

/**
 * The rule above a row: a full-width line, with the turn and its tabs centered over the messages
 * column only, so the line runs on uninterrupted above the details card.
 */
export function ThreadTraceDivider({ label, children }: ThreadTraceDividerProps) {
  return (
    <div data-slot="thread-trace-divider" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 pl-4">
        <TranscriptDivider label={label}>{children}</TranscriptDivider>
      </div>
      <div aria-hidden className="flex items-center pr-4">
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
