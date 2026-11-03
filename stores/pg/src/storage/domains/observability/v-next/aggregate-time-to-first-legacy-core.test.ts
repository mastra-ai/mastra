import { Pool } from 'pg';
import { expect, it, vi } from 'vitest';
import { PoolAdapter } from '../../../client';
import { ObservabilityStoragePostgresVNext } from './index';

// Core before time-to-first aggregate measures: the registry has no `timeToFirstToken.*`, so the
// planner rejects them and the store must not advertise the feature. Feature detection doesn't
// touch the database, so the client is never connected.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const registry = Object.fromEntries(
    Object.entries(actual.TRACE_AGGREGATE_MEASURE_REGISTRY).filter(([name]) => !name.startsWith('timeToFirst')),
  );
  return { ...actual, TRACE_AGGREGATE_MEASURE_REGISTRY: registry };
});

it('declares aggregates without time-to-first measures when core lacks them', () => {
  const features = new ObservabilityStoragePostgresVNext({
    client: new PoolAdapter(new Pool({ connectionString: 'postgres://unused@localhost:1/unused' })),
    schemaName: 'unused',
  }).getFeatures();
  expect(features).toContain('trace-aggregate');
  expect(features).toContain('span-aggregate');
  expect(features).not.toContain('aggregate-time-to-first-measures');
});
