import type { MastraStorage, InboxStorage } from '@mastra/core/storage';
import { createTasksTest } from './tasks';
import { createClaimTest } from './claim';
import { createSuspendTest } from './suspend';
import { createStatsTest } from './stats';
import { beforeAll } from 'vitest';

/**
 * Creates a comprehensive test suite for InboxStorage implementations.
 *
 * Use this to verify that a storage adapter correctly implements all
 * inbox storage operations.
 *
 * @example
 * ```typescript
 * import { createInboxTest } from '@internal/storage-test-utils';
 *
 * describe('PostgresStore Inbox', () => {
 *   const storage = new PostgresStore({ connectionString: '...' });
 *
 *   createInboxTest({ storage });
 * });
 * ```
 */
export function createInboxTest({ storage }: { storage: MastraStorage }) {
  let inboxStorage: InboxStorage;

  beforeAll(async () => {
    const store = await storage.getStore('inbox');
    if (!store) {
      throw new Error('Inbox storage not found');
    }
    inboxStorage = store;

    const start = Date.now();
    console.log('Clearing inbox domain data before tests');
    await inboxStorage.dangerouslyClearAll?.();
    const end = Date.now();
    console.log(`Inbox domain cleared in ${end - start}ms`);
  });

  createTasksTest({ storage });
  createClaimTest({ storage });
  createSuspendTest({ storage });
  createStatsTest({ storage });
}
