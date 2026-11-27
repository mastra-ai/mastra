import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadTraceRowContext } from './thread-trace-row-context';
import type { ThreadTraceRowContextValue } from './thread-trace-row-context';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { Card } from '@/ds/components/Card';
import { DataPanel } from '@/ds/components/DataPanel';
import { MessageScrollerItem } from '@/ds/components/MessageScroller';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconChatBubble7Plus } from '@/ds/icons/central/IconChatBubble7Plus';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/lib/utils';

export const THREAD_TRACE_MESSAGES_TAB = 'messages';

export interface ThreadTraceRowProps {
  traceId: string;
  /** Names the turn, e.g. `Turn 1`: the accessible name of its divider, not shown. */
  label: string;
  /** Before the tabs in the divider, e.g. `ThreadTrace.TraceLink`. */
  link?: ReactNode;
  /** The Messages view, typically `ThreadTrace.TurnMessages`. */
  messages?: ReactNode;
  /** The Feedback view: whatever feedback UI the host renders for the turn (e.g. `FeedbackThread`). */
  feedback?: ReactNode;
  /** The Scores view: whatever scores UI the host renders for the turn (e.g. `TraceScoresTabView`). */
  scores?: ReactNode;
  /** The turn's span tree, typically `ThreadTrace.Spans`. */
  spans?: ReactNode;
  /** Above the span tree, in the details card (e.g. an action of the host's). */
  detailsHeader?: ReactNode;
  /** Controlled view of the messages column; the row keeps its own (starting on Messages) when omitted. */
  tab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
}

interface ViewSlot {
  value: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  /** The view brings its own padding. */
  flush?: boolean;
}

/**
 * One agent turn: a divider naming it (with its link and one tab per view slot the host filled), then
 * the active view on the left and the details card with the span tree on the right. A view's content
 * mounts only while its tab is open. A long span tree is clamped to the real height of the Messages view.
 */
export function ThreadTraceRow({
  traceId,
  label,
  link,
  messages,
  feedback,
  scores,
  spans,
  detailsHeader,
  tab: controlledTab,
  onTabChange,
  className,
}: ThreadTraceRowProps) {
  const root = useThreadTrace();

  const selectedSpanId = root.selected?.traceId === traceId ? root.selected.spanId : undefined;
  const featuredSpanIds = root.highlight?.traceId === traceId ? root.highlight.spanIds : undefined;
  const revealSpanId = featuredSpanIds?.at(-1);
  const isActive = selectedSpanId !== undefined;
  const isCurrent = root.currentTraceId === traceId;
  const isExpanded = root.expandedTraceIds.has(traceId);

  // A long trace is clamped to the real height of its messages column (not a nominal row height),
  // so the timeline never dwarfs the turn it belongs to.
  const messagesColumn = useMeasuredAutoHeight();
  const timeline = useMeasuredAutoHeight();
  const detailsHeaderBox = useMeasuredAutoHeight();

  const views: ViewSlot[] = [];
  if (messages) {
    views.push({
      value: THREAD_TRACE_MESSAGES_TAB,
      label: 'Messages',
      icon: <IconChatBubble7 />,
      content: messages,
      flush: true,
    });
  }
  if (feedback) views.push({ value: 'feedback', label: 'Feedback', icon: <IconChatBubble7Plus />, content: feedback });
  if (scores) views.push({ value: 'scores', label: 'Scores', icon: <ScorersIcon />, content: scores });

  const [ownTab, setOwnTab] = useState<string>(THREAD_TRACE_MESSAGES_TAB);
  const requestedTab = controlledTab ?? ownTab;
  const activeTab = (views.find(view => view.value === requestedTab) ?? views[0])?.value ?? THREAD_TRACE_MESSAGES_TAB;
  const changeTab = (next: string) => {
    setOwnTab(next);
    onTabChange?.(next);
  };

  // The clamp budget is the height of the *Messages* view: a short Feedback or Scores view must not
  // squash the span tree next to it, so the last Messages height is kept while another view is showing.
  const [messagesViewHeight, setMessagesViewHeight] = useState<number | null>(null);
  if (activeTab === THREAD_TRACE_MESSAGES_TAB && messagesColumn.height !== messagesViewHeight) {
    setMessagesViewHeight(messagesColumn.height);
  }
  const minHeight = activeTab === THREAD_TRACE_MESSAGES_TAB ? undefined : (messagesViewHeight ?? undefined);

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
      timelineRef: timeline.ref,
      messagesHeight: messagesViewHeight,
      timelineHeight: timeline.height,
      detailsHeaderHeight: detailsHeaderBox.height,
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
      timeline.ref,
      messagesViewHeight,
      timeline.height,
      detailsHeaderBox.height,
    ],
  );

  return (
    <ThreadTraceRowContext.Provider value={contextValue}>
      {/* Registers the row with the scroller so prepends of older turns keep the reading position.
          Rows measure their own columns, so they stay rendered off screen. */}
      <MessageScrollerItem messageId={traceId} className="[content-visibility:visible]">
        {/* The row is the tabs root, so the tab list in the divider drives the messages column. */}
        <Tabs<string>
          defaultTab={activeTab}
          value={activeTab}
          onValueChange={changeTab}
          data-slot="thread-trace-row"
          // `overflow-visible` overrides the tabs root scroll box so the messages column stays sticky.
          className={cn('group flex flex-col overflow-visible pb-4', className)}
          data-trace-id={traceId}
          data-active={isActive || undefined}
        >
          {/* A full-width rule, with the link and tabs centered over the messages column only, so the
              line runs on uninterrupted above the details card. */}
          <div data-slot="thread-trace-divider" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 pl-4">
              <TranscriptDivider label={label} hideLabel>
                {link}
                {views.length > 0 && (
                  <TabList variant="pill-ghost" size="sm">
                    {views.map(view => (
                      <Tab key={view.value} value={view.value}>
                        <Icon size="xs">{view.icon}</Icon>
                        {view.label}
                      </Tab>
                    ))}
                  </TabList>
                )}
              </TranscriptDivider>
            </div>
            <div aria-hidden className="flex items-center pr-4">
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
          <div data-slot="thread-trace-row-body" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div
              data-slot="thread-trace-messages"
              className="relative min-w-0 overflow-x-clip px-4"
              style={{ minHeight }}
            >
              {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
              <div
                ref={messagesColumn.ref}
                data-slot="thread-trace-messages-inner"
                className="sticky top-0"
                data-testid="trace-row-messages"
              >
                {views.map(view => (
                  <TabContent
                    key={view.value}
                    value={view.value}
                    flush={view.flush}
                    className={cn('overflow-x-hidden', !view.flush && 'min-h-0 py-3')}
                  >
                    {view.content}
                  </TabContent>
                ))}
              </div>
            </div>
            <Card
              elevation="raised"
              data-slot="thread-trace-details"
              className={cn(
                'mx-4 min-w-0 overflow-hidden',
                // While collapsed the messages column alone sets the row height: `h-0` keeps this cell
                // out of the grid's row sizing and `min-h-full` stretches it back to the row afterwards.
                !isExpanded && 'h-0 min-h-full',
              )}
            >
              {detailsHeader && (
                // Measured: its height is taken out of the span tree budget so the card never overshoots the messages.
                <div ref={detailsHeaderBox.ref} data-slot="thread-trace-details-header">
                  <DataPanel.Header className="border-b border-border">{detailsHeader}</DataPanel.Header>
                </div>
              )}
              {spans}
            </Card>
          </div>
        </Tabs>
      </MessageScrollerItem>
    </ThreadTraceRowContext.Provider>
  );
}
