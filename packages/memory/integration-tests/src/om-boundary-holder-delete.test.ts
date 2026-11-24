import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RESOURCE = 'om-boundary-delete-resource';

function open(dbPath: string) {
  const unused = () => new MockLanguageModelV2({ doGenerate: async () => ({}) as any });
  const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: false,
      observationalMemory: {
        scope: 'thread',
        observation: { model: unused(), messageTokens: 5_000_000, bufferTokens: false },
        reflection: { model: unused(), observationTokens: 5_000_000 },
      },
    },
  });
  return { storage, memory };
}

function sealedBoundaryHolder(threadId: string, id: string, createdAt: Date): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId: RESOURCE,
    role: 'assistant',
    createdAt,
    content: {
      format: 2,
      parts: [
        { type: 'text', text: 'Observed words. '.repeat(20) },
        { type: 'data-om-observation-end', data: { cycleId: 'c', operationType: 'observation' } } as any,
      ],
      metadata: { mastra: { sealed: true } },
    },
  };
}

describe('Observational Memory saving a sealed message that holds a completed boundary', () => {
  let dbDir: string;
  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-boundary-delete-'));
  });
  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  async function setup(name: string) {
    const { storage, memory } = open(join(dbDir, `${name}.db`));
    const threadId = randomUUID();
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const memoryStore = (await storage.getStore('memory'))!;
    return { memory, memoryStore, threadId, om: (await memory.omEngine)! };
  }

  it('does not bring back a remembered message that was deleted during the turn', async () => {
    const { memory, memoryStore, threadId, om } = await setup('deleted');
    const id = `${threadId}-holder`;
    // Stored sealed, loaded at turn start (so remembered), then gains an end marker during the turn.
    await memory.saveMessages({
      messages: [
        {
          ...sealedBoundaryHolder(threadId, id, new Date(0)),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Observed words. '.repeat(20) }],
            metadata: { mastra: { sealed: true } },
          },
        },
      ],
    });
    const list = new MessageList({ threadId, resourceId: RESOURCE });
    const [stored] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    list.add(stored!, 'memory');
    const [live] = list.get.remembered.db();
    live!.content.parts.push({
      type: 'data-om-observation-end',
      data: { cycleId: 'c', operationType: 'observation' },
    } as any);

    await memory.deleteMessages([id]);
    await om.persistMessages([live!], threadId, RESOURCE, list.getRememberedAndInputMessageIds());

    const rows = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(rows).toEqual([]);
  });

  it('does not bring back a deleted remembered message that was promoted to the response bucket', async () => {
    const { memory, memoryStore, threadId, om } = await setup('promoted');
    const id = `${threadId}-holder`;
    await memory.saveMessages({
      messages: [
        {
          ...sealedBoundaryHolder(threadId, id, new Date(0)),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Observed words. '.repeat(20) }],
            metadata: { mastra: { sealed: true } },
          },
        },
      ],
    });
    const list = new MessageList({ threadId, resourceId: RESOURCE });
    const [stored] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    list.add(stored!, 'memory');
    const [live] = list.get.remembered.db();
    live!.content.parts.push({
      type: 'data-om-observation-end',
      data: { cycleId: 'c', operationType: 'observation' },
    } as any);
    // Promote the same message to the response bucket, as a step-2 text merge does.
    list.add(live!, 'response');
    expect(list.get.remembered.db().map(m => m.id)).not.toContain(id);

    await memory.deleteMessages([id]);
    await om.persistMessages([live!], threadId, RESOURCE, list.getRememberedAndInputMessageIds());

    expect((await memoryStore.listMessagesById({ messageIds: [id] })).messages).toEqual([]);
    expect(list.getPersisted.remembered.db().map(m => m.id)).toContain(id);
    await om.beginTurn({ threadId, resourceId: RESOURCE, messageList: list }).end();
    expect((await memoryStore.listMessagesById({ messageIds: [id] })).messages).toEqual([]);
  });

  it('still saves the end marker onto a remembered message that is still stored', async () => {
    const { memory, memoryStore, threadId, om } = await setup('stored');
    const id = `${threadId}-holder`;
    await memory.saveMessages({
      messages: [
        {
          ...sealedBoundaryHolder(threadId, id, new Date(0)),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Observed words. '.repeat(20) }],
            metadata: { mastra: { sealed: true } },
          },
        },
      ],
    });
    const holder = sealedBoundaryHolder(threadId, id, new Date(0));
    await om.persistMessages([holder], threadId, RESOURCE, new Set([id]));

    const [saved] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(saved!.content.parts.some(part => part.type === 'data-om-observation-end')).toBe(true);
    const list = new MessageList({ threadId, resourceId: RESOURCE });
    list.add(holder, 'memory');
    list.add(holder, 'response');
    await om.beginTurn({ threadId, resourceId: RESOURCE, messageList: list }).end();
    const rows = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.content.parts.some(part => part.type === 'data-om-observation-end')).toBe(true);
  });

  it.each(['input', 'response'] as const)('saves a new sealed %s boundary holder at turn end', async source => {
    const { memoryStore, threadId, om } = await setup(`new-${source}`);
    const id = `${threadId}-new-holder`;
    const list = new MessageList({ threadId, resourceId: RESOURCE });
    list.add(sealedBoundaryHolder(threadId, id, new Date(0)), source);
    await om.beginTurn({ threadId, resourceId: RESOURCE, messageList: list }).end();
    const [saved] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(saved?.content.parts.some(part => part.type === 'data-om-observation-end')).toBe(true);
  });

  it("still saves this turn's own sealed message that has no stored row yet", async () => {
    const { memoryStore, threadId, om } = await setup('new');
    const id = `${threadId}-new-holder`;
    await om.persistMessages([sealedBoundaryHolder(threadId, id, new Date(0))], threadId, RESOURCE, new Set());

    const [saved] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(saved?.content.parts.some(part => part.type === 'data-om-observation-end')).toBe(true);
  });
});
