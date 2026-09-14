import {
  evaluateThreadQuery,
  THREAD_QUERY_CONFORMANCE_CASES,
  THREAD_QUERY_FIXTURE_DATA,
} from '@internal/storage-test-utils';
import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import {
  encodeTraceQueryCursor,
  parseQueryThreadsInput,
  parseTraceQueryRequest,
  planThreadQuery,
  planTraceQuery,
  queryThreadsInputSchema,
  TraceQueryExecutionError,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { generateOpenAPIDocument } from '../server-adapter/openapi-utils';
import { OBSERVABILITY_ROUTES } from '../server-adapter/routes/observability';
import { QUERY_THREADS } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

const TIME_RANGE = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

function createHarness(features: string[] = ['thread-query']) {
  const observabilityStore = {
    getFeatures: vi.fn(() => features),
    queryThreads: vi.fn().mockResolvedValue({ threads: [], page: { next: null } }),
  };
  const getStore = vi.fn().mockResolvedValue(observabilityStore);
  const mastra = {
    getStorage: vi.fn(() => ({ getStore })),
  } as unknown as Mastra;
  return { observabilityStore, getStore, mastra };
}

function params(mastra: Mastra, request: unknown) {
  return {
    ...createTestServerContext({ mastra }),
    ...queryThreadsInputSchema.parse(request),
  };
}

async function captureHttpException(call: Promise<unknown>) {
  try {
    await call;
    throw new Error('Expected request to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HTTPException);
    return error as HTTPException;
  }
}

function getDeclaredErrorSchema(status: 400 | 409 | 413 | 422 | 501 | 504): z.ZodTypeAny {
  const schema = QUERY_THREADS.openapi?.responses[status]?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`Missing OpenAPI error schema for ${status}`);
  return schema as z.ZodTypeAny;
}

describe('QUERY_THREADS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a structured 501 when the installed core lacks advanced observability endpoints', async () => {
    const { mastra, getStore } = createHarness();
    coreFeatures.delete('observability:v1.13.2');

    try {
      const error = await captureHttpException(
        QUERY_THREADS.handler(params(mastra, { traces: { timeRange: TIME_RANGE } })),
      );

      expect(error.status).toBe(501);
      expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
        code: 'TRACE_QUERY_UNSUPPORTED',
        message: 'New observability endpoints require @mastra/core >= 1.13.2, please upgrade.',
      });
      expect(getStore).not.toHaveBeenCalled();
    } finally {
      coreFeatures.add('observability:v1.13.2');
    }
  });

  it('plans eligibility and thread predicates before using the request-available store', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    observabilityStore.queryThreads.mockResolvedValue({
      threads: [{ threadId: 'thread-1' }],
      page: { next: null },
    });
    const request = {
      traces: {
        timeRange: TIME_RANGE,
        where: { op: 'eq' as const, left: { path: 'environment' }, right: { literal: 'production' } },
      },
      where: {
        op: 'and' as const,
        args: [
          {
            traces: {
              some: {
                scores: {
                  some: { op: 'lt' as const, left: { path: 'score' }, right: { literal: 0.6 } },
                },
              },
            },
          },
          {
            traces: {
              some: {
                feedback: {
                  some: {
                    op: 'eq' as const,
                    left: { path: 'feedbackType' },
                    right: { literal: 'clinician-correction' },
                  },
                },
              },
            },
          },
        ],
      },
      page: { limit: 25 },
    };

    const response = await QUERY_THREADS.handler(params(mastra, request));

    expect(response).toEqual({ threads: [{ threadId: 'thread-1' }], page: { next: null } });
    expect(Object.keys(response.threads[0]!)).toEqual(['threadId']);
    expect(getStore).toHaveBeenCalledWith('observability');
    const plan = observabilityStore.queryThreads.mock.calls[0]![0];
    expect(plan).toMatchObject({
      result: 'threads',
      traces: {
        where: { type: 'comparison', field: 'environment', operator: 'eq', value: 'production' },
      },
      where: { type: 'boolean', operator: 'and' },
      orderBy: { field: 'threadId', direction: 'asc' },
      limit: 25,
      binding: expect.any(String),
    });
    expect(plan.traces.timeRange).toEqual({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });
  });

  it.each([
    'qualifies a thread with evidence on different traces',
    'does not combine different traces inside one traces.some',
  ])('preserves the shared semantics: %s', async name => {
    const testCase = THREAD_QUERY_CONFORMANCE_CASES.find(candidate => candidate.name === name);
    if (!testCase) throw new Error(`Missing conformance case: ${name}`);
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.queryThreads.mockImplementation(plan =>
      Promise.resolve(evaluateThreadQuery(THREAD_QUERY_FIXTURE_DATA, plan)),
    );

    const response = await QUERY_THREADS.handler(params(mastra, testCase.request));

    expect(response.threads).toEqual(testCase.expected);
    for (const thread of response.threads) expect(Object.keys(thread)).toEqual(['threadId']);
  });

  it('rejects invalid nested predicates before storage access without echoing literals', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const error = await captureHttpException(
      QUERY_THREADS.handler(
        params(mastra, {
          traces: { timeRange: TIME_RANGE },
          where: {
            traces: {
              some: {
                scores: {
                  some: {
                    op: 'eq',
                    left: { path: 'feedbackType' },
                    right: { literal: 'sensitive-value' },
                  },
                },
              },
            },
          },
        }),
      ),
    );

    expect(error.status).toBe(422);
    const body = await error.getResponse().json();
    expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID' });
    expect(JSON.stringify(body)).not.toContain('sensitive-value');
    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.queryThreads).not.toHaveBeenCalled();
  });

  it('distinguishes malformed, conflicting, and legacy grouped cursors before storage access', async () => {
    const malformedHarness = createHarness();
    const malformed = await captureHttpException(
      QUERY_THREADS.handler(
        params(malformedHarness.mastra, { traces: { timeRange: TIME_RANGE }, page: { after: 'not-a-cursor' } }),
      ),
    );
    expect(malformed.status).toBe(400);
    expect(getDeclaredErrorSchema(400).parse(await malformed.getResponse().json())).toMatchObject({
      code: 'TRACE_QUERY_CURSOR_MALFORMED',
    });
    expect(malformedHarness.getStore).not.toHaveBeenCalled();

    const original = planThreadQuery(parseQueryThreadsInput({ traces: { timeRange: TIME_RANGE } }));
    const cursor = encodeTraceQueryCursor(original, { result: 'threads', threadId: 'thread-1' });
    const conflictHarness = createHarness();
    const conflict = await captureHttpException(
      QUERY_THREADS.handler(
        params(conflictHarness.mastra, {
          traces: {
            timeRange: TIME_RANGE,
            where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
          },
          page: { after: cursor },
        }),
      ),
    );
    expect(conflict.status).toBe(409);
    expect(conflictHarness.getStore).not.toHaveBeenCalled();

    const groupedPlan = planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, group: { by: ['threadId'] } }));
    const groupedCursor = encodeTraceQueryCursor(groupedPlan, { result: 'groups', threadId: 'thread-1' });
    const legacyHarness = createHarness();
    const legacy = await captureHttpException(
      QUERY_THREADS.handler(
        params(legacyHarness.mastra, { traces: { timeRange: TIME_RANGE }, page: { after: groupedCursor } }),
      ),
    );
    expect(legacy.status).toBe(409);
    expect(legacyHarness.getStore).not.toHaveBeenCalled();
  });

  it('requires the thread-query capability and does not accept trace-query alone', async () => {
    for (const features of [[], ['trace-query']]) {
      const { mastra, observabilityStore } = createHarness(features);
      const error = await captureHttpException(
        QUERY_THREADS.handler(params(mastra, { traces: { timeRange: TIME_RANGE } })),
      );

      expect(error.status).toBe(501);
      expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
        code: 'TRACE_QUERY_UNSUPPORTED',
        message: 'Advanced thread queries are not supported by the configured observability store',
      });
      expect(observabilityStore.queryThreads).not.toHaveBeenCalled();
    }
  });

  it('returns the structured unsupported response when observability storage is unavailable', async () => {
    const mastra = {
      getStorage: vi.fn(() => ({ getStore: vi.fn().mockResolvedValue(undefined) })),
    } as unknown as Mastra;
    const error = await captureHttpException(
      QUERY_THREADS.handler(params(mastra, { traces: { timeRange: TIME_RANGE } })),
    );

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_UNSUPPORTED',
      message: 'Observability storage domain is not available',
    });
  });

  it('returns a structured 504 without exposing database errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.queryThreads.mockRejectedValue(new TraceQueryExecutionError());

    const error = await captureHttpException(
      QUERY_THREADS.handler(params(mastra, { traces: { timeRange: TIME_RANGE } })),
    );

    expect(error.status).toBe(504);
    const body = await error.getResponse().json();
    expect(getDeclaredErrorSchema(504).parse(body)).toEqual({
      code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
      message: 'The trace query exceeded its execution timeout',
    });
    expect(JSON.stringify(body)).not.toContain('driver');
  });

  it('publishes strict runtime and OpenAPI schemas with the observability read permission', () => {
    expect(QUERY_THREADS.requiresAuth).toBe(true);
    expect(QUERY_THREADS.requiresPermission).toBe('observability:read');
    expect(QUERY_THREADS.method).toBe('POST');
    expect(QUERY_THREADS.path).toBe('/observability/threads/query');
    expect(OBSERVABILITY_ROUTES).toContain(QUERY_THREADS);
    expect(QUERY_THREADS.maxBodySize).toBe(256 * 1024);
    expect(Object.keys(QUERY_THREADS.openapi?.responses ?? {})).toEqual([
      '200',
      '400',
      '409',
      '413',
      '422',
      '501',
      '504',
    ]);

    const parsed = queryThreadsInputSchema.safeParse({ traces: { timeRange: TIME_RANGE }, count: true });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected strict validation failure');
    const validation = QUERY_THREADS.onValidationError?.(parsed.error, 'body');
    expect(validation?.status).toBe(422);
    expect(getDeclaredErrorSchema(422).parse(validation?.body)).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      issues: [{ code: 'invalid_request' }],
    });

    const document = generateOpenAPIDocument([QUERY_THREADS], { title: 'Test', version: '1.0.0' });
    const responses = document.paths['/observability/threads/query'].post.responses;
    for (const status of ['400', '409', '413', '422', '501', '504']) {
      expect(responses[status].content['application/json'].schema).toBeDefined();
    }
    expect(responses['400'].content['application/json'].schema.anyOf).toHaveLength(2);
    expect(responses['409'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_QUERY_CURSOR_CONFLICT',
    );
    expect(responses['413'].content['application/json'].schema.properties.error.const).toBe('Request body too large');
    expect(responses['422'].content['application/json'].schema.properties.issues.type).toBe('array');
    expect(responses['501'].content['application/json'].schema.properties.code.const).toBe('TRACE_QUERY_UNSUPPORTED');
    expect(responses['504'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_QUERY_EXECUTION_TIMEOUT',
    );
  });
});
