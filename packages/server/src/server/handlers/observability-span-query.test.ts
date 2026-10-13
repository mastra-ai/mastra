import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import {
  encodeSpanQueryCursor,
  planSpanQuery,
  spanQueryRequestSchema,
  TraceQueryCursorError,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { generateOpenAPIDocument } from '../server-adapter/openapi-utils';
import { OBSERVABILITY_ROUTES } from '../server-adapter/routes/observability';
import { QUERY_SPANS } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

const TIME_RANGE = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
const PLANNED_TIME_RANGE = { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' };
const CURSOR_VALUES = {
  sortValue: '2026-08-15T00:00:00.000Z',
  organizationId: null,
  resourceId: null,
  traceId: 'trace-1',
  spanId: 'span-1',
};

function createHarness(features: string[] = ['span-query', 'trace-query-tenant-scope']) {
  const observabilityStore = {
    getFeatures: vi.fn(() => features),
    querySpans: vi.fn().mockResolvedValue({ spans: [], page: { next: null } }),
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
    ...spanQueryRequestSchema.parse(request),
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

function getDeclaredErrorSchema(status: 400 | 409 | 413 | 422 | 501 | 503 | 504): z.ZodTypeAny {
  const schema = QUERY_SPANS.openapi?.responses[status]?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`Missing OpenAPI error schema for ${status}`);
  return schema as z.ZodTypeAny;
}

function strictValidationError(request: unknown) {
  const parsed = spanQueryRequestSchema.safeParse(request);
  if (parsed.success) throw new Error('Expected strict validation failure');
  return QUERY_SPANS.onValidationError?.(parsed.error, 'body');
}

describe('QUERY_SPANS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the trusted plan to the request-available store and returns its response unchanged', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const response = {
      spans: [
        {
          organizationId: null,
          resourceId: null,
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          name: 'weather-tool',
          spanType: 'tool_call',
          status: 'error',
          startedAt: '2026-08-15T00:00:00.000Z',
          endedAt: '2026-08-15T00:00:01.000Z',
          durationMs: 1000,
          entityType: 'tool',
          entityId: 'weather-tool',
          entityName: 'weather-tool',
          model: null,
          provider: null,
          inputPreview: '{"city":"Paris"}',
          inputTruncated: false,
          outputPreview: null,
          outputTruncated: false,
          cost: { state: 'missing' },
        },
      ],
      page: { next: null },
    };
    observabilityStore.querySpans.mockResolvedValue(response);

    const result = await QUERY_SPANS.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
        orderBy: [{ field: 'endedAt', direction: 'asc' }],
        page: { limit: 25 },
      }),
    );

    expect(result).toBe(response);
    expect(getStore).toHaveBeenCalledWith('observability');
    expect(observabilityStore.querySpans).toHaveBeenCalledOnce();
    expect(observabilityStore.querySpans).toHaveBeenCalledWith({
      result: 'spans',
      timeRange: PLANNED_TIME_RANGE,
      where: { type: 'comparison', field: 'status', operator: 'eq', value: 'error' },
      scope: undefined,
      orderBy: { field: 'endedAt', direction: 'asc' },
      limit: 25,
      binding: expect.any(String),
      cursor: undefined,
    });
  });

  it('resumes after a cursor issued for the same query', async () => {
    const { mastra, observabilityStore } = createHarness();
    const after = encodeSpanQueryCursor(planSpanQuery({ timeRange: TIME_RANGE }), CURSOR_VALUES);

    await QUERY_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, page: { limit: 10, after } }));

    expect(observabilityStore.querySpans).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, cursor: CURSOR_VALUES }),
    );
  });

  it('rejects malformed and mismatched cursors without touching storage', async () => {
    const { mastra, getStore } = createHarness();

    const malformed = await captureHttpException(
      QUERY_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, page: { limit: 10, after: 'not-a-cursor' } })),
    );
    expect(malformed.status).toBe(400);
    expect(getDeclaredErrorSchema(400).parse(await malformed.getResponse().json())).toMatchObject({
      code: 'TRACE_QUERY_CURSOR_MALFORMED',
    });

    const after = encodeSpanQueryCursor(planSpanQuery({ timeRange: TIME_RANGE }), CURSOR_VALUES);
    const conflict = await captureHttpException(
      QUERY_SPANS.handler(
        params(mastra, {
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
          page: { limit: 10, after },
        }),
      ),
    );
    expect(conflict.status).toBe(409);
    expect(getDeclaredErrorSchema(409).parse(await conflict.getResponse().json())).toMatchObject({
      code: 'TRACE_QUERY_CURSOR_CONFLICT',
    });
    expect(getStore).not.toHaveBeenCalled();
  });

  it('returns stable semantic issues from the planner without echoing caller literals', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const error = await captureHttpException(
      QUERY_SPANS.handler(
        params(mastra, {
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'notASpanField' }, right: { literal: 'sensitive search' } },
        }),
      ),
    );

    expect(error.status).toBe(422);
    const body = getDeclaredErrorSchema(422).parse(await error.getResponse().json());
    expect(body).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      message: 'The span query is invalid',
      issues: [{ code: 'field_not_allowed', path: ['where', 'left', 'path'] }],
    });
    expect(JSON.stringify(body)).not.toContain('sensitive search');
    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.querySpans).not.toHaveBeenCalled();
  });

  it('maps strict request-schema failures to the declared 422 body', () => {
    const unknownKey = strictValidationError({ timeRange: TIME_RANGE, sql: 'select 1' });
    expect(unknownKey?.status).toBe(422);
    expect(getDeclaredErrorSchema(422).parse(unknownKey?.body)).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      message: 'The span query is invalid',
      issues: [{ code: 'invalid_request', path: [] }],
    });

    const unknownSort = strictValidationError({
      timeRange: TIME_RANGE,
      orderBy: [{ field: 'durationMs', direction: 'desc' }],
    });
    expect(getDeclaredErrorSchema(422).parse(unknownSort?.body)).toMatchObject({
      issues: [{ code: 'invalid_request', path: ['orderBy', 0, 'field'] }],
    });

    const tooWide = strictValidationError({
      timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    });
    expect(getDeclaredErrorSchema(422).parse(tooWide?.body)).toMatchObject({
      issues: [{ code: 'invalid_request', path: ['timeRange'] }],
    });
  });

  it('returns 501 when the request-available store lacks span-query support', async () => {
    const { mastra, observabilityStore } = createHarness(['trace-query', 'trace-query-tenant-scope']);
    const error = await captureHttpException(QUERY_SPANS.handler(params(mastra, { timeRange: TIME_RANGE })));

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_QUERY_UNSUPPORTED',
      message: 'Span queries are not supported by the configured observability store',
    });
    expect(observabilityStore.querySpans).not.toHaveBeenCalled();
  });

  it('returns the same structured 501 when observability storage is unavailable', async () => {
    const mastra = {
      getStorage: vi.fn(() => ({ getStore: vi.fn().mockResolvedValue(undefined) })),
    } as unknown as Mastra;
    const error = await captureHttpException(QUERY_SPANS.handler(params(mastra, { timeRange: TIME_RANGE })));

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_QUERY_UNSUPPORTED',
      message: 'Observability storage domain is not available',
    });
  });

  it('scopes the plan to the trusted tenant and never runs a scoped request unscoped', async () => {
    const scopedParams = (mastra: Mastra) => {
      const context = params(mastra, { timeRange: TIME_RANGE });
      context.requestContext.set('organizationId', 'org-a');
      return context;
    };

    const { mastra, observabilityStore } = createHarness();
    await QUERY_SPANS.handler(scopedParams(mastra));
    expect(observabilityStore.querySpans).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { organizationId: 'org-a' } }),
    );

    const unscopedStore = createHarness(['span-query']);
    const error = await captureHttpException(QUERY_SPANS.handler(scopedParams(unscopedStore.mastra)));
    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_QUERY_UNSUPPORTED',
      message: 'The configured observability store cannot enforce the trusted tenant scope',
    });
    expect(unscopedStore.observabilityStore.querySpans).not.toHaveBeenCalled();

    await QUERY_SPANS.handler(params(unscopedStore.mastra, { timeRange: TIME_RANGE }));
    expect(unscopedStore.observabilityStore.querySpans).toHaveBeenCalledWith(
      expect.objectContaining({ scope: undefined }),
    );
  });

  it('rejects a cursor issued for another tenant', async () => {
    const { mastra, getStore } = createHarness();
    const after = encodeSpanQueryCursor(planSpanQuery({ timeRange: TIME_RANGE }), CURSOR_VALUES);
    const context = params(mastra, { timeRange: TIME_RANGE, page: { limit: 10, after } });
    context.requestContext.set('organizationId', 'org-a');

    const error = await captureHttpException(QUERY_SPANS.handler(context));

    expect(error.status).toBe(409);
    expect(getStore).not.toHaveBeenCalled();
  });

  it('returns 501 for scoped requests when core lacks tenant scope support', async () => {
    coreFeatures.delete('observability-trace-query-tenant-scope');
    try {
      const { mastra, getStore } = createHarness();
      const context = params(mastra, { timeRange: TIME_RANGE });
      context.requestContext.set('organizationId', 'org-a');
      const error = await captureHttpException(QUERY_SPANS.handler(context));

      expect(error.status).toBe(501);
      expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toMatchObject({
        code: 'SPAN_QUERY_UNSUPPORTED',
      });
      expect(getStore).not.toHaveBeenCalled();
    } finally {
      coreFeatures.add('observability-trace-query-tenant-scope');
    }
  });

  it('returns structured execution errors without exposing database errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    const cases = [
      { thrown: new TraceQueryExecutionError(), status: 504, code: 'TRACE_QUERY_EXECUTION_TIMEOUT' },
      { thrown: new TraceQueryResourceLimitError(), status: 503, code: 'TRACE_QUERY_RESOURCE_LIMIT' },
      {
        thrown: new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT'),
        status: 409,
        code: 'TRACE_QUERY_CURSOR_CONFLICT',
      },
    ] as const;

    for (const testCase of cases) {
      observabilityStore.querySpans.mockRejectedValueOnce(testCase.thrown);
      const error = await captureHttpException(QUERY_SPANS.handler(params(mastra, { timeRange: TIME_RANGE })));

      expect(error.status).toBe(testCase.status);
      expect(getDeclaredErrorSchema(testCase.status).parse(await error.getResponse().json())).toMatchObject({
        code: testCase.code,
      });
    }
  });

  it('publishes strict runtime and OpenAPI schemas with the observability read permission', () => {
    expect(OBSERVABILITY_ROUTES).toContain(QUERY_SPANS);
    expect(QUERY_SPANS.requiresAuth).toBe(true);
    expect(QUERY_SPANS.requiresPermission).toBe('observability:read');
    expect(QUERY_SPANS.method).toBe('POST');
    expect(QUERY_SPANS.path).toBe('/observability/spans/query');
    expect(QUERY_SPANS.maxBodySize).toBe(256 * 1024);
    expect(Object.keys(QUERY_SPANS.openapi?.responses ?? {})).toEqual([
      '200',
      '400',
      '409',
      '413',
      '422',
      '501',
      '503',
      '504',
    ]);

    const document = generateOpenAPIDocument([QUERY_SPANS], { title: 'Test', version: '1.0.0' });
    const operation = document.paths['/observability/spans/query'].post;
    const requestSchema = JSON.stringify(operation.requestBody);
    for (const field of ['timeRange', 'where', 'orderBy', 'page']) {
      expect(requestSchema).toContain(field);
    }
    const responses = operation.responses;
    const successSchema = JSON.stringify(responses['200']);
    for (const field of ['spans', 'spanId', 'inputPreview', 'outputPreview', 'cost', 'next']) {
      expect(successSchema).toContain(field);
    }
    expect(responses['422'].content['application/json'].schema.properties.code.const).toBe('TRACE_QUERY_INVALID');
    expect(responses['501'].content['application/json'].schema.properties.code.const).toBe('SPAN_QUERY_UNSUPPORTED');
    expect(responses['503'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_QUERY_RESOURCE_LIMIT',
    );
    expect(responses['504'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_QUERY_EXECUTION_TIMEOUT',
    );
  });
});
