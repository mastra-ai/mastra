import {
  compareTraceQueryStrings,
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  type NormalizedTraceQueryRequest,
  type TraceQueryGroupResponse,
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
  spanType: string;
  error: unknown | null;
  threadId: string | null;
  resourceId: string | null;
  startedAt: string;
  endedAt: string | null;
  entityName: string | null;
  entityType: string | null;
  environment: string | null;
}

export interface RawTraceQueryScore {
  cursorId: number;
  scoreId: string;
  traceId: string | null;
  scorerId: string;
  score: number | null;
  timestamp?: string;
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
  spanType: 'agent_run',
  error: null,
  threadId: null,
  resourceId: null,
  startedAt: '2026-08-10T00:00:00.000Z',
  endedAt: '2026-08-10T00:00:01.000Z',
  entityName: 'agent',
  entityType: 'agent',
  environment: 'production',
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
    }),
    span(11, 'trace-a', 'span-a-tool', {
      parentSpanId: 'root-a',
      spanType: 'tool_call',
      startedAt: '2026-08-05T10:00:00.500Z',
      endedAt: '2026-08-05T10:00:01.000Z',
    }),
    span(12, 'trace-a', 'span-a-tool', {
      parentSpanId: 'root-a',
      spanType: 'tool_call',
      error: { message: 'latest failed attempt' },
      startedAt: '2026-08-05T10:00:00.500Z',
      endedAt: '2026-08-05T10:00:01.500Z',
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
      spanType: 'tool_call',
      error: null,
    }),
    span(30, 'trace-c', 'root-c', {
      threadId: 'thread-2',
      resourceId: null,
      startedAt: '2026-08-07T10:00:00.000Z',
      endedAt: '2026-08-07T10:00:02.000Z',
      error: { message: 'root failed' },
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
      spanType: 'tool_call',
      error: { message: 'must not correlate' },
    }),
  ],
  scores: [
    { cursorId: 1, scoreId: 'score-a-factuality', traceId: 'trace-a', scorerId: 'factuality', score: 0.9 },
    { cursorId: 2, scoreId: 'score-a-factuality', traceId: 'trace-a', scorerId: 'factuality', score: 0.4 },
    { cursorId: 3, scoreId: 'score-a-safety', traceId: 'trace-a', scorerId: 'safety', score: 0.95 },
    { cursorId: 4, scoreId: 'score-b-factuality', traceId: 'trace-b', scorerId: 'factuality', score: 0.9 },
    { cursorId: 5, scoreId: 'score-b-safety', traceId: 'trace-b', scorerId: 'safety', score: 0.4 },
    { cursorId: 6, scoreId: 'score-c-factuality', traceId: 'trace-c', scorerId: 'factuality', score: null },
    { cursorId: 7, scoreId: 'score-uncorrelated', traceId: null, scorerId: 'factuality', score: 0.1 },
  ],
  feedback: [
    feedbackRecord(1, 'feedback-a-rating', 'trace-a', 'rating', 'patient', -1, {
      timestamp: '2026-07-15T10:00:00.000Z',
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
    {
      cursorId: 100,
      scoreId: 'score-tied',
      traceId: 'trace-tied',
      scorerId: 'factuality',
      score: 0.9,
      timestamp: tiedScoreTimestamp,
    },
    {
      cursorId: 101,
      scoreId: 'score-tied',
      traceId: 'trace-tied',
      scorerId: 'factuality',
      score: 0.2,
      timestamp: tiedScoreTimestamp,
    },
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
    const key = `${candidate.feedbackId}\u0000${candidate.timestamp}`;
    const current = records.get(key);
    if (!current || candidate.cursorId > current.cursorId) records.set(key, candidate);
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
    const matched = records.some(record => evaluateScalarPredicate(predicate.predicate, record));
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

function traceValues(root: RawTraceQuerySpan): Record<string, unknown> {
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
