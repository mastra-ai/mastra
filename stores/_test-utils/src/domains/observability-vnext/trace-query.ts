import {
  compareTraceQueryStrings,
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  type NormalizedTraceQueryRequest,
  type TraceQueryGroupResponse,
  type TraceQueryPredicate,
  type TraceQueryRequest,
  type TraceQueryResponse,
  type TraceQueryTrace,
  type TraceQueryTraceResponse,
  type TrustedTraceQueryPlan,
  type TrustedTraceQueryPredicate,
  type TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';

export interface RawTraceQuerySpan {
  cursorId: number;
  traceId: string | null;
  spanId: string;
  parentSpanId: string | null;
  isPending: boolean;
  name: string;
  spanType: string;
  attributes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  error: unknown | null;
  threadId: string | null;
  resourceId: string | null;
  startedAt: string;
  endedAt: string | null;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  entityVersionId: string | null;
  parentEntityVersionId: string | null;
  rootEntityVersionId: string | null;
  environment: string | null;
}

export interface RawTraceQueryScore {
  cursorId: number;
  scoreId: string;
  traceId: string | null;
  spanId: string | null;
  timestamp: string;
  scorerId: string;
  scorerVersion: string | null;
  scoreSource: string | null;
  score: number | null;
  entityVersionId: string | null;
  parentEntityVersionId: string | null;
  rootEntityVersionId: string | null;
}

export interface RawTraceQueryFeedback {
  cursorId: number;
  feedbackId: string;
  traceId: string | null;
  timestamp: string;
  feedbackType: string;
  feedbackSource: string;
  feedbackUserId: string | null;
  sourceId: string | null;
  value: string | number;
  comment: string | null;
  entityVersionId: string | null;
  parentEntityVersionId: string | null;
  rootEntityVersionId: string | null;
}

export interface TraceQueryFixtureData {
  spans: RawTraceQuerySpan[];
  scores: RawTraceQueryScore[];
  feedback: RawTraceQueryFeedback[];
}

const span = (
  cursorId: number,
  traceId: string | null,
  spanId: string,
  overrides: Partial<RawTraceQuerySpan> = {},
): RawTraceQuerySpan => ({
  cursorId,
  traceId,
  spanId,
  parentSpanId: null,
  isPending: false,
  name: spanId,
  spanType: 'agent_run',
  attributes: null,
  metadata: null,
  error: null,
  threadId: null,
  resourceId: null,
  startedAt: '2026-08-10T00:00:00.000Z',
  endedAt: '2026-08-10T00:00:01.000Z',
  entityType: 'agent',
  entityId: null,
  entityName: 'agent',
  entityVersionId: null,
  parentEntityVersionId: null,
  rootEntityVersionId: null,
  environment: 'production',
  ...overrides,
});

const scoreRecord = (
  cursorId: number,
  scoreId: string,
  traceId: string | null,
  scorerId: string,
  score: number | null,
  overrides: Partial<RawTraceQueryScore> = {},
): RawTraceQueryScore => ({
  cursorId,
  scoreId,
  traceId,
  spanId: null,
  timestamp: '2026-08-10T00:00:00.000Z',
  scorerId,
  scorerVersion: null,
  scoreSource: null,
  score,
  entityVersionId: null,
  parentEntityVersionId: null,
  rootEntityVersionId: null,
  ...overrides,
});

const feedbackRecord = (
  cursorId: number,
  feedbackId: string,
  traceId: string | null,
  feedbackType: string,
  feedbackSource: string,
  value: string | number,
  overrides: Partial<RawTraceQueryFeedback> = {},
): RawTraceQueryFeedback => ({
  cursorId,
  feedbackId,
  traceId,
  timestamp: '2026-08-10T00:00:00.000Z',
  feedbackType,
  feedbackSource,
  feedbackUserId: null,
  sourceId: null,
  value,
  comment: null,
  entityVersionId: null,
  parentEntityVersionId: null,
  rootEntityVersionId: null,
  ...overrides,
});

export interface TraceQueryFeedbackReplacementWrite {
  method: 'create' | 'batch';
  feedback: RawTraceQueryFeedback[];
}

export interface TraceQueryFeedbackReplacementAssertion {
  name: string;
  request: TraceQueryRequest;
  expected: Array<{ traceId: string }>;
}

export interface TraceQueryFeedbackReplacementScenario {
  name: string;
  fixture: TraceQueryFixtureData;
  writes: TraceQueryFeedbackReplacementWrite[];
  assertions: TraceQueryFeedbackReplacementAssertion[];
}

const feedbackReplacementRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
const feedbackReplacementWideRange = { from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z' };

const feedbackReplacementRoot = (traceId: string, startedAt: string): RawTraceQuerySpan =>
  span(1, traceId, `root-${traceId}`, {
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 1000).toISOString(),
  });

const feedbackReplacementRequest = (
  traceId: string,
  quantifier: 'some' | 'none',
  predicate: TraceQueryPredicate,
  timeRange = feedbackReplacementRange,
): TraceQueryRequest => ({
  timeRange,
  where: {
    op: 'and',
    args: [
      { op: 'eq', left: { path: 'traceId' }, right: { literal: traceId } },
      { feedback: { [quantifier]: predicate } },
    ],
  },
});

const feedbackReplacementAssertions = (args: {
  oldPredicate: TraceQueryPredicate;
  currentPredicate: TraceQueryPredicate;
  oldTraceId?: string;
  currentTraceId?: string;
  currentIsCorrelated?: boolean;
  currentTimeRange?: { from: string; to: string };
}): TraceQueryFeedbackReplacementAssertion[] => {
  const oldTraceId = args.oldTraceId ?? 'feedback-replacement-a';
  const currentTraceId = args.currentTraceId ?? oldTraceId;
  const currentIsCorrelated = args.currentIsCorrelated ?? true;
  return [
    {
      name: 'old predicate does not satisfy some',
      request: feedbackReplacementRequest(oldTraceId, 'some', args.oldPredicate),
      expected: [],
    },
    {
      name: 'old predicate satisfies none',
      request: feedbackReplacementRequest(oldTraceId, 'none', args.oldPredicate),
      expected: [{ traceId: oldTraceId }],
    },
    {
      name: 'current predicate satisfies some',
      request: feedbackReplacementRequest(
        currentTraceId,
        'some',
        args.currentPredicate,
        args.currentTimeRange ?? feedbackReplacementRange,
      ),
      expected: currentIsCorrelated ? [{ traceId: currentTraceId }] : [],
    },
    {
      name: 'current predicate does not satisfy none',
      request: feedbackReplacementRequest(
        currentTraceId,
        'none',
        args.currentPredicate,
        args.currentTimeRange ?? feedbackReplacementRange,
      ),
      expected: currentIsCorrelated ? [] : [{ traceId: currentTraceId }],
    },
  ];
};

const feedbackSourcePredicate = (value: string): TraceQueryPredicate => ({
  op: 'eq',
  left: { path: 'feedbackSource' },
  right: { literal: value },
});

const feedbackValuePredicate = (value: string | number): TraceQueryPredicate => ({
  op: 'eq',
  left: { path: 'value' },
  right: { literal: value },
});

const feedbackReplacementScenario = (args: {
  name: string;
  roots?: RawTraceQuerySpan[];
  writes: TraceQueryFeedbackReplacementWrite[];
  assertions: TraceQueryFeedbackReplacementAssertion[];
}): TraceQueryFeedbackReplacementScenario => ({
  name: args.name,
  fixture: {
    spans: args.roots ?? [feedbackReplacementRoot('feedback-replacement-a', '2026-08-10T00:00:00.000Z')],
    scores: [],
    feedback: args.writes.flatMap(write => write.feedback),
  },
  writes: args.writes,
  assertions: args.assertions,
});

const sequentialFeedbackWrites = (
  oldRecord: RawTraceQueryFeedback,
  currentRecord: RawTraceQueryFeedback,
): TraceQueryFeedbackReplacementWrite[] => [
  { method: 'create', feedback: [oldRecord] },
  { method: 'create', feedback: [currentRecord] },
];

/**
 * Feedback replacement contract:
 * - feedbackId alone is the logical identity;
 * - the last accepted sequential write, or last matching entry in one batch, is current;
 * - caller timestamps do not define replacement order;
 * - current selection happens globally before trace correlation and some/none evaluation;
 * - exact retries are idempotent;
 * - concurrent writes without an observable acceptance order are outside this deterministic contract.
 */
export const TRACE_QUERY_FEEDBACK_REPLACEMENT_SCENARIOS: TraceQueryFeedbackReplacementScenario[] = [
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-later-timestamp',
      'feedback-replacement-a',
      'rating',
      'old-later-timestamp',
      1,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-later-timestamp',
      2,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'sequential replacement with a later timestamp',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-backdated',
      'feedback-replacement-a',
      'rating',
      'old-backdated',
      1,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-backdated',
      2,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'sequential replacement with an earlier timestamp',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-same-timestamp',
      'feedback-replacement-a',
      'rating',
      'old-same-timestamp',
      1,
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-same-timestamp',
      2,
    );
    return feedbackReplacementScenario({
      name: 'sequential replacement with the same timestamp',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
  (() => {
    const record = feedbackRecord(
      1,
      'feedback-replacement-exact-retry',
      'feedback-replacement-a',
      'rating',
      'exact-retry',
      1,
    );
    const retry = { ...record, cursorId: 2 };
    return feedbackReplacementScenario({
      name: 'exact retry with the same timestamp and payload',
      writes: sequentialFeedbackWrites(record, retry),
      assertions: [
        {
          name: 'retried predicate satisfies some',
          request: feedbackReplacementRequest(
            'feedback-replacement-a',
            'some',
            feedbackSourcePredicate(record.feedbackSource),
          ),
          expected: [{ traceId: 'feedback-replacement-a' }],
        },
        {
          name: 'retried predicate does not satisfy none',
          request: feedbackReplacementRequest(
            'feedback-replacement-a',
            'none',
            feedbackSourcePredicate(record.feedbackSource),
          ),
          expected: [],
        },
      ],
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-one-batch',
      'feedback-replacement-a',
      'rating',
      'old-one-batch',
      1,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-one-batch',
      2,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'repeated feedbackId in one batch uses the last entry',
      writes: [{ method: 'batch', feedback: [oldRecord, currentRecord] }],
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-across-batches',
      'feedback-replacement-a',
      'rating',
      'old-across-batches',
      1,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-across-batches',
      2,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'repeated feedbackId across batches uses the backdated final write',
      writes: [
        { method: 'batch', feedback: [oldRecord] },
        { method: 'batch', feedback: [currentRecord] },
      ],
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-number-to-text',
      'feedback-replacement-a',
      'rating',
      'number-to-text',
      7,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'number-to-text',
      'current-text',
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'numeric value replaced by a textual value',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackValuePredicate(oldRecord.value),
        currentPredicate: feedbackValuePredicate(currentRecord.value),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-text-to-number',
      'feedback-replacement-a',
      'rating',
      'text-to-number',
      'old-text',
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'text-to-number',
      8,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'textual value replaced by a numeric value',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackValuePredicate(oldRecord.value),
        currentPredicate: feedbackValuePredicate(currentRecord.value),
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-comment',
      'feedback-replacement-a',
      'rating',
      'comment-transition',
      1,
      { comment: 'old comment', timestamp: '2026-08-10T01:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'comment-transition',
      2,
      { comment: null, timestamp: '2026-08-10T02:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'present comment replaced by a missing comment',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: { op: 'exists', path: 'comment' },
        currentPredicate: { op: 'notExists', path: 'comment' },
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-moved-trace',
      'feedback-replacement-a',
      'rating',
      'old-moved-trace',
      1,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-b',
      'rating',
      'current-moved-trace',
      2,
      { timestamp: '2026-08-10T03:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'feedback moved from trace A to trace B outside the selected root range',
      roots: [
        feedbackReplacementRoot('feedback-replacement-a', '2026-08-10T00:00:00.000Z'),
        feedbackReplacementRoot('feedback-replacement-b', '2026-07-10T00:00:00.000Z'),
      ],
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
        currentTraceId: 'feedback-replacement-b',
        currentTimeRange: feedbackReplacementWideRange,
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(
      1,
      'feedback-replacement-trace-to-null',
      'feedback-replacement-a',
      'rating',
      'old-trace-to-null',
      1,
      { timestamp: '2026-08-10T01:00:00.000Z' },
    );
    const currentRecord = feedbackRecord(2, oldRecord.feedbackId, null, 'rating', 'current-trace-to-null', 2, {
      timestamp: '2026-08-10T02:00:00.000Z',
    });
    return feedbackReplacementScenario({
      name: 'feedback moved from trace A to a null trace',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
        currentIsCorrelated: false,
      }),
    });
  })(),
  (() => {
    const oldRecord = feedbackRecord(1, 'feedback-replacement-null-to-trace', null, 'rating', 'old-null-to-trace', 1, {
      timestamp: '2026-08-10T01:00:00.000Z',
    });
    const currentRecord = feedbackRecord(
      2,
      oldRecord.feedbackId,
      'feedback-replacement-a',
      'rating',
      'current-null-to-trace',
      2,
      { timestamp: '2026-08-10T02:00:00.000Z' },
    );
    return feedbackReplacementScenario({
      name: 'feedback moved from a null trace to trace A',
      writes: sequentialFeedbackWrites(oldRecord, currentRecord),
      assertions: feedbackReplacementAssertions({
        oldPredicate: feedbackSourcePredicate(oldRecord.feedbackSource),
        currentPredicate: feedbackSourcePredicate(currentRecord.feedbackSource),
      }),
    });
  })(),
];

export const TRACE_QUERY_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    span(1, 'trace-a', 'root-a-old', {
      threadId: 'thread-1',
      resourceId: 'resource-old',
      startedAt: '2026-08-01T10:00:00.000Z',
      endedAt: '2026-08-01T10:00:01.000Z',
    }),
    span(10, 'trace-a', 'root-a', {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      startedAt: '2026-08-05T10:00:00.000Z',
      endedAt: '2026-08-05T10:00:02.000Z',
      entityName: 'support-agent',
      metadata: {
        messageId: 'message-a',
        parentMessageId: 'message-parent',
        actorRole: 'assistant',
        ' actorRole': 'leading-key',
        'actorRole ': 'trailing-key',
        threadId: 'metadata-thread-1',
        api_key: 'metadata-api-key',
        protocolVersion: 'v2',
        temporalRunId: 'temporal-a',
        externalTraceId: 'external-a',
        paddedValue: '  padded value  ',
        emptyValue: '',
        numericValue: 42,
        nestedValue: { child: 'value' },
      },
    }),
    span(11, 'trace-a', 'span-a-tool', {
      parentSpanId: 'root-a',
      name: 'superseded_lookup',
      spanType: 'tool_call',
      attributes: { provider: 'superseded-provider' },
      entityType: 'tool',
      entityId: 'medication_lookup',
      entityName: 'Medication lookup',
      entityVersionId: 'tool-v1',
      rootEntityVersionId: 'agent-v1',
      startedAt: '2026-08-05T10:00:00.500Z',
      endedAt: '2026-08-05T10:00:01.000Z',
    }),
    span(12, 'trace-a', 'span-a-tool', {
      parentSpanId: 'root-a',
      name: 'medication_lookup',
      spanType: 'tool_call',
      error: { message: 'latest failed attempt' },
      entityType: 'tool',
      entityId: 'medication_lookup',
      entityName: 'Medication lookup',
      entityVersionId: 'tool-v2',
      rootEntityVersionId: 'agent-v1',
      startedAt: '2026-08-05T10:00:00.500Z',
      endedAt: '2026-08-05T10:00:01.500Z',
    }),
    span(13, 'trace-a', 'span-a-model', {
      parentSpanId: 'root-a',
      name: "llm: 'claude-sonnet-4-6'",
      spanType: 'model_generation',
      attributes: { model: 'claude-sonnet-4-6', provider: 'anthropic' },
      startedAt: '2026-07-15T10:00:00.000Z',
      endedAt: '2026-07-15T10:00:06.250Z',
    }),
    span(20, 'trace-b', 'root-b', {
      threadId: 'thread-1',
      resourceId: 'resource-2',
      startedAt: '2026-08-05T10:00:00.000Z',
      endedAt: '2026-08-05T10:00:03.000Z',
      environment: 'staging',
    }),
    span(21, 'trace-b', 'span-b-tool', {
      parentSpanId: 'root-b',
      name: 'medication_lookup',
      spanType: 'tool_call',
      entityType: 'tool',
      entityId: 'medication_lookup',
      entityName: 'Medication lookup',
      entityVersionId: 'tool-v1',
      rootEntityVersionId: 'agent-v1',
      error: null,
    }),
    span(22, 'trace-b', 'span-b-model', {
      parentSpanId: 'root-b',
      name: "llm: 'gpt-5'",
      spanType: 'model_generation',
      attributes: { model: 'gpt-5', provider: 'openai' },
      startedAt: '2026-08-05T10:00:00.250Z',
      endedAt: '2026-08-05T10:00:02.250Z',
    }),
    span(30, 'trace-c', 'root-c', {
      threadId: 'thread-2',
      resourceId: null,
      startedAt: '2026-08-07T10:00:00.000Z',
      endedAt: '2026-08-07T10:00:02.000Z',
      error: { message: 'root failed' },
    }),
    span(31, 'trace-c', 'span-c-retrieval', {
      parentSpanId: 'root-c',
      name: 'retrieve_medications',
      spanType: 'rag_action',
      attributes: { model: 42, provider: { name: 'not-a-string' } },
      entityType: 'rag_ingestion',
      entityId: 'medication-index',
      entityName: 'Medication index',
      entityVersionId: 'index-v3',
      parentEntityVersionId: 'agent-v2',
      rootEntityVersionId: 'agent-v2',
      startedAt: '2026-08-07T10:00:00.250Z',
      endedAt: '2026-08-07T10:00:01.250Z',
    }),
    span(40, 'trace-d', 'root-d', {
      threadId: null,
      resourceId: null,
      startedAt: '2026-08-08T10:00:00.000Z',
      endedAt: '2026-08-08T10:00:02.000Z',
    }),
    span(50, 'trace-running', 'root-running-old', {
      threadId: 'thread-3',
      startedAt: '2026-08-09T10:00:00.000Z',
      endedAt: '2026-08-09T10:00:02.000Z',
    }),
    span(51, 'trace-running', 'root-running', {
      threadId: 'thread-3',
      isPending: true,
      startedAt: '2026-08-09T11:00:00.000Z',
      endedAt: null,
    }),
    span(60, 'trace-outside', 'root-outside', {
      threadId: 'thread-4',
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-01T00:00:01.000Z',
    }),
    span(70, null, 'span-uncorrelated', {
      parentSpanId: 'other-root',
      name: 'medication_lookup',
      spanType: 'tool_call',
      attributes: { model: 'uncorrelated-model', provider: 'uncorrelated-provider' },
      error: { message: 'must not correlate' },
    }),
  ],
  scores: [
    scoreRecord(1, 'score-a-factuality', 'trace-a', 'factuality', 0.9, {
      spanId: 'span-a-tool',
      timestamp: '2026-07-19T10:00:00.000Z',
      scorerVersion: 'v1',
      scoreSource: 'manual',
      entityVersionId: 'entity-v1',
      parentEntityVersionId: 'parent-v1',
      rootEntityVersionId: 'root-v1',
    }),
    scoreRecord(2, 'score-a-factuality', 'trace-a', 'factuality', 0.4, {
      spanId: 'span-a-tool',
      timestamp: '2026-07-20T10:00:00.000Z',
      scorerVersion: 'v2',
      scoreSource: 'automated',
      entityVersionId: 'entity-v2',
      parentEntityVersionId: 'parent-v2',
      rootEntityVersionId: 'root-v1',
    }),
    scoreRecord(3, 'score-a-safety', 'trace-a', 'safety', 0.95, {
      timestamp: '2026-08-05T10:00:03.000Z',
      scorerVersion: 'v1',
      scoreSource: 'automated',
      entityVersionId: 'safety-v1',
      rootEntityVersionId: 'root-v1',
    }),
    scoreRecord(4, 'score-b-factuality', 'trace-b', 'factuality', 0.9, {
      spanId: 'span-b-tool',
      timestamp: '2026-08-06T10:00:00.000Z',
      scorerVersion: 'v2',
      scoreSource: 'automated',
      entityVersionId: 'entity-v2',
      parentEntityVersionId: 'parent-v2',
      rootEntityVersionId: 'root-v1',
    }),
    scoreRecord(5, 'score-b-safety', 'trace-b', 'safety', 0.4, {
      timestamp: '2026-08-06T10:00:01.000Z',
      scorerVersion: 'v1',
      scoreSource: 'manual',
      entityVersionId: 'safety-v1',
      rootEntityVersionId: 'root-v2',
    }),
    scoreRecord(6, 'score-c-factuality', 'trace-c', 'factuality', 0.7, {
      timestamp: '2026-08-07T10:00:03.000Z',
    }),
    scoreRecord(7, 'score-uncorrelated', null, 'factuality', 0.1, {
      timestamp: '2026-07-20T10:00:00.000Z',
      scorerVersion: 'v2',
      scoreSource: 'automated',
    }),
    scoreRecord(8, 'score-nonmatching-trace', 'trace-without-root', 'factuality', 0.1, {
      timestamp: '2026-07-20T10:00:00.000Z',
      scorerVersion: 'v2',
      scoreSource: 'automated',
    }),
  ],
  feedback: [
    feedbackRecord(1, 'feedback-a-rating', 'trace-a', 'rating', 'superseded-patient', -1, {
      timestamp: '2026-07-14T10:00:00.000Z',
      feedbackUserId: 'patient-1',
      sourceId: 'survey-result-1',
      comment: 'Needs improvement',
      entityVersionId: 'entity-v2',
      parentEntityVersionId: 'parent-v2',
      rootEntityVersionId: 'root-v1',
    }),
    feedbackRecord(2, 'feedback-a-rating', 'trace-a', 'rating', 'patient', -1, {
      timestamp: '2026-07-15T10:00:00.000Z',
      feedbackUserId: 'patient-1',
      sourceId: 'survey-result-1',
      comment: 'Needs improvement',
      entityVersionId: 'entity-v2',
      parentEntityVersionId: 'parent-v2',
      rootEntityVersionId: 'root-v1',
    }),
    feedbackRecord(3, 'feedback-a-correction', 'trace-a', 'clinician-correction', 'clinician', 'Use 20 mg', {
      timestamp: '2026-08-12T10:00:00.000Z',
      feedbackUserId: 'clinician-1',
    }),
    feedbackRecord(4, 'feedback-b-review-type', 'trace-b', 'clinical-review', 'patient', 'reviewed'),
    feedbackRecord(5, 'feedback-b-review-source', 'trace-b', 'rating', 'clinician', 3, {
      timestamp: '2026-08-20T10:00:00.000Z',
      sourceId: 'app-result-1',
    }),
    feedbackRecord(6, 'feedback-b-text-three', 'trace-b', 'rating', 'patient', '3'),
    feedbackRecord(7, 'feedback-c-review', 'trace-c', 'clinical-review', 'clinician', 'approved', {
      comment: 'Reviewed',
    }),
    feedbackRecord(8, 'feedback-uncorrelated', null, 'rating', 'patient', -5),
    feedbackRecord(9, 'feedback-nonmatching-trace', 'trace-without-root', 'rating', 'patient', -5),
  ],
};

const tiedStartedAt = '2026-08-20T10:00:00.000Z';
const tiedEndedAt = '2026-08-20T10:00:01.000Z';
const tiedScoreTimestamp = '2026-08-20T10:00:02.000Z';

export const TRACE_QUERY_ORDINAL_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    span(201, 'A', 'root-A', { threadId: 'A', startedAt: tiedStartedAt, endedAt: tiedEndedAt }),
    span(202, 'a', 'root-a', { threadId: 'a', startedAt: tiedStartedAt, endedAt: tiedEndedAt }),
    span(203, 'é', 'root-accent', { threadId: 'é', startedAt: tiedStartedAt, endedAt: tiedEndedAt }),
    span(204, 'Ω', 'root-omega', { threadId: 'Ω', startedAt: tiedStartedAt, endedAt: tiedEndedAt }),
  ],
  scores: [],
  feedback: [],
};

export const TRACE_QUERY_TIED_TIMESTAMP_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    span(100, 'trace-tied', 'root-z-old', {
      threadId: 'thread-tied',
      resourceId: 'resource-old',
      startedAt: tiedStartedAt,
      endedAt: tiedEndedAt,
      entityName: 'old-root',
    }),
    span(101, 'trace-tied', 'root-a-current', {
      threadId: 'thread-tied',
      resourceId: 'resource-current',
      startedAt: tiedStartedAt,
      endedAt: tiedEndedAt,
      entityName: 'current-root',
    }),
    span(102, 'trace-tied', 'span-tied-tool', {
      parentSpanId: 'root-a-current',
      spanType: 'tool_call',
      startedAt: tiedStartedAt,
      endedAt: tiedEndedAt,
    }),
    span(103, 'trace-tied', 'span-tied-tool', {
      parentSpanId: 'root-a-current',
      spanType: 'tool_call',
      error: { message: 'current attempt failed' },
      startedAt: tiedStartedAt,
      endedAt: tiedEndedAt,
    }),
  ],
  scores: [
    scoreRecord(100, 'score-tied', 'trace-tied', 'factuality', 0.9, { timestamp: tiedScoreTimestamp }),
    scoreRecord(101, 'score-tied', 'trace-tied', 'factuality', 0.2, { timestamp: tiedScoreTimestamp }),
  ],
  feedback: [],
};

