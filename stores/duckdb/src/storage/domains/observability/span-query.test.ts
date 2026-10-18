import { createSpanQueryTests, makeSpan } from '@internal/storage-test-utils';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { planSpanQuery } from '@mastra/core/storage';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { DuckDBStore } from '../../../index';
import { DuckDBQueryTimeoutError } from '../../db';

const store = new DuckDBStore({ path: ':memory:' });
const db = store.db;
let storage: ObservabilityStorage;
beforeAll(async () => {
  storage = (await store.getStore('observability'))!;
  await storage.init();
});
afterAll(() => store.close());
createSpanQueryTests(() => storage, { eventSourced: true });

it('returns null and applies null predicates for fields not stored by DuckDB', async () => {
  const startedAt = new Date();
  const endedAt = new Date(startedAt.getTime() + 1000);
  await storage.dangerouslyClearAll();
  await storage.batchCreateSpans({
    records: [makeSpan({ traceId: 'null-trace', spanId: 'null-span', startedAt, endedAt })],
  });
  const timeRange = { from: startedAt.toISOString(), to: endedAt.toISOString() };
  for (const field of [
    'parentEntityType',
    'parentEntityId',
    'parentEntityName',
    'rootEntityType',
    'rootEntityId',
    'rootEntityName',
    'executionSource',
  ]) {
    const query = (where: unknown) => storage.querySpans(planSpanQuery({ timeRange, where }));
    expect((await query({ op: 'exists', path: field })).spans).toEqual([]);
    const absent = (await query({ op: 'notExists', path: field })).spans;
    expect(absent).toHaveLength(1);
    expect(absent[0]).toHaveProperty(field, null);
    expect((await query({ op: 'eq', left: { path: field }, right: { literal: 'x' } })).spans).toEqual([]);
    expect(
      (await query({ op: 'not', arg: { op: 'eq', left: { path: field }, right: { literal: 'x' } } })).spans,
    ).toHaveLength(1);
    expect((await query({ op: 'in', value: { path: field }, set: ['x'] })).spans).toEqual([]);
    expect((await query({ op: 'notIn', value: { path: field }, set: ['x'] })).spans).toHaveLength(1);
  }
});

it('interrupts only the timed-out query connection', async () => {
  const slow = db.query('SELECT sum(i * sin(i)) FROM range(1000000000) t(i)', [], 20);
  const fast = db.query<{ value: number }>('SELECT 42 AS value');
  await expect(slow).rejects.toBeInstanceOf(DuckDBQueryTimeoutError);
  expect(await fast).toEqual([{ value: 42 }]);
  expect(await db.query('SELECT 1 AS value')).toEqual([{ value: 1 }]);
});
