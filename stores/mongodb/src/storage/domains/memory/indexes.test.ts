import { TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { MemoryStorageMongoDB } from './index';

describe('MemoryStorageMongoDB default indexes', () => {
  it('defines a resource-first composite message index', () => {
    const storage = new MemoryStorageMongoDB({
      connectorHandler: {
        getCollection: async () => ({}) as any,
        close: async () => {},
      },
    });

    expect(storage.getDefaultIndexDefinitions()).toContainEqual({
      collection: TABLE_MESSAGES,
      keys: { resourceId: 1, thread_id: 1 },
    });
    expect(storage.getDefaultIndexDefinitions()).toContainEqual({
      collection: TABLE_THREADS,
      keys: { resourceId: 1, id: 1 },
    });
  });

  it('logs failures and continues creating default indexes', async () => {
    const error = new Error('index build failed');
    const createIndex = vi.fn().mockRejectedValue(error);
    const storage = new MemoryStorageMongoDB({
      connectorHandler: {
        getCollection: async () => ({ createIndex }) as any,
        close: async () => {},
      },
    });
    const warn = vi.spyOn((storage as any).logger, 'warn').mockImplementation(() => {});

    await expect(storage.createDefaultIndexes()).resolves.toBeUndefined();

    expect(createIndex).toHaveBeenCalledTimes(storage.getDefaultIndexDefinitions().length);
    expect(warn).toHaveBeenCalledTimes(storage.getDefaultIndexDefinitions().length);
    expect(warn).toHaveBeenCalledWith('Failed to create default index on mastra_threads:', error);
  });
});