const fullRange = {
  from: '2026-08-01T00:00:00Z',
  to: '2026-09-01T00:00:00Z',
};

export interface TraceQueryConformanceCase {
  name: string;
  request: TraceQueryRequest;
  expected: Array<{ traceId: string } | { threadId: string }>;
  requiresStrictFeedbackValueTypes?: boolean;
}

export const TRACE_QUERY_TIED_TIMESTAMP_CASES: TraceQueryConformanceCase[] = [
  {
    name: 'selects the later root when root timestamps tie',
    request: {
      timeRange: fullRange,
      where: { op: 'eq', left: { path: 'entityName' }, right: { literal: 'current-root' } },
    },
    expected: [{ traceId: 'trace-tied' }],
  },
  {
    name: 'selects the later span when span timestamps tie',
    request: {
      timeRange: fullRange,
      where: { spans: { some: { op: 'exists', path: 'error' } } },
    },
    expected: [{ traceId: 'trace-tied' }],
  },
  {
    name: 'selects the later score when score timestamps tie',
    request: {
      timeRange: fullRange,
      where: { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } } } },
    },
    expected: [{ traceId: 'trace-tied' }],
  },
];

export const TRACE_QUERY_CONFORMANCE_CASES: TraceQueryConformanceCase[] = [
  {
    name: 'returns one current completed root per trace in default order',
    request: { timeRange: fullRange },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'evaluates recursive trace predicates',
    request: {
      timeRange: fullRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
          {
            op: 'not',
            arg: { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
          },
        ],
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-a' }],
  },
  {
    name: 'filters by portable top-level string metadata dimensions',
    request: {
      timeRange: fullRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'metadata.messageId' }, right: { literal: 'message-a' } },
          { op: 'eq', left: { path: 'metadata.parentMessageId' }, right: { literal: 'message-parent' } },
          { op: 'eq', left: { path: 'metadata.actorRole' }, right: { literal: 'assistant' } },
          { op: 'eq', left: { path: 'metadata.threadId' }, right: { literal: 'metadata-thread-1' } },
          { op: 'eq', left: { path: 'metadata.api_key' }, right: { literal: 'metadata-api-key' } },
          { op: 'eq', left: { path: 'metadata.protocolVersion' }, right: { literal: 'v2' } },
          { op: 'eq', left: { path: 'metadata.temporalRunId' }, right: { literal: 'temporal-a' } },
          { op: 'eq', left: { path: 'metadata.externalTraceId' }, right: { literal: 'external-a' } },
          { op: 'notExists', path: 'metadata.emptyValue' },
        ],
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'compares metadata predicates against trimmed string values',
    request: {
      timeRange: fullRange,
      where: { op: 'eq', left: { path: 'metadata.paddedValue' }, right: { literal: 'padded value' } },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'preserves exact metadata keys containing whitespace',
    request: {
      timeRange: fullRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'metadata. actorRole' }, right: { literal: 'leading-key' } },
          { op: 'eq', left: { path: '${metadata.actorRole }' }, right: { literal: 'trailing-key' } },
        ],
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'does not match an exact metadata key through its trimmed spelling',
    request: {
      timeRange: fullRange,
      where: { op: 'eq', left: { path: 'metadata.actorRole' }, right: { literal: 'leading-key' } },
    },
    expected: [],
  },
  {
    name: 'uses total missing semantics for metadata predicates',
    request: {
      timeRange: fullRange,
      where: {
        op: 'and',
        args: [
          { op: 'notExists', path: 'metadata.parentMessageId' },
          { op: 'ne', left: { path: 'metadata.actorRole' }, right: { literal: 'assistant' } },
          { op: 'notIn', value: { path: 'metadata.actorRole' }, set: ['assistant', 'tool'] },
        ],
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-b' }],
  },
  {
    name: 'binds tool name, failure, identity, and lineage to one current span',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } },
              { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
              { op: 'eq', left: { path: 'entityType' }, right: { literal: 'tool' } },
              { op: 'eq', left: { path: 'entityId' }, right: { literal: 'medication_lookup' } },
              { op: 'eq', left: { path: 'entityName' }, right: { literal: 'Medication lookup' } },
              { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'tool-v2' } },
              { op: 'notExists', path: 'parentEntityVersionId' },
              { op: 'eq', left: { path: 'rootEntityVersionId' }, right: { literal: 'agent-v1' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'does not combine a span name with a model from another span',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } },
              { op: 'eq', left: { path: 'model' }, right: { literal: 'claude-sonnet-4-6' } },
            ],
          },
        },
      },
    },
    expected: [],
  },
  {
    name: 'filters slow model spans by model, provider, and independent span timestamps',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'spanType' }, right: { literal: 'model_generation' } },
              { op: 'eq', left: { path: 'model' }, right: { literal: 'claude-sonnet-4-6' } },
              { op: 'eq', left: { path: 'provider' }, right: { literal: 'anthropic' } },
              {
                op: 'gte',
                left: { path: 'startedAt' },
                right: { literal: '2026-07-15T09:00:00Z' },
              },
              {
                op: 'lt',
                left: { path: 'endedAt' },
                right: { literal: '2026-07-15T11:00:00Z' },
              },
              { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'normalizes non-string model and provider attributes as missing',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'name' }, right: { literal: 'retrieve_medications' } },
              { op: 'notExists', path: 'model' },
              { op: 'notExists', path: 'provider' },
              { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'index-v3' } },
              { op: 'eq', left: { path: 'parentEntityVersionId' }, right: { literal: 'agent-v2' } },
              { op: 'eq', left: { path: 'rootEntityVersionId' }, right: { literal: 'agent-v2' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-c' }],
  },
  {
    name: 'applies nullable negative membership semantics to current spans',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'entityId' }, right: { literal: 'medication_lookup' } },
              { op: 'notIn', value: { path: 'provider' }, set: ['anthropic'] },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'does not resurrect superseded span values',
    request: {
      timeRange: fullRange,
      where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'superseded_lookup' } } } },
    },
    expected: [],
  },
  {
    name: 'uses correlated anti-existence for failed tool spans',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          none: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
              { op: 'exists', path: 'error' },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-b' }],
  },
  {
    name: 'binds scorer and score predicates to one current score record',
    request: {
      timeRange: fullRange,
      where: {
        scores: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'factuality' } },
              { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'binds scorer version and threshold to one current score record',
    request: {
      timeRange: fullRange,
      where: {
        scores: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'scorerVersion' }, right: { literal: 'v2' } },
              { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'filters current scores by source and an independent score-time range',
    request: {
      timeRange: fullRange,
      where: {
        scores: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'scoreSource' }, right: { literal: 'automated' } },
              {
                op: 'gte',
                left: { path: 'timestamp' },
                right: { literal: '2026-07-15T00:00:00Z' },
              },
              {
                op: 'lt',
                left: { path: 'timestamp' },
                right: { literal: '2026-08-01T00:00:00Z' },
              },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'filters scores by span anchoring presence',
    request: {
      timeRange: fullRange,
      where: { scores: { some: { op: 'exists', path: 'spanId' } } },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'filters scores by missing span anchoring',
    request: {
      timeRange: fullRange,
      where: { scores: { some: { op: 'notExists', path: 'spanId' } } },
    },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'binds version lineage and threshold to one current score record',
    request: {
      timeRange: fullRange,
      where: {
        scores: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'entity-v2' } },
              { op: 'in', value: { path: 'parentEntityVersionId' }, set: ['parent-v2'] },
              { op: 'notIn', value: { path: 'rootEntityVersionId' }, set: ['root-v2'] },
              { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'supports missing-required-scorer anti-existence',
    request: {
      timeRange: fullRange,
      where: {
        scores: { none: { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'safety' } } },
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }],
  },
  {
    name: 'includes missing string values in negative membership predicates',
    request: {
      timeRange: fullRange,
      where: { scores: { some: { op: 'notIn', value: { path: 'scorerVersion' }, set: ['v2'] } } },
    },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'includes missing string values in negative equality predicates',
    request: {
      timeRange: fullRange,
      where: {
        scores: { some: { op: 'ne', left: { path: 'scorerVersion' }, right: { literal: 'v2' } } },
      },
    },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'binds span type and error predicates to one current span record',
    request: {
      timeRange: fullRange,
      where: {
        spans: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
              { op: 'exists', path: 'error' },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'supports anti-existence and ignores uncorrelated records',
    request: {
      timeRange: fullRange,
      where: { scores: { none: { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } } } },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }],
  },
  {
    name: 'binds none predicates to one current related record',
    request: {
      timeRange: fullRange,
      where: {
        scores: {
          none: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'factuality' } },
              { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-b' }],
  },
  {
    name: 'never correlates related records whose trace ID is null',
    request: {
      timeRange: fullRange,
      where: { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.2 } } } },
    },
    expected: [],
  },
  {
    name: 'includes current root and child spans in span relations',
    request: {
      timeRange: fullRange,
      where: { spans: { some: { op: 'exists', path: 'error' } } },
    },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }],
  },
  {
    name: 'applies span none predicates to current root and child spans',
    request: {
      timeRange: fullRange,
      where: { spans: { none: { op: 'exists', path: 'error' } } },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-b' }],
  },
  {
    name: 'allows related spans outside the root time range to participate',
    request: {
      timeRange: { from: '2026-08-05T00:00:00Z', to: '2026-08-06T00:00:00Z' },
      where: {
        spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } },
      },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'allows related scores outside the root time range to participate',
    request: {
      timeRange: { from: '2026-08-05T00:00:00Z', to: '2026-08-06T00:00:00Z' },
      where: { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } } } },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'does not resurrect an older root when the current root is pending',
    request: {
      timeRange: fullRange,
      where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-running' } },
    },
    expected: [],
  },
  {
    name: 'does not resurrect an older root when the current root is outside the requested range',
    request: {
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
      where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } },
    },
    expected: [],
  },
  {
    name: 'eq excludes traces whose nullable field is null',
    request: {
      timeRange: fullRange,
      where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-1' } },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'ne includes traces whose nullable field is null',
    request: {
      timeRange: fullRange,
      where: { op: 'ne', left: { path: 'threadId' }, right: { literal: 'thread-1' } },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }],
  },
  {
    name: 'in excludes traces whose nullable field is null',
    request: {
      timeRange: fullRange,
      where: { op: 'in', value: { path: 'resourceId' }, set: ['resource-1'] },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'notIn includes traces whose nullable field is null',
    request: {
      timeRange: fullRange,
      where: { op: 'notIn', value: { path: 'resourceId' }, set: ['resource-1'] },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-b' }],
  },
  {
    name: 'exists excludes traces whose nullable field is null',
    request: { timeRange: fullRange, where: { op: 'exists', path: 'threadId' } },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'notExists includes only traces whose nullable field is null',
    request: { timeRange: fullRange, where: { op: 'notExists', path: 'threadId' } },
    expected: [{ traceId: 'trace-d' }],
  },
  {
    name: 'matches negative numeric patient feedback outside the root time range',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } },
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'patient' } },
              { op: 'lt', left: { path: 'value' }, right: { literal: 0 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'matches clinician correction feedback',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'clinician-correction' } },
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'clinician' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'anti-matches clinician review with same-record binding and includes traces without feedback',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          none: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'clinical-review' } },
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'clinician' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'matches feedback with comments',
    request: { timeRange: fullRange, where: { feedback: { some: { op: 'exists', path: 'comment' } } } },
    expected: [{ traceId: 'trace-c' }, { traceId: 'trace-a' }],
  },
  {
    name: 'matches feedback without comments',
    request: { timeRange: fullRange, where: { feedback: { some: { op: 'notExists', path: 'comment' } } } },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'matches application-defined feedback sources in an independent feedback time range',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'clinician' } },
              { op: 'gte', left: { path: 'timestamp' }, right: { literal: '2026-08-15T00:00:00Z' } },
              { op: 'lt', left: { path: 'timestamp' }, right: { literal: '2026-09-01T00:00:00Z' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-b' }],
  },
  {
    name: 'uses only the latest feedback record when its timestamp changes',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'eq',
            left: { path: 'feedbackSource' },
            right: { literal: 'superseded-patient' },
          },
        },
      },
    },
    expected: [],
  },
  {
    name: 'applies feedback none to only the latest record when its timestamp changes',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          none: {
            op: 'eq',
            left: { path: 'feedbackSource' },
            right: { literal: 'superseded-patient' },
          },
        },
      },
    },
    expected: [{ traceId: 'trace-d' }, { traceId: 'trace-c' }, { traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'preserves string feedback values without numeric coercion',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'patient' } },
              { op: 'eq', left: { path: 'value' }, right: { literal: '3' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-b' }],
  },
  {
    name: 'does not coerce textual feedback values to numbers',
    requiresStrictFeedbackValueTypes: true,
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'patient' } },
              { op: 'eq', left: { path: 'value' }, right: { literal: 3 } },
            ],
          },
        },
      },
    },
    expected: [],
  },
  {
    name: 'treats textual feedback as unequal to a numeric literal',
    requiresStrictFeedbackValueTypes: true,
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } },
              { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'patient' } },
              { op: 'ne', left: { path: 'value' }, right: { literal: 3 } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }, { traceId: 'trace-b' }],
  },
  {
    name: 'matches feedback lineage, user, and source fields',
    request: {
      timeRange: fullRange,
      where: {
        feedback: {
          some: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'feedbackUserId' }, right: { literal: 'patient-1' } },
              { op: 'eq', left: { path: 'sourceId' }, right: { literal: 'survey-result-1' } },
              { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'entity-v2' } },
              { op: 'eq', left: { path: 'parentEntityVersionId' }, right: { literal: 'parent-v2' } },
              { op: 'eq', left: { path: 'rootEntityVersionId' }, right: { literal: 'root-v1' } },
            ],
          },
        },
      },
    },
    expected: [{ traceId: 'trace-a' }],
  },
  {
    name: 'returns distinct non-null thread groups',
    request: { timeRange: fullRange, group: { by: ['threadId'] } },
    expected: [{ threadId: 'thread-1' }, { threadId: 'thread-2' }],
  },
];

