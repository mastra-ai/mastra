import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { beforeAll } from 'vitest';
import { createMessagesBulkDeleteTest } from './messages-bulk-delete';
import { createMessagesListTest } from './messages-list';
import { createListMessagesTest } from './messages-paginated';
import { createMessagesUpdateTest } from './messages-update';
import { createObservationalMemoryTest } from './observational-memory';
import { createPendingSignalsTest } from './pending-signals';
import { createResourcesTest } from './resources';
import { createThreadsTest } from './threads';

export function createMemoryTest({ storage, peerStorage }: { storage: MastraStorage; peerStorage?: MastraStorage }) {
  let memoryStorage: MemoryStorage;

  beforeAll(async () => {
    const store = await storage.getStore('memory');
    if (!store) {
      throw new Error('Memory storage not found');
    }
    memoryStorage = store;

    const start = Date.now();
    console.log('Clearing memory domain data before tests');
    await memoryStorage.dangerouslyClearAll();
    const end = Date.now();
    console.log(`Memory domain cleared in ${end - start}ms`);
  });

  createThreadsTest({ storage });

  createMessagesListTest({ storage });

  createListMessagesTest({ storage });

  createMessagesUpdateTest({ storage });

  createMessagesBulkDeleteTest({ storage });

  createResourcesTest({ storage });

  createObservationalMemoryTest({ storage });

  createPendingSignalsTest({ storage, peerStorage });
}
