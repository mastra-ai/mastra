import { it, expect, vi } from 'vitest';
import type { MastraStorage } from './base';
import { augmentWithInit } from './storageWithInit';

it("shouln't double augment the storage", async () => {
  const mockStorage = {
    init: vi.fn().mockResolvedValue(true),
    listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0, hasMore: false }),
  } as unknown as MastraStorage;

  const augmentedStorage = augmentWithInit(mockStorage);
  const extraAugmentedStorage = augmentWithInit(augmentedStorage);

  expect(extraAugmentedStorage).toBe(augmentedStorage);
});

it('should trigger init when getStore is called', async () => {
  const mockStorage = {
    init: vi.fn().mockResolvedValue(undefined),
    getStore: vi.fn().mockReturnValue({}),
  } as unknown as MastraStorage;

  const augmentedStorage = augmentWithInit(mockStorage);
  await augmentedStorage.getStore('memory');

  expect(mockStorage.init).toHaveBeenCalled();
});
