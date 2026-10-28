import {
  SPAN_AGGREGATE_CONFORMANCE_CASES,
  SPAN_AGGREGATE_FIXTURE_DATA,
  evaluateSpanAggregate,
  traceAggregateResponseMismatch,
} from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core';
import { toStandardSchema } from '@mastra/core/schema';
import { spanAggregateResponseSchema } from '@mastra/core/storage';
import type { TrustedSpanAggregatePlan } from '@mastra/core/storage';
import { AGGREGATE_SPANS } from '@mastra/server/handlers/observability-new-endpoints';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

// `span-aggregate` covers every span query field, so the handler gates only on it and tenant scope.
const AGGREGATE_STORE_FEATURES = ['span-query', 'span-aggregate', 'trace-query-tenant-scope'];

// `organizationId` is a reserved request-context key, so clients cannot self-assert it. Server
// middleware sets it here, as an auth layer would in production.
const TENANT_HEADER = 'x-test-organization-id';

async function createAggregateApp(features: string[] = AGGREGATE_STORE_FEATURES) {
  const mastra = new Mastra({
    logger: false,
    server: {
      middleware: async (c, next) => {
        const organizationId = c.req.header(TENANT_HEADER);
        if (organizationId) c.get('requestContext').set('organizationId', organizationId);
        await next();
      },
    },
  });
  const aggregateSpans = vi.fn(async (plan: TrustedSpanAggregatePlan) =>
    evaluateSpanAggregate(SPAN_AGGREGATE_FIXTURE_DATA, plan),
  );
  vi.spyOn(mastra, 'getStorage').mockReturnValue({
    getStore: vi.fn().mockResolvedValue({ getFeatures: () => features, aggregateSpans }),
  } as unknown as NonNullable<ReturnType<Mastra['getStorage']>>);
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app, aggregateSpans };
}

function postAggregate(app: Hono, body: unknown, organizationId?: string) {
  return app.request('/api/observability/spans/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(organizationId ? { [TENANT_HEADER]: organizationId } : {}) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/observability/spans/aggregate conformance', () => {
  // The server resolves only `organizationId` from the request context; resource-level
  // scope is a storage-only concern and cannot be expressed over HTTP.
  const httpCases = SPAN_AGGREGATE_CONFORMANCE_CASES.filter(testCase => !testCase.scope?.resourceId);

  it.each(httpCases.map(testCase => [testCase.name, testCase] as const))(
    'matches the reference evaluator over HTTP: %s',
    async (_name, testCase) => {
      const { app, aggregateSpans } = await createAggregateApp();
      const response = await postAggregate(app, testCase.request, testCase.scope?.organizationId);

      expect(response.status, await response.clone().text()).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      const body = spanAggregateResponseSchema.parse(await response.json());
      expect(traceAggregateResponseMismatch(body, testCase), JSON.stringify(body)).toBeNull();
      expect(aggregateSpans).toHaveBeenCalledTimes(1);
      expect(aggregateSpans.mock.calls[0]![0].scope).toEqual(
        testCase.scope?.organizationId ? { organizationId: testCase.scope.organizationId } : undefined,
      );
    },
  );

  it('passes the server-resolved tenant to the store', async () => {
    const { app, aggregateSpans } = await createAggregateApp();
    const response = await postAggregate(
      app,
      { timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-04T00:00:00.000Z' }, measures: ['count'] },
      'org-a',
    );
    expect(response.status).toBe(200);
    expect(aggregateSpans.mock.calls[0]![0].scope).toEqual({ organizationId: 'org-a' });
  });

  describe('errors', () => {
    const from = '2025-10-01T00:00:00.000Z';

    async function expectStatus(status: number, body: unknown, features?: string[]) {
      const { app, aggregateSpans } = await createAggregateApp(features);
      const response = await postAggregate(app, body);
      expect(response.status).toBe(status);
      const schema = AGGREGATE_SPANS.openapi?.responses[status]?.content?.['application/json']?.schema;
      if (!schema) throw new Error(`Missing span-aggregate ${status} schema`);
      const json = await response.json();
      const validation = await toStandardSchema(schema)['~standard'].validate(json);
      expect(validation.issues, JSON.stringify(json)).toBeUndefined();
      expect(aggregateSpans).not.toHaveBeenCalled();
      return json;
    }

    it('rejects a 366-day window', async () => {
      const body = await expectStatus(422, {
        timeRange: { from, to: '2026-10-02T00:00:00.000Z' },
        measures: ['count'],
      });
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID', issues: [{ path: ['timeRange'] }] });
    });

    it('rejects model as a dimension', async () => {
      const body = await expectStatus(422, {
        timeRange: { from, to: '2025-10-08T00:00:00.000Z' },
        groupBy: ['model'],
        measures: ['count'],
      });
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID' });
    });

    it('rejects 1h buckets over 365 days', async () => {
      const body = await expectStatus(422, {
        timeRange: { from, to: '2026-10-01T00:00:00.000Z' },
        interval: '1h',
        measures: ['count'],
      });
      expect(body).toMatchObject({ issues: [{ code: 'too_many_buckets', path: ['interval'] }] });
    });

    it('returns 501, not 500, when the store does not declare span-aggregate', async () => {
      const body = await expectStatus(
        501,
        { timeRange: { from, to: '2025-10-08T00:00:00.000Z' }, measures: ['count'] },
        ['span-query', 'trace-aggregate', 'trace-query-tenant-scope'],
      );
      expect(body).toMatchObject({ code: 'SPAN_AGGREGATE_UNSUPPORTED' });
    });
  });
});
