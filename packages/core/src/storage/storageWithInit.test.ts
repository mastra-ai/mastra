import { it, expect, vi } from 'vitest';
import type { MastraStorage } from './base';
import { augmentWithInit } from './storageWithInit';

it('should augment the storage with init', async () => {
  const mockStorage = {
    init: vi.fn().mockResolvedValue(true),
    listMessages: vi.fn().mockResolvedValue({ messages: [] }),
  } as unknown as MastraStorage;

  const augmentedStorage = augmentWithInit(mockStorage);
  await augmentedStorage.listMessages({ threadId: '1' });

  expect(mockStorage.init).toHaveBeenCalled();
});

it("shouln't double augment the storage", async () => {
  const mockStorage = {
    init: vi.fn().mockResolvedValue(true),
    listMessages: vi.fn().mockResolvedValue({ messages: [] }),
  } as unknown as MastraStorage;

  const augmentedStorage = augmentWithInit(mockStorage);
  const extraAugmentedStorage = augmentWithInit(augmentedStorage);

  expect(extraAugmentedStorage).toBe(augmentedStorage);
});
