import { randomUUID } from 'node:crypto';
import { makeSpan } from '@internal/storage-test-utils';
import { planSpanQuery } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PoolAdapter } from '../../../client';
import { buildSpanQueryResponse } from './preview-compat';
import { ObservabilityStoragePostgresVNext } from './index';
const schemaName = 'compat_' + randomUUID().replaceAll('-', '');
const pool = new Pool({
  connectionString: process.env.DB_URL ?? 'postgres://postgres:postgres@localhost:5434/postgres',
});
const client = new PoolAdapter(pool);
const storage = new ObservabilityStoragePostgresVNext({ client, schemaName });
beforeAll(async () => {
  await client.none('CREATE SCHEMA "' + schemaName + '"');
  await storage.init();
}, 60_000);
afterAll(async () => {
  await client.none('DROP SCHEMA "' + schemaName + '" CASCADE');
  await pool.end();
});

vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return {
    ...actual,
    SPAN_QUERY_FIELD_REGISTRY: undefined,
    // The old builder iterates metrics even for an empty page.
    buildSpanQueryResponse: (...args: Parameters<typeof actual.buildSpanQueryResponse>) => {
      expect(Array.isArray(args[3])).toBe(true);
      for (const row of args[1]) {
        expect(row).not.toHaveProperty('threadId');
        expect(row).not.toHaveProperty('parentEntityName');
        expect(row).not.toHaveProperty('version');
        expect(row).not.toHaveProperty('cursorId');
      }
      const response = actual.buildSpanQueryResponse(...args);
      return {
        ...response,
        spans: response.spans.map(row => ({
          ...row,
          cost: actual.resolveSpanQueryCost(
            args[3]!.filter(metric => actual.spanQueryIdentityKey(metric) === actual.spanQueryIdentityKey(row)),
          ),
        })),
      };
    },
  };
});

it('supplies the metrics argument required by older core response builders', () => {
  const plan = planSpanQuery({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } });
  expect(buildSpanQueryResponse(plan, [], [])).toEqual({ spans: [], page: { next: null } });
});

it('keeps span queries and legacy model/provider predicates usable without the new registry', async () => {
  expect(storage.getFeatures()).toContain('span-query');
  const startedAt = new Date();
  const request = {
    timeRange: { from: startedAt.toISOString(), to: new Date(startedAt.getTime() + 60_000).toISOString() },
  };
  expect(await storage.querySpans(planSpanQuery(request))).toEqual({ spans: [], page: { next: null } });
  await storage.batchCreateSpans({
    records: [
      makeSpan({
        traceId: 'legacy',
        spanId: 'legacy',
        startedAt,
        attributes: { model: 'model-a', provider: 'provider-a' },
        input: 'hello',
      }),
    ],
  });
  expect((await storage.querySpans(planSpanQuery(request))).spans[0]).toMatchObject({ cost: { state: 'missing' } });
  await storage.batchCreateMetrics({
    metrics: [
      {
        metricId: 'priced',
        traceId: 'legacy',
        spanId: 'legacy',
        timestamp: new Date(startedAt.getTime() + 120_000),
        name: 'mastra_model_total_input_tokens',
        value: 10,
        labels: {},
        estimatedCost: 0.03,
        costUnit: 'usd',
        costMetadata: { allocation: 'query_total' },
      },
      {
        metricId: 'other',
        traceId: 'other',
        spanId: 'other',
        timestamp: startedAt,
        name: 'mastra_model_total_input_tokens',
        value: 10,
        labels: {},
        estimatedCost: 999,
        costUnit: 'usd',
        costMetadata: { allocation: 'query_total' },
      },
    ],
  });
  for (const field of ['model', 'provider'] as const) {
    // Trusted predicates that the older planner accepts.
    const result = await storage.querySpans({
      ...planSpanQuery(request),
      where: { type: 'comparison', field, operator: 'eq', value: field + '-a' },
    });
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]).toMatchObject({
      spanId: 'legacy',
      model: 'model-a',
      provider: 'provider-a',
      inputPreview: 'hello',
      cost: { state: 'available', amount: 0.03, currency: 'usd' },
    });
  }
});
