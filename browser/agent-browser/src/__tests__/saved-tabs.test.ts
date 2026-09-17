import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { SavedBrowserTabs } from '../saved-tabs';

const setup = async () => {
  const storage = new InMemoryStore();
  const memory = (await storage.getStore('memory'))!;
  await memory.saveThread({
    thread: {
      id: 'chat',
      resourceId: 'owner',
      title: 'Keep title',
      metadata: { other: 'Keep metadata' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return { storage, memory, options: { storage, threadId: 'chat', resourceId: 'owner' } };
};

describe('native saved browser tabs', () => {
  it('restores URLs and selected duplicate tab from a new object', async () => {
    const { options, memory } = await setup();
    const state = { tabs: [{ url: 'https://example.com' }, { url: 'https://example.com' }], activeTabIndex: 1 };
    await new SavedBrowserTabs(options).save(state);
    expect(await new SavedBrowserTabs(options).load()).toEqual(state);
    const thread = await memory.getThreadById({ threadId: 'chat' });
    expect(thread?.title).toBe('Keep title');
    expect(thread?.metadata?.other).toBe('Keep metadata');
  });

  it('does not restore executable or local-file URLs', async () => {
    const { options } = await setup();
    const store = new SavedBrowserTabs(options);
    await store.save({
      tabs: [{ url: 'file:///secret' }, { url: 'javascript:alert(1)' }, { url: 'https://example.com/page' }],
      activeTabIndex: 2,
    });
    expect(await store.load()).toEqual({ tabs: [{ url: 'https://example.com/page' }], activeTabIndex: 0 });
  });

  it('rejects reads and writes from a different owner', async () => {
    const { options } = await setup();
    const other = new SavedBrowserTabs({ ...options, resourceId: 'other' });
    await expect(other.load()).rejects.toThrow('unavailable');
    await expect(other.save({ tabs: [], activeTabIndex: 0 })).rejects.toThrow('unavailable');
  });

  it('rejects a missing thread instead of manufacturing it', async () => {
    const { options } = await setup();
    await expect(new SavedBrowserTabs({ ...options, threadId: 'missing' }).load()).rejects.toThrow('unavailable');
  });

  it('rejects malformed saved state', async () => {
    const { options, memory } = await setup();
    await memory.patchThread({ id: 'chat', metadata: { mastra_browser_saved_tabs: { tabs: 'wrong' } } });
    await expect(new SavedBrowserTabs(options).load()).rejects.toThrow();
  });
});
