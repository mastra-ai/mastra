import { ThreadTraceDetails, ThreadTraceDetailsActions, ThreadTraceDetailsHeader } from './thread-trace-details';
import { ThreadTraceList } from './thread-trace-list';
import { ThreadTraceLoadMoreSentinel } from './thread-trace-load-more-sentinel';
import {
  ThreadTraceMessages,
  ThreadTraceMessagesHeader,
  ThreadTraceTab,
  ThreadTraceTabContent,
  ThreadTraceTabList,
} from './thread-trace-messages';
import { ThreadTraceRail } from './thread-trace-rail';
import { ThreadTraceRoot } from './thread-trace-root';
import { ThreadTraceRow } from './thread-trace-row';
import { ThreadTraceSpanPanel } from './thread-trace-span-panel';
import { ThreadTraceSpans } from './thread-trace-spans';

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the
 * messages on the left and the span tree on the right. Clicking a span opens its detail panel on
 * the side so the conversation stays readable. Every part takes `className` and spreads the rest
 * of its props, so the layout can be restyled from the call site.
 *
 * @example
 * <ThreadTrace traceIds={ids} anchorTraceId={anchor}>
 *   <ThreadTrace.List>
 *     <ThreadTrace.Rail turns={turns} />
 *     <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />
 *     {ids.map((traceId, i) => (
 *       <ThreadTrace.Row key={traceId} traceId={traceId}>
 *         <ThreadTrace.Messages>
 *           <ThreadTrace.MessagesHeader>
 *             <ThreadTrace.TabList>
 *               <ThreadTrace.Tab value="messages">Messages</ThreadTrace.Tab>
 *             </ThreadTrace.TabList>
 *           </ThreadTrace.MessagesHeader>
 *           <ThreadTrace.TabContent value="messages">…</ThreadTrace.TabContent>
 *         </ThreadTrace.Messages>
 *         <ThreadTrace.Details>
 *           <ThreadTrace.DetailsHeader>
 *             <ThreadTrace.DetailsActions>…</ThreadTrace.DetailsActions>
 *           </ThreadTrace.DetailsHeader>
 *           <ThreadTrace.Spans />
 *         </ThreadTrace.Details>
 *       </ThreadTrace.Row>
 *     ))}
 *   </ThreadTrace.List>
 *   <ThreadTrace.SpanPanel />
 * </ThreadTrace>
 */
export const ThreadTrace = Object.assign(ThreadTraceRoot, {
  List: ThreadTraceList,
  Rail: ThreadTraceRail,
  LoadMoreSentinel: ThreadTraceLoadMoreSentinel,
  Row: ThreadTraceRow,
  Messages: ThreadTraceMessages,
  MessagesHeader: ThreadTraceMessagesHeader,
  TabList: ThreadTraceTabList,
  Tab: ThreadTraceTab,
  TabContent: ThreadTraceTabContent,
  Details: ThreadTraceDetails,
  DetailsHeader: ThreadTraceDetailsHeader,
  DetailsActions: ThreadTraceDetailsActions,
  Spans: ThreadTraceSpans,
  SpanPanel: ThreadTraceSpanPanel,
});

export { useThreadTrace } from './thread-trace-context';
export type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
export { useThreadTraceRow } from './thread-trace-row-context';
export type { ThreadTraceRowContextValue } from './thread-trace-row-context';
export { THREAD_TRACE_MESSAGES_TAB } from './thread-trace-row';
export type { ThreadTraceRootProps } from './thread-trace-root';
export type { ThreadTraceListProps } from './thread-trace-list';
export type { ThreadTraceRailProps } from './thread-trace-rail';
export type { ThreadTraceLoadMoreSentinelProps } from './thread-trace-load-more-sentinel';
export type { ThreadTraceRowProps } from './thread-trace-row';
export type {
  ThreadTraceMessagesProps,
  ThreadTraceMessagesHeaderProps,
  ThreadTraceTabListProps,
  ThreadTraceTabProps,
  ThreadTraceTabContentProps,
} from './thread-trace-messages';
export type {
  ThreadTraceDetailsProps,
  ThreadTraceDetailsHeaderProps,
  ThreadTraceDetailsActionsProps,
} from './thread-trace-details';
export type { ThreadTraceSpansProps } from './thread-trace-spans';
export type { ThreadTraceSpanPanelProps } from './thread-trace-span-panel';
