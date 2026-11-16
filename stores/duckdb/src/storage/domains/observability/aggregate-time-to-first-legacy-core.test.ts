import { afterAll, expect, it, vi } from 'vitest';
import { DuckDBStore } from '../../../index';

// Core before time-to-first aggregate measures: the registry has no `timeToFirstToken.*`, so the
// planner rejects them and the store must not advertise the feature.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const registry = Object.fromEntries(
    Object.entries(actual.TRACE_AGGREGATE_MEASURE_REGISTRY).filter(([name]) => !name.startsWith('timeToFirst')),
  );
  return { ...actual, TRACE_AGGREGATE_MEASURE_REGISTRY: registry };
});

const store = new DuckDBStore({ path: ':memory:' });
afterAll(() => store.close());

it('declares aggregates without time-to-first measures when core lacks them', async () => {
  const storage = (await store.getStore('observability'))!;
  expect(storage.getFeatures()).toContain('trace-aggregate');
  expect(storage.getFeatures()).toContain('span-aggregate');
  expect(storage.getFeatures()).not.toContain('aggregate-time-to-first-measures');
});