export function evaluateTraceQuery(data: TraceQueryFixtureData, plan: TrustedTraceQueryPlan): TraceQueryResponse {
  const spans = currentSpans(data.spans);
  const scores = currentScores(data.scores);
  const feedback = currentFeedback(data.feedback);
  const roots = currentRoots(data.spans)
    .filter(root => !root.isPending && root.endedAt !== null)
    .filter(root => root.startedAt >= plan.timeRange.from && root.startedAt < plan.timeRange.to)
    .filter(root => !plan.where || evaluateTracePredicate(plan.where, root, spans, scores, feedback));

  if (plan.result === 'groups') {
    let groups = [...new Set(roots.map(root => root.threadId).filter((value): value is string => value !== null))].sort(
      compareTraceQueryStrings,
    );
    if (plan.cursor) groups = groups.filter(threadId => compareTraceQueryStrings(threadId, plan.cursor!.threadId) > 0);
    const visible = groups.slice(0, plan.limit + 1);
    const hasNext = visible.length > plan.limit;
    const page = visible.slice(0, plan.limit);
    const next = hasNext ? encodeTraceQueryCursor(plan, { result: 'groups', threadId: page[page.length - 1]! }) : null;
    return { groups: page.map(threadId => ({ threadId })), page: { next } } satisfies TraceQueryGroupResponse;
  }

  let traces = roots.map(toTraceQueryTrace).sort((left, right) => compareTraces(left, right, plan));
  if (plan.cursor) traces = traces.filter(trace => isTraceAfterCursor(trace, plan));
  const visible = traces.slice(0, plan.limit + 1);
  const hasNext = visible.length > plan.limit;
  const page = visible.slice(0, plan.limit);
  const last = page[page.length - 1];
  const next =
    hasNext && last
      ? encodeTraceQueryCursor(plan, {
          result: 'traces',
          sortValue: last[plan.orderBy.field],
          traceId: last.traceId,
        })
      : null;
  return { traces: page, page: { next } } satisfies TraceQueryTraceResponse;
}

