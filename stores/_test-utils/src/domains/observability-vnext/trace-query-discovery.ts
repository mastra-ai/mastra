import { TRACE_QUERY_MAX_PATH_BYTES, TRACE_QUERY_MAX_STRING_BYTES } from '@mastra/core/storage';

import type {
  RawTraceQueryFeedback,
  RawTraceQueryScore,
  RawTraceQuerySpan,
  TraceQueryFixtureData,
} from './trace-query';

const BASE_SPAN: Omit<RawTraceQuerySpan, 'cursorId' | 'traceId' | 'spanId'> = {
  parentSpanId: null,
  isPending: false,
  name: 'support-agent',
  spanType: 'agent_run',
  attributes: null,
  metadata: null,
  error: null,
  threadId: null,
  resourceId: null,
  startedAt: '2026-08-10T10:00:00.000Z',
  endedAt: '2026-08-10T10:00:01.000Z',
  entityType: 'agent',
  entityId: 'agent-1',
  entityName: 'support-agent',
  entityVersionId: 'agent-v1',
  parentEntityVersionId: null,
  rootEntityVersionId: 'agent-v1',
  environment: 'production',
};

const span = (
  cursorId: number,
  traceId: string | null,
  spanId: string,
  overrides: Partial<RawTraceQuerySpan> = {},
): RawTraceQuerySpan => ({ ...BASE_SPAN, cursorId, traceId, spanId, ...overrides });

const score = (
  cursorId: number,
  scoreId: string,
  traceId: string | null,
  overrides: Partial<RawTraceQueryScore> = {},
): RawTraceQueryScore => ({
  cursorId,
  scoreId,
  traceId,
  spanId: null,
  timestamp: '2026-08-10T10:00:01.000Z',
  scorerId: 'quality',
  scorerVersion: 'v1',
  scoreSource: 'automated',
  score: 0.9,
  entityVersionId: null,
  parentEntityVersionId: null,
  rootEntityVersionId: null,
  ...overrides,
});

const feedback = (
  cursorId: number,
  feedbackId: string,
  traceId: string | null,
  overrides: Partial<RawTraceQueryFeedback> = {},
): RawTraceQueryFeedback => ({
  cursorId,
  feedbackId,
  traceId,
  timestamp: '2026-08-10T10:00:01.000Z',
  feedbackType: 'thumbs',
  feedbackSource: 'user',
  feedbackUserId: null,
  sourceId: null,
  value: 'up',
  comment: null,
  entityVersionId: null,
  parentEntityVersionId: null,
  rootEntityVersionId: null,
  ...overrides,
});

export const TRACE_QUERY_DISCOVERY_TIME_RANGE = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-09-01T00:00:00.000Z',
};

export const TRACE_QUERY_DISCOVERY_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    span(1, 'trace-a', 'root-a-old', {
      startedAt: '2026-08-02T10:00:00.000Z',
      metadata: { superseded: 'old' },
      environment: 'development',
    }),
    span(10, 'trace-a', 'root-a', {
      metadata: {
        region: 'us-west-2',
        customer: 'acme',
        literalPattern: '%prod_',
        'percent%key': 'percent',
        under_score: 'underscore',
        nested: { plan: 'pro' },
        active: true,
        retries: 2,
        'dotted.key': 'unsupported',
        '': 'unsupported',
        ['k'.repeat(TRACE_QUERY_MAX_PATH_BYTES)]: 'oversized-key',
        oversizedValue: 'v'.repeat(TRACE_QUERY_MAX_STRING_BYTES + 1),
      },
    }),
    span(11, 'trace-a', 'span-model-a', {
      parentSpanId: 'root-a',
      isPending: true,
      endedAt: null,
      name: 'old-model-call',
      spanType: 'model_generation',
      attributes: { model: 'superseded-model', provider: 'old-provider' },
    }),
    span(12, 'trace-a', 'span-model-a', {
      parentSpanId: 'root-a',
      name: 'model-call',
      spanType: 'model_generation',
      attributes: { model: 'claude-sonnet-4-6', provider: 'anthropic' },
    }),
    span(20, 'trace-b', 'root-b', {
      startedAt: '2026-08-11T10:00:00.000Z',
      metadata: { region: 'us-west-2', customer: 'beta', literalPattern: 'ordinary' },
      environment: 'staging',
    }),
    span(21, 'trace-b', 'span-model-b', {
      parentSpanId: 'root-b',
      name: 'model-call',
      spanType: 'model_generation',
      attributes: { model: 'claude-sonnet-4-6', provider: 'anthropic' },
    }),
    span(30, 'trace-c', 'root-c', {
      startedAt: '2026-08-12T10:00:00.000Z',
      metadata: { region: 'eu-west-1', customer: 'acme' },
      error: { message: 'failed' },
    }),
    span(31, 'trace-c', 'span-model-c', {
      parentSpanId: 'root-c',
      name: 'fallback-call',
      spanType: 'model_generation',
      attributes: { model: 'gpt-5', provider: 'openai' },
    }),
    span(40, 'trace-pending', 'root-pending', {
      isPending: true,
      startedAt: '2026-08-13T10:00:00.000Z',
      endedAt: null,
      metadata: { pendingOnly: 'excluded' },
    }),
    span(50, 'trace-outside', 'root-outside', {
      startedAt: '2026-07-01T10:00:00.000Z',
      metadata: { outsideOnly: 'excluded' },
    }),
  ],
  scores: [
    score(1, 'score-a', 'trace-a'),
    score(2, 'score-b', 'trace-b'),
    score(3, 'score-c', 'trace-c', { scorerId: 'safety', scorerVersion: 'v2', scoreSource: 'manual' }),
    score(4, 'score-outside', 'trace-outside', { scorerId: 'excluded' }),
  ],
  feedback: [
    feedback(1, 'feedback-a', 'trace-a'),
    feedback(2, 'feedback-b', 'trace-b'),
    feedback(3, 'feedback-c', 'trace-c', { feedbackType: 'rating', feedbackSource: 'system' }),
    feedback(4, 'feedback-outside', 'trace-outside', { feedbackType: 'excluded' }),
  ],
};
