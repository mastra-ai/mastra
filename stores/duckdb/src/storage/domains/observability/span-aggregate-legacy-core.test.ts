import { afterAll, expect, it, vi } from 'vitest';
import { DuckDBStore } from '../../../index';

// Core before span aggregate model dimensions: the registry has no `model`, so `planSpanAggregate`
// rejects `groupBy: ['model']` and the store must not advertise the dimensions.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const { model: _model, provider: _provider, ...registry } = actual.SPAN_AGGREGATE_DIMENSION_REGISTRY;
  return { ...actual, SPAN_AGGREGATE_DIMENSION_REGISTRY: registry };
});

const store = new DuckDBStore({ path: ':memory:' });
afterAll(() => store.close());

it('declares span aggregates without model dimensions when core lacks them', async () => {
  const storage = (await store.getStore('observability'))!;
  expect(storage.getFeatures()).toContain('span-aggregate');
  expect(storage.getFeatures()).not.toContain('span-aggregate-model-dimensions');
});
