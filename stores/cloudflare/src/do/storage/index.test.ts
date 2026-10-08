import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

import { createRunFencingTests } from '@internal/storage-test-utils';
import { beforeAll, describe, vi } from 'vitest';

import { CloudflareDOStorage } from '../index';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/**
 * Stands in for a Durable Object's `ctx.storage.sql` with a real SQLite database. Like workerd's
 * SqlStorage, `exec` runs synchronously and binds only strings, numbers, null and bytes, and
 * transaction statements are refused (workerd only allows `transactionSync()`).
 */
function createSqlStorage() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(query: string, ...bindings: SQLInputValue[]) {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(query)) {
        throw new Error('Durable Object SqlStorage does not allow transaction statements; use transactionSync()');
      }
      const rows = db.prepare(query).all(...bindings) as Record<string, unknown>[];
      return { toArray: () => rows };
    },
  };
}

describe('CloudflareDOStorage', () => {
  const storage = new CloudflareDOStorage({ sql: createSqlStorage() as never, tablePrefix: 'test_' });

  beforeAll(async () => {
    await storage.init();
  });

  createRunFencingTests({ storage });
});
