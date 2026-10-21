import type { Mastra } from '@mastra/core';
import {
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
  spanAggregateRequestSchema,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { generateOpenAPIDocument } from '../server-adapter/openapi-utils';
import { OBSERVABILITY_ROUTES } from '../server-adapter/routes/observability';
import { AGGREGATE_SPANS } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

const TIME_RANGE = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

function createHarness(features: string[] = ['span-aggregate', 'trace-query-tenant-scope']) {
  const observabilityStore = {
    getFeatures: vi.fn(() => features),
    aggregateSpans: vi.fn().mockResolvedValue({ rows: [], truncated: false }),
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
    ...spanAggregateRequestSchema.parse(request),
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

function getDeclaredErrorSchema(status: 400 | 413 | 422 | 501 | 503 | 504): z.ZodTypeAny {
  const schema = AGGREGATE_SPANS.openapi?.responses[status]?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`Missing OpenAPI error schema for ${status}`);
  return schema as z.ZodTypeAny;
}

describe('AGGREGATE_SPANS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the trusted span plan to the store and returns its response unchanged', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const response = {
      rows: [
        { dimensions: { name: 'search', status: 'error' }, measures: { count: 4, 'duration.p95': 812 } },
        { dimensions: { name: 'search', status: null }, measures: { count: 1, 'duration.p95': null } },
      ],
      truncated: false,
    };
    observabilityStore.aggregateSpans.mockResolvedValue(response);

    const result = await AGGREGATE_SPANS.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
        groupBy: ['name', 'status'],
        measures: ['count', 'duration.p95'],
        limit: 50,
      }),
    );

    expect(result).toBe(response);
    expect(getStore).toHaveBeenCalledWith('observability');
    expect(observabilityStore.aggregateSpans).toHaveBeenCalledOnce();
    expect(observabilityStore.aggregateSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'spanAggregate',
        timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
        where: { type: 'comparison', field: 'spanType', operator: 'eq', value: 'tool_call' },
        scope: undefined,
        dimensions: ['name', 'status'],
        measures: [
          { type: 'canonical', name: 'count' },
          { type: 'canonical', name: 'duration.p95' },
        ],
        limit: 50,
      }),
    );
  });

  it('returns stable semantic issues from the planner without touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const cases = [
      {
        request: { timeRange: TIME_RANGE, groupBy: ['spanId'], measures: ['count'] },
        issue: { code: 'field_not_allowed', path: ['groupBy', 0] },
      },
      {
        request: { timeRange: TIME_RANGE, groupBy: ['model'], measures: ['count'] },
        issue: { code: 'field_not_allowed', path: ['groupBy', 0] },
      },
      {
        request: { timeRange: TIME_RANGE, interval: '1m', measures: ['count'] },
        issue: { code: 'too_many_buckets', path: ['interval'] },
      },
    ];

    for (const testCase of cases) {
      const error = await captureHttpException(AGGREGATE_SPANS.handler(params(mastra, testCase.request)));

      expect(error.status).toBe(422);
      expect(getDeclaredErrorSchema(422).parse(await error.getResponse().json())).toMatchObject({
        code: 'TRACE_QUERY_INVALID',
        issues: [expect.objectContaining(testCase.issue)],
      });
    }
    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.aggregateSpans).not.toHaveBeenCalled();
  });

  it('maps strict request-schema failures to the declared 422 body without echoing caller input', () => {
    const secret = 'customer-secret-value';
    const parsed = spanAggregateRequestSchema.safeParse({
      timeRange: TIME_RANGE,
      measures: ['count'],
      groupBy: [secret],
      unexpected: secret,
    });
    expect(parsed.success).toBe(false);
    const result = AGGREGATE_SPANS.onValidationError?.(parsed.error!, 'body');

    expect(result?.status).toBe(422);
    expect(getDeclaredErrorSchema(422).parse(result?.body)).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      message: 'The span aggregate query is invalid',
    });
    expect(JSON.stringify(result?.body)).not.toContain(secret);
  });

  it('returns 501 when the store lacks span-aggregate support, even if it serves span queries', async () => {
    const { mastra, observabilityStore } = createHarness(['span-query', 'trace-aggregate', 'trace-query-tenant-scope']);
    const error = await captureHttpException(
      AGGREGATE_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_AGGREGATE_UNSUPPORTED',
      message: 'Span aggregation is not supported by the configured observability store',
    });
    expect(observabilityStore.aggregateSpans).not.toHaveBeenCalled();
  });

  it('returns the same structured 501 when observability storage is unavailable', async () => {
    const mastra = {
      getStorage: vi.fn(() => ({ getStore: vi.fn().mockResolvedValue(undefined) })),
    } as unknown as Mastra;
    const error = await captureHttpException(
      AGGREGATE_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_AGGREGATE_UNSUPPORTED',
      message: 'Observability storage domain is not available',
    });
  });

  it('passes span context fields to any store that declares span-aggregate', async () => {
    const { mastra, observabilityStore } = createHarness(['span-aggregate']);
    await AGGREGATE_SPANS.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: 'rootEntityName' }, right: { literal: 'support' } },
            { op: 'gt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 100 } },
          ],
        },
        groupBy: ['parentEntityName'],
        measures: ['count', 'errorRate'],
      }),
    );
    expect(observabilityStore.aggregateSpans).toHaveBeenCalledOnce();
  });

  it('scopes the plan to the trusted tenant and never runs a scoped request unscoped', async () => {
    const scopedParams = (mastra: Mastra) => {
      const context = params(mastra, { timeRange: TIME_RANGE, measures: ['count'] });
      context.requestContext.set('organizationId', 'org-a');
      return context;
    };

    const { mastra, observabilityStore } = createHarness();
    await AGGREGATE_SPANS.handler(scopedParams(mastra));
    expect(observabilityStore.aggregateSpans).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { organizationId: 'org-a' } }),
    );

    const unscopedStore = createHarness(['span-aggregate']);
    const error = await captureHttpException(AGGREGATE_SPANS.handler(scopedParams(unscopedStore.mastra)));
    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'SPAN_AGGREGATE_UNSUPPORTED',
      message: 'The configured observability store cannot enforce the trusted tenant scope',
    });
    expect(unscopedStore.observabilityStore.aggregateSpans).not.toHaveBeenCalled();
  });

  it('returns a structured 503 when the query hits a resource limit', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.aggregateSpans.mockRejectedValue(new TraceQueryResourceLimitError());

    const error = await captureHttpException(
      AGGREGATE_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(503);
    expect(getDeclaredErrorSchema(503).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_RESOURCE_LIMIT',
      message: 'The query exceeded its resource limit',
    });
  });

  it('returns a structured 504 without exposing database errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.aggregateSpans.mockRejectedValue(new TraceQueryExecutionError());

    const error = await captureHttpException(
      AGGREGATE_SPANS.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(504);
    expect(getDeclaredErrorSchema(504).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
      message: 'The query exceeded its execution timeout',
    });
  });

  it('publishes strict runtime and OpenAPI schemas with the observability read permission', () => {
    expect(OBSERVABILITY_ROUTES).toContain(AGGREGATE_SPANS);
    expect(AGGREGATE_SPANS.requiresAuth).toBe(true);
    expect(AGGREGATE_SPANS.requiresPermission).toBe('observability:read');
    expect(AGGREGATE_SPANS.method).toBe('POST');
    expect(AGGREGATE_SPANS.path).toBe('/observability/spans/aggregate');
    expect(AGGREGATE_SPANS.maxBodySize).toBe(256 * 1024);
    expect(Object.keys(AGGREGATE_SPANS.openapi?.responses ?? {})).toEqual([
      '200',
      '400',
      '413',
      '422',
      '501',
      '503',
      '504',
    ]);

    const document = generateOpenAPIDocument([AGGREGATE_SPANS], { title: 'Test', version: '1.0.0' });
    const responses = document.paths['/observability/spans/aggregate'].post.responses;
    expect(responses['501'].content['application/json'].schema.properties.code.const).toBe(
      'SPAN_AGGREGATE_UNSUPPORTED',
    );
    expect(JSON.stringify(responses['200'])).toContain('truncated');
  });
});
