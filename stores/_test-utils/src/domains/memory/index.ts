import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  type MastraStorage,
} from '@mastra/core/storage';
import { createMessagesPaginatedTest } from './messages-paginated';
import { createThreadsTest } from './threads';
import { createMessagesUpdateTest } from './messages-update';
import { createMessagesBulkDeleteTest } from './messages-bulk-delete';
// import { createResourcesTest } from './resources';
import { beforeAll } from 'vitest';

export function createMemoryTest({ storage }: { storage: MastraStorage }) {
  beforeAll(async () => {
    const start = Date.now();
    console.log('Clearing tables before each test');
    await Promise.all([
      storage.clearTable({ tableName: TABLE_MESSAGES }),
      storage.clearTable({ tableName: TABLE_THREADS }),
      storage.clearTable({ tableName: TABLE_RESOURCES }),
      storage.clearTable({ tableName: TABLE_SCORERS }),
    ]);
    const end = Date.now();
    console.log(`Tables cleared in ${end - start}ms`);
  });

  createThreadsTest({ storage });

  createMessagesPaginatedTest({ storage });

  createMessagesUpdateTest({ storage });

  createMessagesBulkDeleteTest({ storage });

  // createResourcesTest({ storage });
}
