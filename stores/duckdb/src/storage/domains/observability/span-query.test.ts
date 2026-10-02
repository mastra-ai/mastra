import { createSpanQueryTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { DuckDBConnection, DuckDBQueryTimeoutError } from '../../db';
import { ObservabilityStorageDuckDB } from './index';

const db = new DuckDBConnection({ path: ':memory:' });
const storage = new ObservabilityStorageDuckDB({ db });
beforeAll(() => storage.init());
afterAll(() => db.close());
createSpanQueryTests(() => storage, { eventSourced: true });

it('interrupts only the timed-out query connection', async () => {
  const slow = db.query('SELECT sum(i * sin(i)) FROM range(1000000000) t(i)', [], 20);
  const fast = db.query<{ value: number }>('SELECT 42 AS value');
  await expect(slow).rejects.toBeInstanceOf(DuckDBQueryTimeoutError);
  expect(await fast).toEqual([{ value: 42 }]);
  expect(await db.query('SELECT 1 AS value')).toEqual([{ value: 1 }]);
});
