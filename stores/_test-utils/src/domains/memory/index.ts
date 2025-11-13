import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  type MastraStorage,
} from '@mastra/core/storage';
import { createListMessagesTest } from './messages-paginated';
import { createThreadsTest } from './threads';
import { createMessagesUpdateTest } from './messages-update';
import { createMessagesBulkDeleteTest } from './messages-bulk-delete';
import { createResourcesTest } from './resources';
import { beforeAll } from 'vitest';
import { createMessagesListTest } from './messages-list';

export function createMemoryTest({ storage }: { storage: MastraStorage }) {
  beforeAll(async () => {
    const start = Date.now();
    console.log('Clearing tables before each test');

    await Promise.all([(await storage.getStore('memory'))?.dropData(), (await storage.getStore('evals'))?.dropData()]);
    const end = Date.now();
    console.log(`Tables cleared in ${end - start}ms`);
  });

  createThreadsTest({ storage });

  createMessagesListTest({ storage });

  createListMessagesTest({ storage });

  createMessagesUpdateTest({ storage });

  createMessagesBulkDeleteTest({ storage });

  createResourcesTest({ storage });
}
