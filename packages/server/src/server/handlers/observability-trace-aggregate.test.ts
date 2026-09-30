import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import { TraceQueryExecutionError, traceAggregateRequestSchema } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { generateOpenAPIDocument } from '../server-adapter/openapi-utils';
import { OBSERVABILITY_ROUTES } from '../server-adapter/routes/observability';
import { AGGREGATE_TRACES } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

const TIME_RANGE = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

function createHarness(features: string[] = ['trace-aggregate', 'trace-query-tenant-scope']) {
  const observabilityStore = {
    getFeatures: vi.fn(() => features),
    aggregateTraces: vi.fn().mockResolvedValue({ rows: [], truncated: false }),
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
    ...traceAggregateRequestSchema.parse(request),
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

function getDeclaredErrorSchema(status: 400 | 413 | 422 | 501 | 504): z.ZodTypeAny {
  const schema = AGGREGATE_TRACES.openapi?.responses[status]?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`Missing OpenAPI error schema for ${status}`);
  return schema as z.ZodTypeAny;
}

function strictValidationError(request: unknown) {
  const parsed = traceAggregateRequestSchema.safeParse(request);
  if (parsed.success) throw new Error('Expected strict validation failure');
  return AGGREGATE_TRACES.onValidationError?.(parsed.error, 'body');
}

describe('AGGREGATE_TRACES', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the trusted plan to the request-available store and returns its response unchanged', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const response = {
      rows: [
        {
          dimensions: { entityName: 'support-agent' },
          bucket: '2026-08-01T00:00:00.000Z',
          measures: { count: 12, errorRate: 0.25 },
        },
        { dimensions: { entityName: null }, bucket: '2026-08-01T00:00:00.000Z', measures: { count: 3, errorRate: 0 } },
      ],
      truncated: true,
    };
    observabilityStore.aggregateTraces.mockResolvedValue(response);

    const result = await AGGREGATE_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
        groupBy: ['entityName'],
        interval: '1d',
        measures: ['count', 'errorRate'],
        having: { op: 'gt', left: { path: 'count' }, right: { literal: 1 } },
        limit: 50,
      }),
    );

    expect(result).toBe(response);
    expect(getStore).toHaveBeenCalledWith('observability');
    expect(observabilityStore.aggregateTraces).toHaveBeenCalledOnce();
    expect(observabilityStore.aggregateTraces).toHaveBeenCalledWith({
      result: 'aggregate',
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
      where: { type: 'comparison', field: 'environment', operator: 'eq', value: 'production' },
      scope: undefined,
      dimensions: ['entityName'],
      interval: '1d',
      measures: [
        { type: 'canonical', name: 'count' },
        { type: 'canonical', name: 'errorRate' },
      ],
      having: { type: 'comparison', measure: 'count', operator: 'gt', value: 1 },
      orderBy: { target: 'measure', measure: 'count', direction: 'desc' },
      limit: 50,
    });
  });

  it('returns stable semantic issues from the planner without touching storage', async () => {
    const { mastra, observabilityStore, getStore } = createHarness();
    const cases = [
      {
        request: { timeRange: TIME_RANGE, groupBy: ['traceId'], measures: ['count'] },
        issue: { code: 'field_not_allowed', path: ['groupBy', 0] },
      },
      {
        request: {
          timeRange: TIME_RANGE,
          measures: ['count'],
          having: { op: 'gt', left: { path: 'duration.p99' }, right: { literal: 1 } },
        },
        issue: { code: 'field_not_allowed', path: ['having', 'left', 'path'] },
      },
      {
        request: { timeRange: TIME_RANGE, interval: '1m', measures: ['count'] },
        issue: { code: 'too_many_buckets', path: ['interval'] },
      },
      {
        request: { timeRange: TIME_RANGE, interval: '1h', measures: ['count'] },
        issue: { code: 'too_many_rows', path: ['limit'] },
      },
    ];

    for (const testCase of cases) {
      const error = await captureHttpException(AGGREGATE_TRACES.handler(params(mastra, testCase.request)));

      expect(error.status).toBe(422);
      expect(getDeclaredErrorSchema(422).parse(await error.getResponse().json())).toMatchObject({
        code: 'TRACE_QUERY_INVALID',
        issues: [testCase.issue],
      });
    }
    expect(getStore).not.toHaveBeenCalled();
    expect(observabilityStore.aggregateTraces).not.toHaveBeenCalled();
  });

  it('never echoes caller literals in validation errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    const error = await captureHttpException(
      AGGREGATE_TRACES.handler(
        params(mastra, {
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'input' }, right: { literal: 'sensitive search' } },
          measures: ['count'],
        }),
      ),
    );

    expect(error.status).toBe(422);
    const body = getDeclaredErrorSchema(422).parse(await error.getResponse().json());
    expect(body).toMatchObject({ issues: [{ code: 'field_not_allowed', path: ['where', 'left', 'path'] }] });
    expect(JSON.stringify(body)).not.toContain('sensitive search');
    expect(observabilityStore.aggregateTraces).not.toHaveBeenCalled();

    const validation = strictValidationError({
      timeRange: TIME_RANGE,
      measures: ['count'],
      where: { op: 'eq', left: { path: 'metadata.secret' }, right: { literal: { nested: 'sensitive-object' } } },
    });
    expect(validation?.status).toBe(422);
    expect(JSON.stringify(validation?.body)).not.toContain('sensitive-object');
  });

  it('maps strict request-schema failures to the declared 422 body', () => {
    const unknownKey = strictValidationError({ timeRange: TIME_RANGE, measures: ['count'], sql: 'select 1' });
    expect(unknownKey?.status).toBe(422);
    expect(getDeclaredErrorSchema(422).parse(unknownKey?.body)).toEqual({
      code: 'TRACE_QUERY_INVALID',
      message: 'The trace aggregate query is invalid',
      issues: [
        { code: 'invalid_request', path: [], message: 'The value does not match the trace-aggregate request contract' },
      ],
    });

    const unknownMeasure = strictValidationError({ timeRange: TIME_RANGE, measures: ['tokens.total'] });
    expect(getDeclaredErrorSchema(422).parse(unknownMeasure?.body)).toMatchObject({
      issues: [{ code: 'invalid_request', path: ['measures', 0] }],
    });

    let where: unknown = { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } };
    for (let depth = 0; depth < 20; depth++) where = { op: 'not', arg: where };
    const tooComplex = strictValidationError({ timeRange: TIME_RANGE, measures: ['count'], where });
    expect(getDeclaredErrorSchema(422).parse(tooComplex?.body)).toMatchObject({
      code: 'TRACE_QUERY_INVALID',
      issues: [{ code: 'predicate_too_complex', path: expect.arrayContaining(['where']) }],
    });

    const invertedRange = strictValidationError({
      timeRange: { from: TIME_RANGE.to, to: TIME_RANGE.from },
      measures: ['count'],
    });
    expect(getDeclaredErrorSchema(422).parse(invertedRange?.body)).toMatchObject({
      issues: [{ code: 'invalid_request', path: ['timeRange'] }],
    });
  });

  it('returns 501 when the request-available store lacks trace-aggregate support', async () => {
    const { mastra, observabilityStore } = createHarness(['trace-query', 'trace-query-tenant-scope']);
    const error = await captureHttpException(
      AGGREGATE_TRACES.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_AGGREGATE_UNSUPPORTED',
      message: 'Trace aggregation is not supported by the configured observability store',
    });
    expect(observabilityStore.aggregateTraces).not.toHaveBeenCalled();
  });

  it('returns the same structured 501 when observability storage is unavailable', async () => {
    const mastra = {
      getStorage: vi.fn(() => ({ getStore: vi.fn().mockResolvedValue(undefined) })),
    } as unknown as Mastra;
    const error = await captureHttpException(
      AGGREGATE_TRACES.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_AGGREGATE_UNSUPPORTED',
      message: 'Observability storage domain is not available',
    });
  });

  it('gates root duration predicates on the store advertising support', async () => {
    const request = {
      timeRange: TIME_RANGE,
      where: { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } },
      measures: ['count'],
    };
    const older = createHarness(['trace-aggregate']);
    const error = await captureHttpException(AGGREGATE_TRACES.handler(params(older.mastra, request)));

    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_AGGREGATE_UNSUPPORTED',
      message: 'Root duration predicates are not supported by the configured observability store',
    });
    expect(older.observabilityStore.aggregateTraces).not.toHaveBeenCalled();

    const supported = createHarness(['trace-aggregate', 'trace-query-root-duration']);
    await AGGREGATE_TRACES.handler(params(supported.mastra, request));
    expect(supported.observabilityStore.aggregateTraces).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'comparison', field: 'durationMs', operator: 'gt', value: 5000 } }),
    );
  });

  it('returns 501 before calling an older store for context identifier predicates', async () => {
    const wheres = [
      { op: 'eq', left: { path: 'userId' }, right: { literal: 'user-1' } },
      { op: 'not', arg: { spans: { some: { op: 'exists', path: 'sessionId' } } } },
      { op: 'in', value: { path: 'organizationId' }, set: ['org-1'] },
    ];
    for (const where of wheres) {
      const { mastra, observabilityStore } = createHarness(['trace-aggregate']);
      const error = await captureHttpException(
        AGGREGATE_TRACES.handler(params(mastra, { timeRange: TIME_RANGE, where, measures: ['count'] })),
      );

      expect(error.status).toBe(501);
      expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
        code: 'TRACE_AGGREGATE_UNSUPPORTED',
        message: 'Context identifier predicates are not supported by the configured observability store',
      });
      expect(observabilityStore.aggregateTraces).not.toHaveBeenCalled();
    }
  });

  it('passes context identifier predicates to stores that advertise support', async () => {
    const { mastra, observabilityStore } = createHarness(['trace-aggregate', 'trace-query-context-ids']);

    await AGGREGATE_TRACES.handler(
      params(mastra, {
        timeRange: TIME_RANGE,
        where: { spans: { some: { op: 'eq', left: { path: 'runId' }, right: { literal: 'run-42' } } } },
        measures: ['count'],
      }),
    );

    expect(observabilityStore.aggregateTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'relation',
          collection: 'spans',
          quantifier: 'some',
          predicate: { type: 'comparison', field: 'runId', operator: 'eq', value: 'run-42' },
        },
      }),
    );
  });

  it('scopes the plan to the trusted tenant and never runs a scoped request unscoped', async () => {
    const scopedParams = (mastra: Mastra) => {
      const context = params(mastra, { timeRange: TIME_RANGE, measures: ['count'] });
      context.requestContext.set('organizationId', 'org-a');
      return context;
    };

    const { mastra, observabilityStore } = createHarness();
    await AGGREGATE_TRACES.handler(scopedParams(mastra));
    expect(observabilityStore.aggregateTraces).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { organizationId: 'org-a' } }),
    );

    const unscopedStore = createHarness(['trace-aggregate']);
    const error = await captureHttpException(AGGREGATE_TRACES.handler(scopedParams(unscopedStore.mastra)));
    expect(error.status).toBe(501);
    expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_AGGREGATE_UNSUPPORTED',
      message: 'The configured observability store cannot enforce the trusted tenant scope',
    });
    expect(unscopedStore.observabilityStore.aggregateTraces).not.toHaveBeenCalled();

    await AGGREGATE_TRACES.handler(params(unscopedStore.mastra, { timeRange: TIME_RANGE, measures: ['count'] }));
    expect(unscopedStore.observabilityStore.aggregateTraces).toHaveBeenCalledWith(
      expect.objectContaining({ scope: undefined }),
    );
  });

  it('returns 501 for scoped requests when core lacks tenant scope support', async () => {
    coreFeatures.delete('observability-trace-query-tenant-scope');
    try {
      const { mastra, getStore } = createHarness();
      const context = params(mastra, { timeRange: TIME_RANGE, measures: ['count'] });
      context.requestContext.set('organizationId', 'org-a');
      const error = await captureHttpException(AGGREGATE_TRACES.handler(context));

      expect(error.status).toBe(501);
      expect(getDeclaredErrorSchema(501).parse(await error.getResponse().json())).toMatchObject({
        code: 'TRACE_AGGREGATE_UNSUPPORTED',
      });
      expect(getStore).not.toHaveBeenCalled();
    } finally {
      coreFeatures.add('observability-trace-query-tenant-scope');
    }
  });

  it('returns a structured 504 without exposing database errors', async () => {
    const { mastra, observabilityStore } = createHarness();
    observabilityStore.aggregateTraces.mockRejectedValue(new TraceQueryExecutionError());

    const error = await captureHttpException(
      AGGREGATE_TRACES.handler(params(mastra, { timeRange: TIME_RANGE, measures: ['count'] })),
    );

    expect(error.status).toBe(504);
    expect(getDeclaredErrorSchema(504).parse(await error.getResponse().json())).toEqual({
      code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
      message: 'The trace query exceeded its execution timeout',
    });
  });

  it('publishes strict runtime and OpenAPI schemas with the observability read permission', () => {
    expect(OBSERVABILITY_ROUTES).toContain(AGGREGATE_TRACES);
    expect(AGGREGATE_TRACES.requiresAuth).toBe(true);
    expect(AGGREGATE_TRACES.requiresPermission).toBe('observability:read');
    expect(AGGREGATE_TRACES.method).toBe('POST');
    expect(AGGREGATE_TRACES.path).toBe('/observability/traces/aggregate');
    expect(AGGREGATE_TRACES.maxBodySize).toBe(256 * 1024);
    expect(Object.keys(AGGREGATE_TRACES.openapi?.responses ?? {})).toEqual(['200', '400', '413', '422', '501', '504']);

    const document = generateOpenAPIDocument([AGGREGATE_TRACES], { title: 'Test', version: '1.0.0' });
    const operation = document.paths['/observability/traces/aggregate'].post;
    const requestSchema = JSON.stringify(operation.requestBody);
    for (const field of ['timeRange', 'where', 'groupBy', 'interval', 'measures', 'having', 'orderBy', 'limit']) {
      expect(requestSchema).toContain(field);
    }
    const responses = operation.responses;
    const successSchema = JSON.stringify(responses['200']);
    for (const field of ['rows', 'dimensions', 'bucket', 'measures', 'truncated']) {
      expect(successSchema).toContain(field);
    }
    expect(responses['400'].content['application/json'].schema.properties.error.const).toBe('Invalid request body');
    expect(responses['413'].content['application/json'].schema.properties.error.const).toBe('Request body too large');
    expect(responses['422'].content['application/json'].schema.properties.code.const).toBe('TRACE_QUERY_INVALID');
    expect(responses['422'].content['application/json'].schema.properties.issues.type).toBe('array');
    expect(responses['501'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_AGGREGATE_UNSUPPORTED',
    );
    expect(responses['504'].content['application/json'].schema.properties.code.const).toBe(
      'TRACE_QUERY_EXECUTION_TIMEOUT',
    );
  });
});
