import { createSpanQueryTests } from '@internal/storage-test-utils';
import type { ObservabilityStorage } from '@mastra/core/storage';
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

it('interrupts only the timed-out query connection', async () => {
  const slow = db.query('SELECT sum(i * sin(i)) FROM range(1000000000) t(i)', [], 20);
  const fast = db.query<{ value: number }>('SELECT 42 AS value');
  await expect(slow).rejects.toBeInstanceOf(DuckDBQueryTimeoutError);
  expect(await fast).toEqual([{ value: 42 }]);
  expect(await db.query('SELECT 1 AS value')).toEqual([{ value: 1 }]);
});
