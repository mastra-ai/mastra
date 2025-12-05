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
});
