import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Knowledge, listPinnedKnowledge } from '@mastra/core/knowledge';

import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

// A run's Knowledge scope with no tags is its Memory identity.
const threadScope = ['resource:user-42', 'thread:alpha'];

describe('Knowledge pinned facts against LibSQL', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  async function createHarness() {
    const directory = await mkdtemp(join(tmpdir(), 'knowledge-pins-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'pins.db')}` });
    await storage.init();
    const knowledge = new Knowledge({ id: 'pins', storage, pinnedContext: { maxPins: 20, maxTokens: 500 } });
    const tools = knowledge.createTools();
    const store = (await storage.getStore('knowledge'))!;
    return { tools, store };
  }

  it('pins, edits and unpins facts durably, keeping deleted facts out of the set', async () => {
    const { tools, store } = await createHarness();
    const run = { agent: { agentId: 'curator', resourceId: 'user-42', threadId: 'alpha' } } as any;

    const pinned = await tools.knowledge_pin!.execute!({ op: 'pin', text: 'Always answer in French.' } as any, run);
    let { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins.map(pin => pin.text)).toEqual(['Always answer in French.']);

    const edited = await tools.knowledge_pin!.execute!(
      { op: 'edit', recordId: pinned.id, text: 'Always answer in French. Politely.' } as any,
      run,
    );
    expect(edited.id).not.toBe(pinned.id);
    ({ pins } = await listPinnedKnowledge({ store, scope: threadScope }));
    expect(pins.map(pin => pin.id)).toEqual([edited.id]);

    await tools.knowledge_pin!.execute!({ op: 'unpin', recordId: edited.id } as any, run);
    ({ pins } = await listPinnedKnowledge({ store, scope: threadScope }));
    expect(pins).toHaveLength(0);

    const rawDeleted = await store.getKnowledge({ id: edited.id, includeDeleted: true });
    expect(rawDeleted?.deletedAt).toBeTruthy();
  });
});