export function evaluateTraceQueryRequest(data: TraceQueryFixtureData, request: TraceQueryRequest): TraceQueryResponse {
  return evaluateTraceQuery(data, planTraceQuery(parseTraceQueryRequest(request)));
}

export function normalizeTraceQueryResponse(
  response: TraceQueryResponse,
): Array<{ traceId: string } | { threadId: string }> {
  return 'traces' in response
    ? response.traces.map(trace => ({ traceId: trace.traceId }))
    : response.groups.map(group => ({ threadId: group.threadId }));
}

export async function collectTraceQueryPages(
  execute: (request: NormalizedTraceQueryRequest) => Promise<TraceQueryResponse>,
  request: TraceQueryRequest,
): Promise<Array<{ traceId: string } | { threadId: string }>> {
  const results: Array<{ traceId: string } | { threadId: string }> = [];
  let after: string | null | undefined;
  do {
    const normalized = parseTraceQueryRequest({
      ...request,
      page: { ...request.page, after },
    });
    const response = await execute(normalized);
    results.push(...normalizeTraceQueryResponse(response));
    after = response.page.next;
  } while (after);
  return results;
}

function currentRoots(spans: RawTraceQuerySpan[]): RawTraceQuerySpan[] {
  const roots = new Map<string, RawTraceQuerySpan>();
  for (const candidate of spans) {
    if (candidate.traceId === null || candidate.parentSpanId !== null) continue;
    const current = roots.get(candidate.traceId);
    if (!current || candidate.cursorId > current.cursorId) roots.set(candidate.traceId, candidate);
  }
  return [...roots.values()];
}

