import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

import { createLargeIdListTests } from '@internal/storage-test-utils';
import { beforeAll, describe, vi } from 'vitest';

import { CloudflareDOStorage } from '../../../index';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/**
 * `ctx.storage.sql` refuses a statement with more than 100 bound parameters ("too many SQL
 * variables"), which is what breaks large id lists in production.
 */
const MAX_BOUND_PARAMETERS = 100;

/**
 * Stands in for a Durable Object's `ctx.storage.sql` with a real SQLite database. Like workerd's
 * SqlStorage, `exec` runs synchronously, binds only strings, numbers, null and bytes, and refuses
 * transaction statements (workerd only allows `transactionSync()`).
 *
 * It also enforces the 100-bound-parameter cap, which node:sqlite does not (its own limit is far
 * higher), so without this check a statement with too many parameters would quietly succeed here
 * and the regression would go unnoticed.
 */
function createSqlStorage() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(query: string, ...bindings: SQLInputValue[]) {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(query)) {
        throw new Error('Durable Object SqlStorage does not allow transaction statements; use transactionSync()');
      }
      if (bindings.length > MAX_BOUND_PARAMETERS) {
        throw new Error(`too many SQL variables at offset 0: SQLITE_ERROR`);
      }
      const rows = db.prepare(query).all(...bindings) as Record<string, unknown>[];
      return { toArray: () => rows };
    },
  };
}

describe('CloudflareDOStorage', () => {
  const storage = new CloudflareDOStorage({ sql: createSqlStorage() as never, tablePrefix: 'large_list_' });

  beforeAll(async () => {
    await storage.init();
  });

  createLargeIdListTests({ storage });
});
