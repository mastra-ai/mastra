import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from './index';

// Threads written before Subconscious was removed may own a hidden remind thread,
// `subconscious:<parent>:remind`, tagged with its parent in metadata. Deleting the
// parent still deletes it, and never deletes one it doesn't own.
describe('legacy Subconscious remind threads', () => {
  async function setup() {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('memory'))!;
    await store.saveThread({
      thread: { id: 'parent', resourceId: 'user-1', title: 'p', createdAt: new Date(), updatedAt: new Date() },
    });
    return { memory, store };
  }

  it('deletes the remind thread a deleted thread owns', async () => {
    const { memory, store } = await setup();
    await store.saveThread({
      thread: {
        id: 'subconscious:parent:remind',
        resourceId: 'user-1',
        title: 'remind',
        metadata: { subconsciousRemindParentThreadId: 'parent' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await memory.deleteThread('parent');

    expect(await store.getThreadById({ threadId: 'parent' })).toBeNull();
    expect(await store.getThreadById({ threadId: 'subconscious:parent:remind' })).toBeNull();
  });

  it("keeps a remind-named thread of another resource or without the parent's metadata", async () => {
    for (const thread of [
      { resourceId: 'user-2', metadata: { subconsciousRemindParentThreadId: 'parent' } },
      { resourceId: 'user-1', metadata: {} },
    ]) {
      const { memory, store } = await setup();
      await store.saveThread({
        thread: {
          id: 'subconscious:parent:remind',
          title: 'remind',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...thread,
        },
      });

      await memory.deleteThread('parent');

      expect(await store.getThreadById({ threadId: 'parent' })).toBeNull();
      expect(await store.getThreadById({ threadId: 'subconscious:parent:remind' })).not.toBeNull();
    }
  });
});
