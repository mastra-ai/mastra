import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { createPinnedTools, listPinnedKnowledge } from '../../src/processors/observational-memory/subconscious/pinned';
import { PinnedStateProcessor } from '../../src/processors/observational-memory/subconscious/pinned-state-processor';

describe('Subconscious pinned facts against LibSQL', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  async function createHarness() {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-pins-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'pins.db')}` });
    const knowledge = new Knowledge({
      id: 'pins',
      storage,
      structure: {
        scopes: [
          { address: 'org:acme', name: 'Acme' },
          { address: 'resource:user-42', name: 'User 42', parentAddresses: ['org:acme'] },
          { address: 'resource:user-42:thread:alpha', name: 'Thread alpha', parentAddresses: ['resource:user-42'] },
        ],
      },
    });
    const reconciled = await knowledge.reconcile();
    const scopeIds = [
      reconciled.scopes['org:acme']!,
      reconciled.scopes['resource:user-42']!,
      reconciled.scopes['resource:user-42:thread:alpha']!,
    ];
    const store = (await storage.getStore('knowledge'))!;
    const memory = {
      storage,
      getKnowledgeInstance: () => knowledge,
      getKnowledgeStore: async () => store,
    } as unknown as Parameters<typeof createPinnedTools>[0];
    const tools = createPinnedTools(memory, {
      scopeIds,
      sourceThreadId: 'alpha',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    return { tools, store, storage, knowledge, scopeIds };
  }

  function makeArgs(overrides: Record<string, unknown> = {}) {
    const context = new Map<string, unknown>([['organizationId', 'acme']]);
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

  it('pins, edits and unpins facts durably, keeping deleted facts out of the set', async () => {
    const { tools, store, scopeIds } = await createHarness();

    const pinned = await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any);
    let { pins } = await listPinnedKnowledge({ store, scopeIds });
    expect(pins.map(pin => pin.text)).toEqual(['Always answer in French.']);

    const edited = await tools.knowledge_edit_pin!.execute!(
      { recordId: pinned.id, text: 'Always answer in French. Politely.' } as any,
      {} as any,
    );
    expect(edited.id).not.toBe(pinned.id);
    ({ pins } = await listPinnedKnowledge({ store, scopeIds }));
    expect(pins.map(pin => pin.id)).toEqual([edited.id]);

    await tools.knowledge_unpin!.execute!({ recordId: edited.id } as any, {} as any);
    ({ pins } = await listPinnedKnowledge({ store, scopeIds }));
    expect(pins).toHaveLength(0);

    const rawDeleted = await store.getRecord({ id: edited.id, includeDeleted: true });
    expect(rawDeleted?.deletedAt).toBeTruthy();
  });

  it('drives the processor end to end: snapshot, delta, and lane clear on unpin', async () => {
    const { tools, storage, knowledge } = await createHarness();
    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => knowledge,
      getKnowledgeStore: () => (storage as any).getStore('knowledge'),
    });

    const first = await tools.knowledge_pin!.execute!({ text: 'first pin' } as any, {} as any);
    const snapshot = await processor.computeStateSignal(makeArgs());
    expect(snapshot).toMatchObject({ mode: 'snapshot' });
    expect(snapshot!.contents).toContain('first pin');

    const second = await tools.knowledge_pin!.execute!({ text: 'second pin' } as any, {} as any);
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

    await tools.knowledge_unpin!.execute!({ recordId: first.id } as any, {} as any);
    await tools.knowledge_unpin!.execute!({ recordId: second.id } as any, {} as any);
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
