import {
  evaluateTraceQuery,
  normalizeTraceQueryResponse,
  TRACE_QUERY_CONFORMANCE_CASES,
  TRACE_QUERY_FIXTURE_DATA,
} from '@internal/storage-test-utils';
import type { Mastra } from '@mastra/core';
import {
  encodeTraceQueryCursor,
  TraceQueryExecutionError,
  parseTraceQueryRequest,
  planTraceQuery,
  traceQueryRequestSchema,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { generateOpenAPIDocument } from '../server-adapter/openapi-utils';
import { QUERY_TRACES } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

const TIME_RANGE = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

function createHarness(features: string[] = ['trace-query']) {
  const observabilityStore = {
    getFeatures: vi.fn(() => features),
    queryTraces: vi.fn().mockResolvedValue({ traces: [], page: { next: null } }),
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
    ...traceQueryRequestSchema.parse(request),
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
  const schema = QUERY_TRACES.openapi?.responses[status]?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`Missing OpenAPI error schema for ${status}`);
  return schema as z.ZodTypeAny;
}

describe('QUERY_TRACES', () => {
  beforeEach(() => vi.clearAllMocks());

  it('plans the complete request before using the request-available store', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    observabilityStore.queryTraces.mockResolvedValue({
      traces: [
        {
          traceId: 'trace-a',
          rootSpanId: 'root-a',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          startedAt: '2026-08-20T10:00:00.000Z',
          endedAt: '2026-08-20T10:00:01.000Z',
          entityName: 'agent',
          entityType: 'agent',
          environment: 'production',
          status: 'success',
        },
      ],
      page: { next: null },
    });

    const response = await QUERY_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { op: 'eq', left: { path: 'resourceId' }, right: { literal: 'resource-1' } },
      }),
    );

    expect(response).toMatchObject({ traces: [{ traceId: 'trace-a' }] });
    if (!('traces' in response)) throw new Error('Expected trace results');
    expect(Object.keys(response.traces[0]!)).toHaveLength(10);
    expect(response.traces[0]).not.toHaveProperty('scores');
    expect(getStore).toHaveBeenCalledWith('observability');
    expect(observabilityStore.queryTraces).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'traces', limit: 100, binding: expect.any(String) }),
    );
  });

  it('passes richer span predicates through without adding matching evidence', async () => {
    const { mastra, observabilityStore } = createHarness();
    const response = await QUERY_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: {
          spans: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } },
                { op: 'eq', left: { path: 'model' }, right: { literal: 'claude-sonnet-4-6' } },
                { op: 'eq', left: { path: 'provider' }, right: { literal: 'anthropic' } },
                { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } },
                { op: 'exists', path: 'error' },
              ],
            },
          },
        },
      }),
    );

    expect(observabilityStore.queryTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'relation',
          collection: 'spans',
          quantifier: 'some',
          predicate: expect.objectContaining({ type: 'boolean', operator: 'and' }),
        }),
      }),
    );
    expect(response).toEqual({ traces: [], page: { next: null } });
    expect(response).not.toHaveProperty('spans');
    expect(response).not.toHaveProperty('matches');
  });

  it('passes feedback predicates through without adding matching evidence', async () => {
    const { mastra, observabilityStore } = createHarness();
    const response = await QUERY_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: {
          feedback: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } },
                { op: 'lt', left: { path: 'value' }, right: { literal: 0 } },
              ],
            },
          },
        },
      }),
    );

    expect(observabilityStore.queryTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'relation',
          collection: 'feedback',
          quantifier: 'some',
          predicate: expect.objectContaining({ type: 'boolean', operator: 'and' }),
        }),
      }),
    );
    expect(response).toEqual({ traces: [], page: { next: null } });
    expect(response).not.toHaveProperty('feedback');
    expect(response).not.toHaveProperty('matches');
  });

  it('passes conversation predicates through as a separate group qualification plan', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.queryTraces.mockResolvedValue({ groups: [], page: { next: null } });

    const response = await QUERY_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        group: {
          by: ['threadId'],
          where: {
            traces: {
              some: {
                feedback: {
                  some: {
                    op: 'eq',
                    left: { path: 'feedbackType' },
                    right: { literal: 'clinician-correction' },
                  },
                },
              },
            },
          },
        },
      }),
    );

    expect(observabilityStore.queryTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'groups',
        groupWhere: expect.objectContaining({
          type: 'relation',
          collection: 'traces',
          quantifier: 'some',
        }),
      }),
    );
    expect(response).toEqual({ groups: [], page: { next: null } });
  });

  it('preserves the shared canonical semantics and fixed response projections', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.queryTraces.mockImplementation(plan => evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, plan));

    for (const testCase of TRACE_QUERY_CONFORMANCE_CASES) {
      const response = await QUERY_TRACES.handler(params(mastra, testCase.request));
      expect(normalizeTraceQueryResponse(response), testCase.name).toEqual(testCase.expected);
    }
  });

  it('returns stable semantic issues without touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const error = await captureHttpException(
      QUERY_TRACES.handler(
        params(mastra, {
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'input' }, right: { literal: 'sensitive search' } },
        }),
      ),
    );

    expect(error.status).toBe(422);
    const body = getDeclaredErrorSchema(422).parse(await error.getResponse().json());
    expect(body).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      issues: [{ code: 'field_not_allowed', path: ['where', 'left', 'path'] }],
    });
    expect(JSON.stringify(body)).not.toContain('sensitive search');
    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.queryTraces).not.toHaveBeenCalled();
  });

  it('passes metadata keys through regardless of their names', async () => {
    const { mastra, observabilityStore } = createHarness();
    await QUERY_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { op: 'eq', left: { path: 'metadata.api-key' }, right: { literal: 'sensitive-value' } },
      }),
    );

    expect(observabilityStore.queryTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'comparison',
          field: 'metadata.api-key',
          operator: 'eq',
          value: 'sensitive-value',
        },
      }),
    );
  });

  it('rejects invalid score operators and literals before touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const cases = [
      {
        predicate: { op: 'lt', left: { path: 'scoreSource' }, right: { literal: 'sensitive-source' } },
        issue: { code: 'operator_not_allowed', path: ['where', 'scores', 'some', 'op'] },
      },
      {
        predicate: { op: 'eq', left: { path: 'spanId' }, right: { literal: 'sensitive-span' } },
        issue: { code: 'operator_not_allowed', path: ['where', 'scores', 'some', 'op'] },
      },
      {
        predicate: { op: 'lt', left: { path: 'score' }, right: { literal: '0.6-sensitive' } },
        issue: { code: 'invalid_literal', path: ['where', 'scores', 'some', 'right', 'literal'] },
      },
      {
        predicate: { op: 'gte', left: { path: 'timestamp' }, right: { literal: 'sensitive-date' } },
        issue: { code: 'invalid_literal', path: ['where', 'scores', 'some', 'right', 'literal'] },
      },
    ];

    for (const testCase of cases) {
      const error = await captureHttpException(
        QUERY_TRACES.handler(
          params(mastra, {
            timeRange: TIME_RANGE,
            where: { scores: { some: testCase.predicate } },
          }),
        ),
      );
      expect(error.status).toBe(422);
      const body = await error.getResponse().json();
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID' });
      expect(body.issues).toContainEqual(expect.objectContaining(testCase.issue));
      expect(JSON.stringify(body)).not.toContain('sensitive');
    }

    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.queryTraces).not.toHaveBeenCalled();
  });

  it('rejects invalid richer span operators and literals before touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const cases = [
      {
        predicate: { op: 'lt', left: { path: 'model' }, right: { literal: 'sensitive-model' } },
        issue: { code: 'operator_not_allowed', path: ['where', 'spans', 'some', 'op'] },
      },
      {
        predicate: { op: 'eq', left: { path: 'error' }, right: { literal: 'sensitive-error' } },
        issue: { code: 'operator_not_allowed', path: ['where', 'spans', 'some', 'op'] },
      },
      {
        predicate: { op: 'gt', left: { path: 'durationMs' }, right: { literal: '5000-sensitive' } },
        issue: { code: 'invalid_literal', path: ['where', 'spans', 'some', 'right', 'literal'] },
      },
      {
        predicate: { op: 'gte', left: { path: 'startedAt' }, right: { literal: 'sensitive-date' } },
        issue: { code: 'invalid_literal', path: ['where', 'spans', 'some', 'right', 'literal'] },
      },
    ];

    for (const testCase of cases) {
      const error = await captureHttpException(
        QUERY_TRACES.handler(
          params(mastra, {
            timeRange: TIME_RANGE,
            where: { spans: { some: testCase.predicate } },
          }),
        ),
      );
      expect(error.status).toBe(422);
      const body = await error.getResponse().json();
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID' });
      expect(body.issues).toContainEqual(expect.objectContaining(testCase.issue));
      expect(JSON.stringify(body)).not.toContain('sensitive');
    }

    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.queryTraces).not.toHaveBeenCalled();
  });

  it('rejects invalid feedback value types before touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const cases = [
      {
        predicate: { op: 'in', value: { path: 'value' }, set: [3, 'sensitive-3'] },
        issue: { code: 'invalid_literal', path: ['where', 'feedback', 'some', 'set'] },
      },
      {
        predicate: { op: 'lt', left: { path: 'value' }, right: { literal: 'sensitive-3' } },
        issue: { code: 'invalid_literal', path: ['where', 'feedback', 'some', 'right', 'literal'] },
      },
    ];

    for (const testCase of cases) {
      const error = await captureHttpException(
        QUERY_TRACES.handler(
          params(mastra, {
            timeRange: TIME_RANGE,
            where: { feedback: { some: testCase.predicate } },
          }),
        ),
      );
      expect(error.status).toBe(422);
      const body = await error.getResponse().json();
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID' });
      expect(body.issues).toContainEqual(expect.objectContaining(testCase.issue));
      expect(JSON.stringify(body)).not.toContain('sensitive');
    }

    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.queryTraces).not.toHaveBeenCalled();
  });

  it('distinguishes malformed cursors from changed-query conflicts', async () => {
    const malformedHarness = createHarness();
    const malformed = await captureHttpException(
      QUERY_TRACES.handler(params(malformedHarness.mastra, { timeRange: TIME_RANGE, page: { after: 'not-a-cursor' } })),
    );
    expect(malformed.status).toBe(400);
    expect(getDeclaredErrorSchema(400).parse(await malformed.getResponse().json())).toMatchObject({
      code: 'TRACE_QUERY_CURSOR_MALFORMED',
    });
    expect(malformedHarness.getStore).not.toHaveBeenCalled();

    const original = planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE }));
    const after = encodeTraceQueryCursor(original, {
      result: 'traces',
      sortValue: '2026-08-20T10:00:00.000Z',
      traceId: 'trace-a',
    });
    const conflictHarness = createHarness();
    const conflict = await captureHttpException(
      QUERY_TRACES.handler(
        params(conflictHarness.mastra, {
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-1' } },
          page: { after },
        }),
      ),
    );
    expect(conflict.status).toBe(409);
    expect(getDeclaredErrorSchema(409).parse(await conflict.getResponse().json())).toMatchObject({
      code: 'TRACE_QUERY_CURSOR_CONFLICT',
    });
    expect(conflictHarness.getStore).not.toHaveBeenCalled();
  });

  it('returns a structured 504 without exposing database errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.queryTraces.mockRejectedValue(new TraceQueryExecutionError());

    const error = await captureHttpException(QUERY_TRACES.handler(params(mastra, { timeRange: TIME_RANGE })));

    expect(error.status).toBe(504);
    expect(getDeclaredErrorSchema(504).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
      message: 'The trace query exceeded its execution timeout',
    });
  });

  it('returns 501 when the request-available store lacks trace-query support', async () => {
    const { mastra, observabilityStore } = createHarness([]);
    const error = await captureHttpException(QUERY_TRACES.handler(params(mastra, { timeRange: TIME_RANGE })));

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_UNSUPPORTED',
      message: 'Advanced trace queries are not supported by the configured observability store',
    });
    expect(observabilityStore.queryTraces).not.toHaveBeenCalled();
  });

  it('returns the same structured 501 when observability storage is unavailable', async () => {
    const mastra = {
      getStorage: vi.fn(() => ({ getStore: vi.fn().mockResolvedValue(undefined) })),
    } as unknown as Mastra;
    const error = await captureHttpException(QUERY_TRACES.handler(params(mastra, { timeRange: TIME_RANGE })));

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_UNSUPPORTED',
      message: 'Observability storage domain is not available',
    });
  });

  it('publishes strict runtime and OpenAPI schemas with the observability read permission', () => {
    expect(QUERY_TRACES.requiresAuth).toBe(true);
    expect(QUERY_TRACES.requiresPermission).toBe('observability:read');
    expect(QUERY_TRACES.method).toBe('POST');
    expect(QUERY_TRACES.path).toBe('/observability/traces/query');
    expect(QUERY_TRACES.openapi).toBeDefined();
    expect(QUERY_TRACES.maxBodySize).toBe(256 * 1024);
    expect(Object.keys(QUERY_TRACES.openapi?.responses ?? {})).toEqual([
      '200',
      '400',
      '409',
      '413',
      '422',
      '501',
      '504',
    ]);

    const parsed = traceQueryRequestSchema.safeParse({ timeRange: TIME_RANGE, authorization: { resourceId: 'x' } });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected strict validation failure');
    const validation = QUERY_TRACES.onValidationError?.(parsed.error, 'body');
    expect(validation?.status).toBe(422);
    expect(getDeclaredErrorSchema(422).parse(validation?.body)).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      issues: [{ code: 'invalid_request' }],
    });

    const document = generateOpenAPIDocument([QUERY_TRACES], { title: 'Test', version: '1.0.0' });
    const operation = document.paths['/observability/traces/query'].post;
    const requestSchema = JSON.stringify(operation.requestBody.content['application/json'].schema);
    expect(requestSchema).toContain('"feedback"');
    expect(requestSchema).toContain('"traces"');
    expect(requestSchema).toContain('"group"');
    expect(requestSchema).toContain('"some"');
    expect(requestSchema).toContain('"none"');
    expect(requestSchema).not.toContain('"source":');
    expect(requestSchema).not.toContain('"userId":');

    const responses = operation.responses;
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