function currentSpans(spans: RawTraceQuerySpan[]): RawTraceQuerySpan[] {
  const records = new Map<string, RawTraceQuerySpan>();
  for (const candidate of spans) {
    if (candidate.traceId === null) continue;
    const key = `${candidate.traceId}\u0000${candidate.spanId}`;
    const current = records.get(key);
    if (
      !current ||
      (current.isPending && !candidate.isPending) ||
      (current.isPending === candidate.isPending && candidate.cursorId > current.cursorId)
    ) {
      records.set(key, candidate);
    }
  }
  return [...records.values()];
}

function currentScores(scores: RawTraceQueryScore[]): RawTraceQueryScore[] {
  const records = new Map<string, RawTraceQueryScore>();
  for (const candidate of scores) {
    const current = records.get(candidate.scoreId);
    if (!current || candidate.cursorId > current.cursorId) records.set(candidate.scoreId, candidate);
  }
  return [...records.values()];
}

function currentFeedback(feedback: RawTraceQueryFeedback[]): RawTraceQueryFeedback[] {
  const records = new Map<string, RawTraceQueryFeedback>();
  for (const candidate of feedback) {
    const current = records.get(candidate.feedbackId);
    if (!current || candidate.cursorId > current.cursorId) records.set(candidate.feedbackId, candidate);
  }
  return [...records.values()];
}

