import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setRunAgentScopes } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveRunKnowledgeScopes } from '../../src/processors/observational-memory/subconscious/knowledge-tools';
import { createPinnedTools, listPinnedKnowledge } from '../../src/processors/observational-memory/subconscious/pinned';
import { PinnedStateProcessor } from '../../src/processors/observational-memory/subconscious/pinned-state-processor';

function orgContext() {
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  return requestContext;
}

describe('Subconscious pinned facts against LibSQL', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  async function createHarness() {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-pins-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'pins.db')}` });
    await storage.init();
    const memory = { storage } as unknown as Parameters<typeof createPinnedTools>[0];
    const { scopeIds, levels } = await resolveRunKnowledgeScopes(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: orgContext(),
    });
    const tools = createPinnedTools(memory, {
      scopeIds,
      levels,
      sourceThreadId: 'alpha',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    const store = (await storage.getStore('knowledge'))!;
    return { tools, store, storage, scopeIds };
  }

  function makeArgs(overrides: Record<string, unknown> = {}) {
    return {
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: orgContext(),
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
    const { tools, storage } = await createHarness();
    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => undefined,
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
