import { ThreadTraceList } from './thread-trace-list';
import { ThreadTraceLoadMoreSentinel } from './thread-trace-load-more-sentinel';
import { ThreadTraceRail } from './thread-trace-rail';
import { ThreadTraceRoot } from './thread-trace-root';
import { ThreadTraceRow } from './thread-trace-row';
import { ThreadTraceSpanPanel } from './thread-trace-span-panel';
import { ThreadTraceSpans } from './thread-trace-spans';
import {
  ThreadTraceTab,
  ThreadTraceTabContent,
  ThreadTraceTabList,
  ThreadTraceTabs,
  ThreadTraceTabsHeader,
} from './thread-trace-tabs';
import { ThreadTraceTracePanel } from './thread-trace-trace-panel';
import { ThreadTraceTurnDivider } from './thread-trace-turn-divider';

/**
 * A memory thread rendered as a conversation: one row per agent turn (oldest first), each opened
 * by a "Turn N" divider. Showing a turn's trace opens it in a column beside the conversation, and
 * clicking one of its spans opens that span in a third column. Every part takes `className` and
 * spreads the rest of its props, so the layout can be restyled from the call site.
 *
 * @example
 * <ThreadTrace traceIds={ids} anchorTraceId={anchor}>
 *   <ThreadTrace.List>
 *     <ThreadTrace.Rail turns={turns} />
 *     {ids.map(traceId => (
 *       <ThreadTrace.Row key={traceId} traceId={traceId}>
 *         <ThreadTrace.TurnDivider />
 *         …messages…
 *       </ThreadTrace.Row>
 *     ))}
 *     <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />
 *   </ThreadTrace.List>
 *   <ThreadTrace.TracePanel>
 *     {traceId => (
 *       <ThreadTrace.Tabs>
 *         <ThreadTrace.TabsHeader>
 *           <ThreadTrace.TabList>
 *             <ThreadTrace.Tab value="spans">Spans</ThreadTrace.Tab>
 *           </ThreadTrace.TabList>
 *         </ThreadTrace.TabsHeader>
 *         <ThreadTrace.TabContent value="spans">
 *           <ThreadTrace.Spans traceId={traceId} />
 *         </ThreadTrace.TabContent>
 *       </ThreadTrace.Tabs>
 *     )}
 *   </ThreadTrace.TracePanel>
 *   <ThreadTrace.SpanPanel />
 * </ThreadTrace>
 */
export const ThreadTrace = Object.assign(ThreadTraceRoot, {
  List: ThreadTraceList,
  Rail: ThreadTraceRail,
  LoadMoreSentinel: ThreadTraceLoadMoreSentinel,
  Row: ThreadTraceRow,
  TurnDivider: ThreadTraceTurnDivider,
  TracePanel: ThreadTraceTracePanel,
  Tabs: ThreadTraceTabs,
  TabsHeader: ThreadTraceTabsHeader,
  TabList: ThreadTraceTabList,
  Tab: ThreadTraceTab,
  TabContent: ThreadTraceTabContent,
  Spans: ThreadTraceSpans,
  SpanPanel: ThreadTraceSpanPanel,
});

export { useThreadTrace } from './thread-trace-context';
export type {
  ThreadTraceContextValue,
  ThreadTraceHighlight,
  ThreadTraceLayout,
  ThreadTraceSelectedSpan,
} from './thread-trace-context';
export { useThreadTraceRow } from './thread-trace-row-context';
export type { ThreadTraceRowContextValue } from './thread-trace-row-context';
export { THREAD_TRACE_SPANS_TAB } from './thread-trace-tabs';
export type { ThreadTraceRootProps } from './thread-trace-root';
export type { ThreadTraceListProps } from './thread-trace-list';
export type { ThreadTraceRailProps } from './thread-trace-rail';
export type { ThreadTraceLoadMoreSentinelProps } from './thread-trace-load-more-sentinel';
export type { ThreadTraceRowProps } from './thread-trace-row';
export type { ThreadTraceTurnDividerProps } from './thread-trace-turn-divider';
export type { ThreadTraceTracePanelProps } from './thread-trace-trace-panel';
export type {
  ThreadTraceTabsProps,
  ThreadTraceTabsHeaderProps,
  ThreadTraceTabListProps,
  ThreadTraceTabProps,
  ThreadTraceTabContentProps,
} from './thread-trace-tabs';
export type { ThreadTraceSpansProps } from './thread-trace-spans';
export type { ThreadTraceSpanPanelProps } from './thread-trace-span-panel';
