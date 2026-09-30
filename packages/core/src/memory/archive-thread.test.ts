import { describe, expect, it, vi } from 'vitest';

import { MastraError } from '../error';
import { InMemoryStore } from '../storage';

import { MockMemory } from './mock';

async function setup() {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  await memory.saveThread({
    thread: { id: 't1', resourceId: 'r1', title: 'T', createdAt: new Date(), updatedAt: new Date() },
  });
  return memory;
}

describe('archiveThread / unarchiveThread', () => {
  it('keeps the original archivedAt when archiving an already archived thread', async () => {
    const memory = await setup();
    const first = await memory.archiveThread({ threadId: 't1' });
    const spy = vi.spyOn(memory, 'updateThread');

    const second = await memory.archiveThread({ threadId: 't1' });

    expect(second.archivedAt).toEqual(first.archivedAt);
    expect(spy).not.toHaveBeenCalled();
  });

  it('is a no-op when unarchiving an active thread', async () => {
    const memory = await setup();
    const spy = vi.spyOn(memory, 'updateThread');

    const thread = await memory.unarchiveThread({ threadId: 't1' });

    expect(thread.archivedAt ?? null).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('throws when the thread does not exist', async () => {
    const memory = await setup();
    await expect(memory.archiveThread({ threadId: 'missing' })).rejects.toThrow(/not found/i);
    await expect(memory.unarchiveThread({ threadId: 'missing' })).rejects.toThrow(/not found/i);
  });

  it('throws when the storage adapter ignores archivedAt on archive', async () => {
    const memory = await setup();
    vi.spyOn(memory, 'updateThread').mockImplementation(
      async ({ id }) => (await memory.getThreadById({ threadId: id }))!,
    );

    await expect(memory.archiveThread({ threadId: 't1' })).rejects.toThrow(MastraError);
    await expect(memory.archiveThread({ threadId: 't1' })).rejects.toThrow(/does not support thread archiving/);
  });

  it('throws when the storage adapter ignores archivedAt on unarchive', async () => {
    const memory = await setup();
    await memory.archiveThread({ threadId: 't1' });
    vi.spyOn(memory, 'updateThread').mockImplementation(
      async ({ id }) => (await memory.getThreadById({ threadId: id }))!,
    );

    await expect(memory.unarchiveThread({ threadId: 't1' })).rejects.toThrow(/does not support thread archiving/);
  });
});
