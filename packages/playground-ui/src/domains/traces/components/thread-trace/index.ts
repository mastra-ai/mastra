import { ThreadTraceDetails, ThreadTraceDetailsActions, ThreadTraceDetailsHeader } from './thread-trace-details';
import { ThreadTraceList } from './thread-trace-list';
import {
  ThreadTraceMessages,
  ThreadTraceTab,
  ThreadTraceTabContent,
  ThreadTraceTabList,
} from './thread-trace-messages';
import { ThreadTraceRoot } from './thread-trace-root';
import { ThreadTraceDivider, ThreadTraceRow, ThreadTraceRowBody } from './thread-trace-row';
import { ThreadTraceSpanDetail, ThreadTraceSpanPanel } from './thread-trace-span-panel';
import { ThreadTraceSpans } from './thread-trace-spans';
import { ThreadTraceEmpty, ThreadTraceError, ThreadTraceLoading } from './thread-trace-states';
import {
  ThreadTraceFeedbackTab,
  ThreadTraceMessagesTab,
  ThreadTraceScoresTab,
  ThreadTraceTraceLink,
  ThreadTraceTurnMessages,
} from './thread-trace-turn';

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the
 * messages on the left and the span tree on the right. Clicking a span opens its detail panel on
 * the side so the conversation stays readable. Every part takes `className` and spreads the rest
 * of its props, so the layout can be restyled from the call site.
 *
 * It never fetches: the host hands each part the records it draws (each row's spans, the selected
 * span's record), typed like the Mastra client's responses, so any transport can feed it. Before the
 * turns are known, render `ThreadTrace.Loading`, `ThreadTrace.Empty` or `ThreadTrace.Error` instead.
 *
 * @example
 * <ThreadTrace traceIds={ids} onLoadOlder={fetchOlderPage} selectedSpan={selected} onSelectedSpanChange={setSelected}>
 *   <ThreadTrace.List>
 *     {ids.map((traceId, i) => (
 *       <ThreadTrace.Row key={traceId} traceId={traceId}>
 *         <ThreadTrace.Divider label={`Turn ${i + 1}`}>
 *           <ThreadTrace.TraceLink />
 *           <ThreadTrace.TabList>
 *             <ThreadTrace.MessagesTab />
 *             <ThreadTrace.FeedbackTab />
 *           </ThreadTrace.TabList>
 *         </ThreadTrace.Divider>
 *         <ThreadTrace.RowBody>
 *           <ThreadTrace.Messages>
 *             <ThreadTrace.TabContent value="messages" flush>
 *               <ThreadTrace.TurnMessages spans={spansByTraceId[traceId]} />
 *             </ThreadTrace.TabContent>
 *             <ThreadTrace.TabContent value="feedback">
 *               <FeedbackThread feedbackData={feedbackByTraceId[traceId]} onSubmit={…} />
 *             </ThreadTrace.TabContent>
 *           </ThreadTrace.Messages>
 *           <ThreadTrace.Details>
 *             <ThreadTrace.DetailsHeader>
 *               <ThreadTrace.DetailsActions>…</ThreadTrace.DetailsActions>
 *             </ThreadTrace.DetailsHeader>
 *             <ThreadTrace.Spans spans={spansByTraceId[traceId]} />
 *           </ThreadTrace.Details>
 *         </ThreadTrace.RowBody>
 *       </ThreadTrace.Row>
 *     ))}
 *   </ThreadTrace.List>
 *   <ThreadTrace.SpanPanel>
 *     <ThreadTrace.SpanDetail span={selectedSpanRecord} />
 *   </ThreadTrace.SpanPanel>
 * </ThreadTrace>
 */
export const ThreadTrace = Object.assign(ThreadTraceRoot, {
  List: ThreadTraceList,
  Row: ThreadTraceRow,
  Divider: ThreadTraceDivider,
  RowBody: ThreadTraceRowBody,
  Messages: ThreadTraceMessages,
  TabList: ThreadTraceTabList,
  Tab: ThreadTraceTab,
  TabContent: ThreadTraceTabContent,
  Details: ThreadTraceDetails,
  DetailsHeader: ThreadTraceDetailsHeader,
  DetailsActions: ThreadTraceDetailsActions,
  Spans: ThreadTraceSpans,
  SpanPanel: ThreadTraceSpanPanel,
  SpanDetail: ThreadTraceSpanDetail,
  TurnMessages: ThreadTraceTurnMessages,
  TraceLink: ThreadTraceTraceLink,
  MessagesTab: ThreadTraceMessagesTab,
  FeedbackTab: ThreadTraceFeedbackTab,
  ScoresTab: ThreadTraceScoresTab,
  Loading: ThreadTraceLoading,
  Empty: ThreadTraceEmpty,
  Error: ThreadTraceError,
});

export { useThreadTrace } from './thread-trace-context';
export type { ThreadTraceContextValue, ThreadTraceHighlight, ThreadTraceSelectedSpan } from './thread-trace-context';
export { useThreadTraceRow } from './thread-trace-row-context';
export type { ThreadTraceRowContextValue } from './thread-trace-row-context';
export { THREAD_TRACE_MESSAGES_TAB } from './thread-trace-row';
export type { ThreadTraceRootProps } from './thread-trace-root';
export type { ThreadTraceListProps } from './thread-trace-list';
export type { ThreadTraceRowProps, ThreadTraceRowBodyProps, ThreadTraceDividerProps } from './thread-trace-row';
export type {
  ThreadTraceMessagesProps,
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
export type { ThreadTraceSpanDetailProps, ThreadTraceSpanPanelProps } from './thread-trace-span-panel';
export type { ThreadTraceErrorProps } from './thread-trace-states';
export type {
  ThreadTracePresetTabProps,
  ThreadTraceTraceLinkProps,
  ThreadTraceTurnMessagesProps,
} from './thread-trace-turn';