function evaluateTracePredicate(
  predicate: TrustedTraceQueryPredicate,
  root: RawTraceQuerySpan,
  spans: RawTraceQuerySpan[],
  scores: RawTraceQueryScore[],
  feedback: RawTraceQueryFeedback[],
): boolean {
  if (predicate.type === 'relation') {
    const collection = predicate.collection === 'spans' ? spans : predicate.collection === 'scores' ? scores : feedback;
    const records = collection.filter(
      record => root.traceId !== null && record.traceId !== null && record.traceId === root.traceId,
    );
    const matched = records.some(record =>
      evaluateScalarPredicate(
        predicate.predicate,
        predicate.collection === 'spans' ? spanValues(record as RawTraceQuerySpan) : record,
      ),
    );
    return predicate.quantifier === 'some' ? matched : !matched;
  }
  if (predicate.type === 'boolean') {
    return predicate.operator === 'and'
      ? predicate.args.every(arg => evaluateTracePredicate(arg, root, spans, scores, feedback))
      : predicate.args.some(arg => evaluateTracePredicate(arg, root, spans, scores, feedback));
  }
  if (predicate.type === 'not') return !evaluateTracePredicate(predicate.arg, root, spans, scores, feedback);
  return evaluateScalarPredicate(predicate, traceValues(root));
}

