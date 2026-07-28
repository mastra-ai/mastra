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

  it('keeps internal housekeeping methods synchronous without initializing storage', () => {
    const init = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const registerMastra = vi.fn();
    const setLogger = vi.fn();
    const setRawConfig = vi.fn();
    const mockStorage = {
      init,
      __registerMastra: registerMastra,
      __setLogger: setLogger,
      __setRawConfig: setRawConfig,
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);
    const mastra = {};
    const logger = { child: vi.fn() };
    const rawConfig = {};

    const registerResult = augmentedStorage.__registerMastra(mastra);
    const setLoggerResult = augmentedStorage.__setLogger(logger as any);
    const setRawConfigResult = augmentedStorage.__setRawConfig(rawConfig);

    expect(registerResult).toBeUndefined();
    expect(setLoggerResult).toBeUndefined();
    expect(setRawConfigResult).toBeUndefined();
    expect(registerMastra).toHaveBeenCalledWith(mastra);
    expect(setLogger).toHaveBeenCalledWith(logger);
    expect(setRawConfig).toHaveBeenCalledWith(rawConfig);
    expect(init).not.toHaveBeenCalled();
  });

  it('supports explicit init() calls when init is synchronous', async () => {
    const init = vi.fn();
    const mockStorage = {
      init,
      disableInit: false,
    } as unknown as MastraStorage;

    const augmentedStorage = augmentWithInit(mockStorage);

    await augmentedStorage.init();
    await augmentedStorage.init();

    expect(init).toHaveBeenCalledTimes(1);
  });

  // Regression coverage: previously a single rejected init promise was cached
  // forever, causing every subsequent storage call to surface the same error
  // with no recovery short of a process restart. Now a rejection clears the
  // cache so the next call retries.
  describe('init rejection handling', () => {
    it('retries init on the next call after a rejection', async () => {
      const init = vi.fn().mockRejectedValueOnce(new Error('transient boot failure')).mockResolvedValueOnce(undefined);
      const listMessages = vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false });
      const mockStorage = { init, listMessages, disableInit: false } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      await expect(augmentedStorage.listMessages({ threadId: '1' })).rejects.toThrow('transient boot failure');
      // Subsequent call retries init instead of replaying the cached rejection.
      await augmentedStorage.listMessages({ threadId: '2' });

      expect(init).toHaveBeenCalledTimes(2);
      expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it('all concurrent callers see the same rejection and the next call retries', async () => {
      const init = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
      const listMessages = vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false });
      const mockStorage = { init, listMessages, disableInit: false } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      const results = await Promise.allSettled([
        augmentedStorage.listMessages({ threadId: 'a' }),
        augmentedStorage.listMessages({ threadId: 'b' }),
        augmentedStorage.listMessages({ threadId: 'c' }),
      ]);

      expect(results.every(r => r.status === 'rejected')).toBe(true);
      // The 3 concurrent callers should have shared a single in-flight init,
      // not each triggered their own.
      expect(init).toHaveBeenCalledTimes(1);

      await augmentedStorage.listMessages({ threadId: 'd' });
      expect(init).toHaveBeenCalledTimes(2);
      expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it('retries init on an explicit init() call after a rejection', async () => {
      const init = vi.fn().mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce(undefined);
      const mockStorage = { init, disableInit: false } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      await expect(augmentedStorage.init()).rejects.toThrow('first');
      await augmentedStorage.init();

      expect(init).toHaveBeenCalledTimes(2);
    });

    it('logs a clear error message when init fails', async () => {
      const error = new Error('db unreachable');
      const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
      const init = vi.fn().mockRejectedValue(error);
      const mockStorage = { init, logger, disableInit: false } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      await expect(augmentedStorage.init()).rejects.toThrow('db unreachable');

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, context] = logger.error.mock.calls[0]!;
      expect(message).toMatch(/init failed/i);
      expect(context).toMatchObject({ error });
    });

    it('still caches a successful init after a retry', async () => {
      const init = vi.fn().mockRejectedValueOnce(new Error('once')).mockResolvedValue(undefined);
      const listMessages = vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false });
      const mockStorage = { init, listMessages, disableInit: false } as unknown as MastraStorage;

      const augmentedStorage = augmentWithInit(mockStorage);

      await expect(augmentedStorage.listMessages({ threadId: '1' })).rejects.toThrow('once');
      await augmentedStorage.listMessages({ threadId: '2' });
      await augmentedStorage.listMessages({ threadId: '3' });
      await augmentedStorage.listMessages({ threadId: '4' });

      // Two init invocations total: the first failed, the second succeeded
      // and is then reused by the remaining calls.
      expect(init).toHaveBeenCalledTimes(2);
      expect(listMessages).toHaveBeenCalledTimes(3);
    });
  });
});
