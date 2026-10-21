import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;
type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;
type ListScoresBySpanResponse = Awaited<ReturnType<MastraClient['listScoresBySpan']>>;
type Feedback = ListFeedbackResponse['feedback'][number];
type Score = ListScoresBySpanResponse['scores'][number];

export const TRACE_ID = 'trace-panel';

const baseSpan = {
  traceId: TRACE_ID,
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-08-30T12:00:00.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.000Z'),
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const rootSpan = {
  ...baseSpan,
  spanId: 'span-root',
  name: 'Root agent run',
  parentSpanId: null,
  entityType: 'agent',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  threadId: 'weather-thread',
  input: { messages: [{ role: 'user', content: 'Will it rain?' }] },
  output: { text: 'No rain is expected.' },
};
export const childSpanOne = {
  ...baseSpan,
  spanId: 'span-child-1',
  name: 'First tool call',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: 'span-root',
};
export const childSpanTwo = {
  ...baseSpan,
  spanId: 'span-child-2',
  name: 'Second tool call',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: 'span-root',
};

/** Full trace tree: root with two children — enough to exercise prev/next span navigation. */
export const panelTraceSpans: GetTraceResponse = {
  traceId: TRACE_ID,
  spans: [rootSpan, childSpanOne, childSpanTwo],
};

const feedbackRecord = (feedbackId: string, spanId?: string): Feedback => ({
  feedbackId,
  timestamp: new Date('2026-08-30T12:00:02.000Z'),
  traceId: TRACE_ID,
  spanId,
  feedbackType: 'thumbs',
  value: 1,
});

const feedbackPage = (feedback: Feedback[]): ListFeedbackResponse => ({
  feedback,
  pagination: { page: 0, perPage: 10, total: feedback.length, hasMore: false },
});

export const emptyFeedback = feedbackPage([]);

/** Two trace-level records: the trace Feedback tab counts them. */
export const traceFeedback = feedbackPage([feedbackRecord('feedback-1'), feedbackRecord('feedback-2')]);

/** One record scoped to the first tool call span. */
export const childSpanFeedback = feedbackPage([feedbackRecord('feedback-span', 'span-child-1')]);

export const ANCHOR_SCORE_ID = 'score-anchor-1';

const anchorScore: Score = {
  id: ANCHOR_SCORE_ID,
  scorerId: 'relevance',
  entityId: 'weather-agent',
  runId: 'run-1',
  score: 0.9,
  scorer: { id: 'relevance', name: 'Relevance' },
  source: 'LIVE',
  entity: {},
  traceId: TRACE_ID,
  spanId: 'span-root',
  createdAt: new Date('2026-08-30T12:00:03.000Z'),
  updatedAt: new Date('2026-08-30T12:00:03.000Z'),
};

export const emptyScores: ListScoresBySpanResponse = {
  scores: [],
  pagination: { page: 0, perPage: 10, total: 0, hasMore: false },
};

/** One score on the root (anchor) span. */
export const anchorSpanScores: ListScoresBySpanResponse = {
  scores: [anchorScore],
  pagination: { page: 0, perPage: 10, total: 1, hasMore: false },
};

export const spanDetailById: Record<string, GetSpanResponse> = {
  'span-root': { span: { ...rootSpan, input: { message: 'go' }, output: { text: 'done' } } },
  'span-child-1': { span: { ...childSpanOne, sessionId: 'session-42', input: { arg: 1 }, output: { ok: true } } },
  'span-child-2': { span: { ...childSpanTwo, input: { arg: 2 }, output: { ok: true } } },
};
