import type { ProcessorContext } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  createKnowledgeWriteTools,
  PINNED_KNOWLEDGE_PAGE,
  publishSubconsciousPinned,
  Subconscious,
  SUBCONSCIOUS_PINNED_STATE_ID,
} from '../subconscious';

const resourceScope = ['org:acme', 'resource:user-42'];
const threadScope = [...resourceScope, 'thread:alpha'];

async function createStore() {
  const storage = new InMemoryStore();
  return (await storage.getStore('knowledge'))!;
}

describe('Subconscious pinned knowledge', () => {
  it('is off unless configured, and resolves a bounded budget when enabled', () => {
    expect(new Subconscious().resolved.pins).toBe(false);
    expect(new Subconscious({ pins: false }).resolved.pins).toBe(false);
    expect(new Subconscious({ pins: true }).resolved.pins).toEqual({ maxCharacters: 2_000 });
    expect(new Subconscious({ pins: { maxCharacters: 500 } }).resolved.pins).toEqual({ maxCharacters: 500 });
    expect(() => new Subconscious({ pins: { maxCharacters: 100_000 } })).toThrow(/maxCharacters/);
    expect(() => new Subconscious({ pins: { maxCharacters: 0 } })).toThrow(/maxCharacters/);
  });

  it('publishes the pinned page as a snapshot state signal, and stays silent when there is nothing pinned', async () => {
    const store = await createStore();
    const sendStateSignal = vi.fn() as unknown as ProcessorContext['sendStateSignal'];

    await publishSubconsciousPinned({ store, scope: threadScope, maxCharacters: 2_000, sendStateSignal });
    expect(sendStateSignal).not.toHaveBeenCalled();

    await store.createPage({
      name: PINNED_KNOWLEDGE_PAGE,
      body: 'Always answer in French.',
      scope: resourceScope,
    });

    const snapshot = await publishSubconsciousPinned({
      store,
      scope: threadScope,
      maxCharacters: 2_000,
      sendStateSignal,
    });

    expect(snapshot?.body).toBe('Always answer in French.');
    expect(sendStateSignal).toHaveBeenCalledTimes(1);
    const signal = (sendStateSignal as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(signal).toMatchObject({
      id: SUBCONSCIOUS_PINNED_STATE_ID,
      mode: 'snapshot',
      contents: 'Always answer in French.',
    });
    expect(signal.cacheKey).toEqual(expect.any(String));
  });

  it('reuses the cache key while the pinned page is unchanged', async () => {
    const store = await createStore();
    const sendStateSignal = vi.fn() as unknown as ProcessorContext['sendStateSignal'];
    const page = await store.createPage({
      name: PINNED_KNOWLEDGE_PAGE,
      body: 'Never force push.',
      scope: resourceScope,
    });

    await publishSubconsciousPinned({ store, scope: threadScope, maxCharacters: 2_000, sendStateSignal });
    await publishSubconsciousPinned({ store, scope: threadScope, maxCharacters: 2_000, sendStateSignal });
    await store.updatePage({ id: page.id, version: page.version, body: 'Never force push to main.' });
    await publishSubconsciousPinned({ store, scope: threadScope, maxCharacters: 2_000, sendStateSignal });

    const keys = (sendStateSignal as unknown as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0].cacheKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('rejects a pinned page over its budget on the write path', async () => {
    const storage = new InMemoryStore();
    const memory = { storage } as unknown as Parameters<typeof createKnowledgeWriteTools>[0];
    const tools = createKnowledgeWriteTools(memory, {
      scope: threadScope,
      sourceThreadId: 'alpha',
      defaultScope: 'resource',
      pinnedMaxCharacters: 40,
    });

    await expect(
      tools.knowledge_write_page!.execute!({ name: PINNED_KNOWLEDGE_PAGE, body: 'x'.repeat(41) } as any, {} as any),
    ).rejects.toThrow(/limited to 40 characters/);

    await expect(
      tools.knowledge_write_page!.execute!({ name: PINNED_KNOWLEDGE_PAGE, body: 'x'.repeat(40) } as any, {} as any),
    ).resolves.toMatchObject({ name: PINNED_KNOWLEDGE_PAGE });
  });
});
