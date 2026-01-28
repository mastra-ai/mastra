import { it, expect, vi, describe } from 'vitest';
import type { MastraStorage } from './base';
import { augmentWithInit } from './storageWithInit';

describe('augmentWithInit', () => {
  it('should augment the storage with init', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);
    await augmentedStorage.listMessages({ threadId: '1' });

    expect(mockStorage.init).toHaveBeenCalled();
  });

  it("shouln't double augment the storage", async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);
    const extraAugmentedStorage = augmentWithInit(augmentedStorage);

    expect(extraAugmentedStorage).toBe(augmentedStorage);
  });

  it('should NOT call init when disableInit is true', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      disableInit: true,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);
    await augmentedStorage.listMessages({ threadId: '1' });

    expect(mockStorage.init).not.toHaveBeenCalled();
    expect(mockStorage.listMessages).toHaveBeenCalled();
  });

  it('should still allow explicit init() call when disableInit is true', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      disableInit: true,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);

    // Explicit init should work even when disableInit is true
    await augmentedStorage.init();

    expect(mockStorage.init).toHaveBeenCalled();
  });

  it('should default disableInit to false when not specified', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);
    await augmentedStorage.listMessages({ threadId: '1' });

    expect(mockStorage.init).toHaveBeenCalled();
  });

  it('should only call init once when init() is called explicitly first, then other methods', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
      getStore: vi.fn().mockResolvedValue({}),
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);

    // Call init explicitly first
    await augmentedStorage.init();

    // Then call other methods
    await augmentedStorage.listMessages({ threadId: '1' });
    await augmentedStorage.getStore('memory');
    await augmentedStorage.listMessages({ threadId: '2' });

    // init should only be called once despite multiple method calls
    expect(mockStorage.init).toHaveBeenCalledTimes(1);
  });

  it('should only call init once when called multiple times explicitly', async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(true),
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);

    // Call init multiple times
    await augmentedStorage.init();
    await augmentedStorage.init();
    await augmentedStorage.init();

    // init should only be called once
    expect(mockStorage.init).toHaveBeenCalledTimes(1);
  });

  it('should NOT call init when MASTRA_DISABLE_STORAGE_INIT is true', async () => {
    const originalEnv = process.env.MASTRA_DISABLE_STORAGE_INIT;
    process.env.MASTRA_DISABLE_STORAGE_INIT = 'true';

    try {
      const mockStorage = {
        init: vi.fn().mockResolvedValue(true),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
        disableInit: false,
      } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);
      await augmentedStorage.listMessages({ threadId: '1' });

      expect(mockStorage.init).not.toHaveBeenCalled();
      expect(mockStorage.listMessages).toHaveBeenCalled();
    } finally {
      if (originalEnv === undefined) {
        delete process.env.MASTRA_DISABLE_STORAGE_INIT;
      } else {
        process.env.MASTRA_DISABLE_STORAGE_INIT = originalEnv;
      }
    }
  });

  it('should still allow explicit init() call when MASTRA_DISABLE_STORAGE_INIT is true', async () => {
    const originalEnv = process.env.MASTRA_DISABLE_STORAGE_INIT;
    process.env.MASTRA_DISABLE_STORAGE_INIT = 'true';

    try {
      const mockStorage = {
        init: vi.fn().mockResolvedValue(true),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
        disableInit: false,
      } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      // Explicit init should work even when env var is set
      await augmentedStorage.init();

      expect(mockStorage.init).toHaveBeenCalled();
    } finally {
      if (originalEnv === undefined) {
        delete process.env.MASTRA_DISABLE_STORAGE_INIT;
      } else {
        process.env.MASTRA_DISABLE_STORAGE_INIT = originalEnv;
      }
    }
  });
});
