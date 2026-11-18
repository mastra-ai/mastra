import { ThreadTraceRoot } from './thread-trace-root';
import { ThreadTraceRow } from './thread-trace-row';
import { ThreadTraceSpanDetail } from './thread-trace-span-detail';
import { ThreadTraceSpans } from './thread-trace-spans';
import { ThreadTraceEmpty, ThreadTraceError, ThreadTraceLoading } from './thread-trace-states';
import { ThreadTraceTraceLink, ThreadTraceTurnMessages } from './thread-trace-turn';

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the active view on
 * the left and the span tree on the right. Clicking a span opens the root's `spanDetail` slot beside the
 * turns so the conversation stays readable. Layout parts (`ThreadTrace`, `ThreadTrace.Row`) place named
 * slots; leaf parts draw the data they are given. Nothing fetches, so any transport can feed it. Before
 * the turns are known, render `ThreadTrace.Loading`, `ThreadTrace.Empty` or `ThreadTrace.Error` instead.
 *
 * @example
 * <ThreadTrace
 *   traceIds={ids}
 *   onLoadOlder={fetchOlderPage}
 *   selectedSpan={selected}
 *   onSelectedSpanChange={setSelected}
 *   spanDetail={<ThreadTrace.SpanDetail span={selectedSpanRecord} />}
 * >
 *   {turns.map((turn, i) => (
 *     <ThreadTrace.Row
 *       key={turn.traceId}
 *       traceId={turn.traceId}
 *       label={`Turn ${i + 1}`}
 *       link={<ThreadTrace.TraceLink />}
 *       messages={<ThreadTrace.TurnMessages spans={turn.spans} />}
 *       feedback={<FeedbackThread feedbackData={feedbackByTraceId[turn.traceId]} onSubmit={submit} />}
 *       spans={<ThreadTrace.Spans spans={turn.spans} />}
 *     />
 *   ))}
 * </ThreadTrace>
 */
export const ThreadTrace = Object.assign(ThreadTraceRoot, {
  Row: ThreadTraceRow,
  Spans: ThreadTraceSpans,
  SpanDetail: ThreadTraceSpanDetail,
  TurnMessages: ThreadTraceTurnMessages,
  TraceLink: ThreadTraceTraceLink,
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
export type { ThreadTraceRowProps } from './thread-trace-row';
export type { ThreadTraceSpansProps } from './thread-trace-spans';
export type { ThreadTraceSpanDetailProps } from './thread-trace-span-detail';
export type { ThreadTraceErrorProps } from './thread-trace-states';
export type { ThreadTraceTraceLinkProps, ThreadTraceTurnMessagesProps } from './thread-trace-turn';
