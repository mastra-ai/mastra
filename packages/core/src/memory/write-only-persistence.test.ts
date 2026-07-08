/**
 * Write-only memory: `lastMessages: false` must still persist turns.
 *
 * `lastMessages` gates recall on the input side only; saving is on by default and
 * is disabled via `readOnly`, per the documented semantics ("To prevent saving new
 * messages, use the readOnly option instead"). This lets `lastMessages: false` act
 * as a one-way / write-only mirror: no recalled history is injected into the prompt,
 * but each turn is still persisted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MastraStorage, MemoryStorage } from '../storage';

import { MockMemory } from './mock';

describe('MastraMemory write-only persistence (lastMessages: false)', () => {
  let mockStorage: MastraStorage;
  let mockMemoryStore: MemoryStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMemoryStore = {
      getThreadById: vi.fn().mockResolvedValue(null),
      saveThread: vi.fn().mockImplementation(({ thread }) => Promise.resolve(thread)),
      listMessages: vi.fn().mockResolvedValue({ messages: [] }),
      getMessages: vi.fn().mockResolvedValue([]),
      saveMessages: vi.fn().mockResolvedValue({ messages: [] }),
    } as unknown as MemoryStorage;

    mockStorage = {
      getStore: vi.fn().mockResolvedValue(mockMemoryStore),
      init: vi.fn().mockResolvedValue(undefined),
    } as unknown as MastraStorage;
  });

  const makeMemory = (storage: MastraStorage) =>
    new MockMemory({ storage: storage as any, enableMessageHistory: false, options: { lastMessages: false } });

  it('registers the message-history save processor even when lastMessages is false', async () => {
    const memory = makeMemory(mockStorage);
    const output = await memory.getOutputProcessors();
    expect(output.some(p => p.id === 'message-history')).toBe(true);
  });

  it('does not register recall (input message-history) when lastMessages is false', async () => {
    const memory = makeMemory(mockStorage);
    const input = await memory.getInputProcessors();
    expect(input.some(p => p.id === 'message-history')).toBe(false);
  });

  it('still requires a storage adapter to save (throws MESSAGE_HISTORY_MISSING_STORAGE_ADAPTER)', async () => {
    const noStore = {
      getStore: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
    } as unknown as MastraStorage;
    const memory = makeMemory(noStore);
    await expect(memory.getOutputProcessors()).rejects.toThrow(/storage adapter/i);
  });
});
