import {
  ThreadTraceDetails,
  ThreadTraceDetailsActions,
  ThreadTraceDetailsHeader,
  ThreadTraceTab,
  ThreadTraceTabContent,
  ThreadTraceTabList,
} from './thread-trace-details';
import { ThreadTraceList } from './thread-trace-list';
import { ThreadTraceLoadMoreSentinel } from './thread-trace-load-more-sentinel';
import { ThreadTraceMessages } from './thread-trace-messages';
import { ThreadTraceRail } from './thread-trace-rail';
import { ThreadTraceRoot } from './thread-trace-root';
import { ThreadTraceRow } from './thread-trace-row';
import { ThreadTraceSpanPanel } from './thread-trace-span-panel';
import { ThreadTraceSpansTab } from './thread-trace-spans-tab';

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
 *       <ThreadTrace.Row key={traceId} traceId={traceId} isFirst={i === 0}>
 *         <ThreadTrace.Messages>…</ThreadTrace.Messages>
 *         <ThreadTrace.Details>
 *           <ThreadTrace.DetailsHeader>
 *             <ThreadTrace.TabList>
 *               <ThreadTrace.Tab value="spans">Spans</ThreadTrace.Tab>
 *             </ThreadTrace.TabList>
 *           </ThreadTrace.DetailsHeader>
 *           <ThreadTrace.SpansTab />
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
  Details: ThreadTraceDetails,
  DetailsHeader: ThreadTraceDetailsHeader,
  DetailsActions: ThreadTraceDetailsActions,
  TabList: ThreadTraceTabList,
  Tab: ThreadTraceTab,
  TabContent: ThreadTraceTabContent,
  SpansTab: ThreadTraceSpansTab,
  SpanPanel: ThreadTraceSpanPanel,
});

export { useThreadTrace } from './thread-trace-context';
export type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
export { useThreadTraceRow } from './thread-trace-row-context';
export type { ThreadTraceRowContextValue } from './thread-trace-row-context';
export { THREAD_TRACE_SPANS_TAB } from './thread-trace-row';
export type { ThreadTraceRootProps } from './thread-trace-root';
export type { ThreadTraceListProps } from './thread-trace-list';
export type { ThreadTraceRailProps } from './thread-trace-rail';
export type { ThreadTraceLoadMoreSentinelProps } from './thread-trace-load-more-sentinel';
export type { ThreadTraceRowProps } from './thread-trace-row';
export type { ThreadTraceMessagesProps } from './thread-trace-messages';
export type {
  ThreadTraceDetailsProps,
  ThreadTraceDetailsHeaderProps,
  ThreadTraceDetailsActionsProps,
  ThreadTraceTabListProps,
  ThreadTraceTabProps,
  ThreadTraceTabContentProps,
} from './thread-trace-details';
export type { ThreadTraceSpansTabProps } from './thread-trace-spans-tab';
export type { ThreadTraceSpanPanelProps } from './thread-trace-span-panel';