function evaluateScalarPredicate(
  predicate: TrustedTraceQueryScalarPredicate,
  record: RawTraceQuerySpan | RawTraceQueryScore | RawTraceQueryFeedback | Record<string, unknown>,
): boolean {
  if (predicate.type === 'boolean') {
    return predicate.operator === 'and'
      ? predicate.args.every(arg => evaluateScalarPredicate(arg, record))
      : predicate.args.some(arg => evaluateScalarPredicate(arg, record));
  }
  if (predicate.type === 'not') return !evaluateScalarPredicate(predicate.arg, record);
  const value = record[predicate.field as keyof typeof record] as unknown;
  const missing = value === null || value === undefined;
  if (predicate.type === 'presence') return predicate.operator === 'exists' ? !missing : missing;
  if (predicate.type === 'membership') {
    if (missing) return predicate.operator === 'notIn';
    const included = predicate.values.includes(value as never);
    return predicate.operator === 'in' ? included : !included;
  }
  if (missing) return predicate.operator === 'ne';
  if (typeof value !== typeof predicate.value) return predicate.operator === 'ne';
  switch (predicate.operator) {
    case 'eq':
      return value === predicate.value;
    case 'ne':
      return value !== predicate.value;
    case 'lt':
      return value < predicate.value;
    case 'lte':
      return value <= predicate.value;
    case 'gt':
      return value > predicate.value;
    case 'gte':
      return value >= predicate.value;
  }
}

