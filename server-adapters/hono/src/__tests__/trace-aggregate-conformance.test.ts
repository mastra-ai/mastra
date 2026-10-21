import {
  TRACE_AGGREGATE_CONFORMANCE_CASES,
  TRACE_AGGREGATE_FIXTURE_DATA,
  TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES,
  TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES,
  TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA,
  TRACE_AGGREGATE_TOKEN_FIXTURE_DATA,
  TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES,
  TRACE_AGGREGATE_YEAR_FIXTURE_DATA,
  evaluateTraceAggregate,
  traceAggregateResponseMismatch,
} from '@internal/storage-test-utils';
import type { TraceAggregateConformanceCase, TraceAggregateFixtureData } from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core';
import { toStandardSchema } from '@mastra/core/schema';
import { traceAggregateResponseSchema } from '@mastra/core/storage';
import type { TrustedTraceAggregatePlan } from '@mastra/core/storage';
import { AGGREGATE_TRACES } from '@mastra/server/handlers/observability-new-endpoints';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

// Every trace-aggregate capability the handler gates on. The fake store advertises all of them
// so each shared case reaches `aggregateTraces` instead of a 501.
const AGGREGATE_STORE_FEATURES = [
  'trace-query',
  'trace-aggregate',
  'trace-query-root-duration',
  'trace-query-context-ids',
  'trace-query-time-to-first-chunk',
  'trace-query-root-span-fields',
  'trace-query-root-entity-id',
  'trace-query-tenant-scope',
];

// `organizationId` is a reserved request-context key, so clients cannot self-assert it. Server
// middleware sets it here, as an auth layer would in production.
const TENANT_HEADER = 'x-test-organization-id';

async function createAggregateApp(fixture: TraceAggregateFixtureData) {
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
  const aggregateTraces = vi.fn(async (plan: TrustedTraceAggregatePlan) => evaluateTraceAggregate(fixture, plan));
  vi.spyOn(mastra, 'getStorage').mockReturnValue({
    getStore: vi.fn().mockResolvedValue({ getFeatures: () => AGGREGATE_STORE_FEATURES, aggregateTraces }),
  } as unknown as NonNullable<ReturnType<Mastra['getStorage']>>);
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app, aggregateTraces };
}

function postAggregate(app: Hono, body: unknown, organizationId?: string) {
  return app.request('/api/observability/traces/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(organizationId ? { [TENANT_HEADER]: organizationId } : {}) },
    body: JSON.stringify(body),
  });
}

const SUITES: Array<[string, TraceAggregateFixtureData, TraceAggregateConformanceCase[]]> = [
  ['base', TRACE_AGGREGATE_FIXTURE_DATA, TRACE_AGGREGATE_CONFORMANCE_CASES],
  ['token and cost', TRACE_AGGREGATE_TOKEN_FIXTURE_DATA, TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES],
  ['token metric edge', TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA, TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES],
  ['365-day window', TRACE_AGGREGATE_YEAR_FIXTURE_DATA, TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES],
];

describe('POST /api/observability/traces/aggregate conformance', () => {
  describe.each(SUITES)('%s cases', (_suite, fixture, cases) => {
    // The server resolves only `organizationId` from the request context; resource-level
    // scope is a storage-only concern and cannot be expressed over HTTP.
    const httpCases = cases.filter(testCase => !testCase.scope?.resourceId);

    it.each(httpCases.map(testCase => [testCase.name, testCase] as const))(
      'matches the reference evaluator over HTTP: %s',
      async (_name, testCase) => {
        const { app, aggregateTraces } = await createAggregateApp(fixture);
        const response = await postAggregate(app, testCase.request, testCase.scope?.organizationId);

        expect(response.status, await response.clone().text()).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        const body = traceAggregateResponseSchema.parse(await response.json());
        expect(traceAggregateResponseMismatch(body, testCase), JSON.stringify(body)).toBeNull();
        expect(aggregateTraces).toHaveBeenCalledTimes(1);
        expect(aggregateTraces.mock.calls[0]![0].scope).toEqual(
          testCase.scope?.organizationId ? { organizationId: testCase.scope.organizationId } : undefined,
        );
      },
    );
  });

  describe('request bounds', () => {
    const from = '2025-10-01T00:00:00.000Z';
    const yearTo = '2026-10-01T00:00:00.000Z';

    async function expect422(body: unknown) {
      const { app, aggregateTraces } = await createAggregateApp(TRACE_AGGREGATE_YEAR_FIXTURE_DATA);
      const response = await postAggregate(app, body);
      expect(response.status).toBe(422);
      const schema = AGGREGATE_TRACES.openapi?.responses[422]?.content?.['application/json']?.schema;
      if (!schema) throw new Error('Missing trace-aggregate 422 schema');
      const json = await response.json();
      const validation = await toStandardSchema(schema)['~standard'].validate(json);
      expect(validation.issues, JSON.stringify(json)).toBeUndefined();
      expect(aggregateTraces).not.toHaveBeenCalled();
      return json;
    }

    it('accepts a 365-day window at 1d with the largest limit under the row cap', async () => {
      const { app, aggregateTraces } = await createAggregateApp(TRACE_AGGREGATE_YEAR_FIXTURE_DATA);
      const response = await postAggregate(app, {
        timeRange: { from, to: yearTo },
        groupBy: ['entityName'],
        interval: '1d',
        measures: ['count'],
        limit: 27,
      });
      expect(response.status).toBe(200);
      expect(aggregateTraces).toHaveBeenCalledTimes(1);
    });

    it('rejects a 366-day window', async () => {
      const body = await expect422({
        timeRange: { from, to: '2026-10-02T00:00:00.000Z' },
        measures: ['count'],
      });
      // The request schema rejects this before the planner and reports only the generic contract issue.
      expect(body).toMatchObject({
        code: 'TRACE_QUERY_INVALID',
        issues: [{ code: 'invalid_request', path: ['timeRange'] }],
      });
    });

    it('rejects 1h buckets over 365 days and names the smallest valid interval', async () => {
      const body = await expect422({ timeRange: { from, to: yearTo }, interval: '1h', measures: ['count'] });
      expect(body).toMatchObject({
        code: 'TRACE_QUERY_INVALID',
        issues: [{ code: 'too_many_buckets', path: ['interval'] }],
      });
      expect(JSON.stringify(body)).toContain('1d');
    });

    it('rejects limit 28 at 1d over 365 days (exceeds the 10,000-row cap)', async () => {
      const body = await expect422({
        timeRange: { from, to: yearTo },
        groupBy: ['entityName'],
        interval: '1d',
        measures: ['count'],
        limit: 28,
      });
      expect(body).toMatchObject({ code: 'TRACE_QUERY_INVALID', issues: [{ code: 'too_many_rows' }] });
    });
  });
});
