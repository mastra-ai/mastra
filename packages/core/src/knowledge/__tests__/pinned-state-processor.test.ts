import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { createPinnedTools } from '../pinned';
import { PinnedStateProcessor } from '../pinned-state-processor';

// A run's Knowledge scope with no tags is its Memory identity.
const threadScope = ['resource:user-42', 'thread:alpha'];

describe('PinnedStateProcessor', () => {
  async function createHarness() {
    const storage = new InMemoryStore({ id: 'pinned-state-processor' });
    const memory = { storage } as unknown as Parameters<typeof createPinnedTools>[0];
    const tools = createPinnedTools(memory, {
      scope: threadScope,
      sourceThreadId: 'alpha',
      maxPins: 20,
      maxTokens: 500,
    });
    const store = (await storage.getStore('knowledge'))!;
    return { tools, store, storage };
  }

  function makeArgs(overrides: Record<string, unknown> = {}) {
    const context = new Map<string, unknown>();
    return {
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: {
        get: (key: string) => context.get(key),
        set: (key: string, value: unknown) => void context.set(key, value),
      },
      contextWindow: { hasSnapshot: false },
      lastSnapshot: undefined,
      deltasSinceSnapshot: [],
      tracking: undefined,
      ...overrides,
    } as any;
  }

  it('drives the processor end to end: snapshot, delta, and lane clear on unpin', async () => {
    const { tools, storage } = await createHarness();
    const processor = new PinnedStateProcessor({
      getKnowledgeStore: () => (storage as any).getStore('knowledge'),
    });

    const first = await tools.knowledge_pin!.execute!({ op: 'pin', text: 'first pin' } as any, {} as any);
    const snapshot = await processor.computeStateSignal(makeArgs());
    expect(snapshot).toMatchObject({ mode: 'snapshot' });
    expect(snapshot!.contents).toContain('first pin');

    const second = await tools.knowledge_pin!.execute!({ op: 'pin', text: 'second pin' } as any, {} as any);
    const delta = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {
          metadata: { state: { mode: 'snapshot' }, value: { pins: [{ id: first.id, text: 'first pin' }] } },
        },
      }),
    );
    expect(delta).toMatchObject({ mode: 'delta' });
    expect((delta as any).delta.ops).toEqual([{ op: 'add', pin: { id: second.id, text: 'second pin' } }]);

    await tools.knowledge_pin!.execute!({ op: 'unpin', recordId: first.id } as any, {} as any);
    await tools.knowledge_pin!.execute!({ op: 'unpin', recordId: second.id } as any, {} as any);
    const clear = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {
          metadata: {
            state: { mode: 'snapshot' },
            value: {
              pins: [
                { id: first.id, text: 'first pin' },
                { id: second.id, text: 'second pin' },
              ],
            },
          },
        },
      }),
    );
    expect(clear).toMatchObject({ mode: 'snapshot', contents: '', attributes: { count: 0 } });
  });
});