function spanValues(span: RawTraceQuerySpan): Record<string, unknown> {
  const model = typeof span.attributes?.model === 'string' ? span.attributes.model : null;
  const provider = typeof span.attributes?.provider === 'string' ? span.attributes.provider : null;
  return {
    name: span.name,
    spanType: span.spanType,
    model,
    provider,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    durationMs: span.endedAt === null ? null : new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime(),
    status: span.error === null ? 'success' : 'error',
    error: span.error,
    entityType: span.entityType,
    entityId: span.entityId,
    entityName: span.entityName,
    entityVersionId: span.entityVersionId,
    parentEntityVersionId: span.parentEntityVersionId,
    rootEntityVersionId: span.rootEntityVersionId,
  };
}

function traceValues(root: RawTraceQuerySpan): Record<string, unknown> {
  const metadata = Object.fromEntries(
    Object.entries(root.metadata ?? {}).flatMap(([key, value]) => {
      if (typeof value !== 'string' || value.trim() === '') return [];
      return [[`metadata.${key}`, value.trim()]];
    }),
  );
  return {
    traceId: root.traceId,
    threadId: root.threadId,
    resourceId: root.resourceId,
    startedAt: root.startedAt,
    endedAt: root.endedAt,
    entityName: root.entityName,
    entityType: root.entityType,
    environment: root.environment,
    status: root.error === null ? 'success' : 'error',
    ...metadata,
  };
}

function toTraceQueryTrace(root: RawTraceQuerySpan): TraceQueryTrace {
  return {
    traceId: root.traceId!,
    rootSpanId: root.spanId,
    threadId: root.threadId,
    resourceId: root.resourceId,
    startedAt: root.startedAt,
    endedAt: root.endedAt!,
    entityName: root.entityName,
    entityType: root.entityType,
    environment: root.environment,
    status: root.error === null ? 'success' : 'error',
  };
}

function compareTraces(
  left: TraceQueryTrace,
  right: TraceQueryTrace,
  plan: Extract<TrustedTraceQueryPlan, { result: 'traces' }>,
): number {
  const values = compareTraceQueryStrings(left[plan.orderBy.field], right[plan.orderBy.field]);
  if (values !== 0) return plan.orderBy.direction === 'asc' ? values : -values;
  return compareTraceQueryStrings(left.traceId, right.traceId);
}

function isTraceAfterCursor(
  trace: TraceQueryTrace,
  plan: Extract<TrustedTraceQueryPlan, { result: 'traces' }>,
): boolean {
  const cursor = plan.cursor!;
  const sortComparison = compareTraceQueryStrings(trace[plan.orderBy.field], cursor.sortValue);
  if (sortComparison === 0) return compareTraceQueryStrings(trace.traceId, cursor.traceId) > 0;
  return plan.orderBy.direction === 'asc' ? sortComparison > 0 : sortComparison < 0;
}
