import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { Memory } from './index';

describe('Memory.archiveThread / unarchiveThread', () => {
  const resourceId = 'archive-test-resource';
  let memory: Memory;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId,
        title: 'Archivable',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });
  });

  const activeIds = async () =>
    (await memory.listThreads({ filter: { resourceId, archived: false } })).threads.map(t => t.id);
  const archivedIds = async () =>
    (await memory.listThreads({ filter: { resourceId, archived: true } })).threads.map(t => t.id);

  it('given an active thread, when archived, then it is excluded from non-archived listings', async () => {
    const archived = await memory.archiveThread({ threadId: 'thread-1' });

    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(await activeIds()).toEqual([]);
    expect(await archivedIds()).toEqual(['thread-1']);
  });

  it('given an archived thread, when unarchived, then it is listed as active again', async () => {
    await memory.archiveThread({ threadId: 'thread-1' });
    const restored = await memory.unarchiveThread({ threadId: 'thread-1' });

    expect(restored.archivedAt).toBeNull();
    expect(await activeIds()).toEqual(['thread-1']);
    expect(await archivedIds()).toEqual([]);
  });

  it('given an archived thread, then updatedAt is not bumped', async () => {
    const archived = await memory.archiveThread({ threadId: 'thread-1' });
    expect(archived.updatedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('given an archived thread, when archived again, then the original archivedAt is kept', async () => {
    const first = await memory.archiveThread({ threadId: 'thread-1' });
    await new Promise(r => setTimeout(r, 5));
    const second = await memory.archiveThread({ threadId: 'thread-1' });
    expect(second.archivedAt).toEqual(first.archivedAt);
  });

  it('given an unknown thread, when archived, then it throws', async () => {
    await expect(memory.archiveThread({ threadId: 'missing' })).rejects.toThrow();
    await expect(memory.unarchiveThread({ threadId: 'missing' })).rejects.toThrow();
  });
});
