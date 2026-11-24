import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RESOURCE = 'om-marker-dedupe-resource';

function stubModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('not used');
    },
    doStream: async () => {
      throw new Error('not used');
    },
  });
}

function open(dbPath: string) {
  const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: false,
      observationalMemory: {
        scope: 'thread',
        observation: { model: stubModel(), messageTokens: 5_000_000, bufferTokens: false },
        reflection: { model: stubModel(), observationTokens: 5_000_000 },
      },
    },
  });
  return { storage, memory };
}

function sealedAssistant(threadId: string): MastraDBMessage {
  return {
    id: `${threadId}-assistant`,
    role: 'assistant',
    threadId,
    resourceId: RESOURCE,
    createdAt: new Date(Date.UTC(2026, 10, 1)),
    content: {
      format: 2,
      metadata: { mastra: { sealed: true } },
      parts: [
        {
          type: 'reasoning',
          reasoning: '',
          details: [{ type: 'text', text: '' }],
          providerMetadata: { openai: { itemId: 'rs_marker' } },
        },
        { type: 'text', text: 'Here is the plan.' },
      ],
    },
  };
}

const marker = (cycleId: string) => ({
  type: 'data-om-observation-end',
  data: { cycleId, operationType: 'observation', observedAt: '2026-11-01T00:00:00.000Z' },
});

const markerParts = (message: MastraDBMessage) =>
  message.content.parts.filter(part => part.type.startsWith('data-om-'));
const reasoningItemIds = (list: MessageList) =>
  list.get.all
    .db()
    .flatMap(message =>
      message.content.parts.flatMap(part => (part.type === 'reasoning' ? [part.providerMetadata?.openai?.itemId] : [])),
    );

describe('a stored message that gained an OM marker after it was saved', () => {
  let dbDir: string;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-marker-dedupe-'));
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  async function saveThenMark() {
    const { memory } = open(join(dbDir, 'test.db'));
    const threadId = randomUUID();
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const live = sealedAssistant(threadId);
    // The agent keeps its own copy of the message while OM works on the stored one.
    const list = new MessageList({ threadId, resourceId: RESOURCE }).add(structuredClone(live), 'response');
    await memory.saveMessages({ messages: [live] });
    // The fallback that has no MessageList: OM writes the marker onto the stored copy only.
    const engine = (await memory.omEngine)!;
    await engine.persistMarkerToStorage(marker('cycle-1'), threadId, RESOURCE);
    return { memory, threadId, list };
  }

  // Control: without it, a change that stops writing markers would make the next test pass for the wrong reason.
  it('reaches storage, so a reload sees it', async () => {
    const { memory, threadId } = await saveThenMark();
    const { messages } = await memory.recall({ threadId, resourceId: RESOURCE, perPage: false });
    expect(messages).toHaveLength(1);
    expect(markerParts(messages[0]!)).toHaveLength(1);
  });

  it('is still the same message when it is recalled into the live list on the next turn', async () => {
    const { memory, threadId, list } = await saveThenMark();
    const { messages: recalled } = await memory.recall({ threadId, resourceId: RESOURCE, perPage: false });
    list.add(recalled, 'memory');

    expect(list.get.all.db().map(message => message.id)).toEqual([`${threadId}-assistant`]);
    expect(reasoningItemIds(list)).toEqual(['rs_marker']);
    const prompt = JSON.stringify(await list.get.all.aiV5.llmPrompt());
    expect(prompt.match(/rs_marker/g)).toHaveLength(1);
  });

  it('stays deduplicated across repeated reloads', async () => {
    const { memory, threadId, list } = await saveThenMark();
    for (let reload = 0; reload < 2; reload++) {
      const { messages: recalled } = await memory.recall({ threadId, resourceId: RESOURCE, perPage: false });
      list.add(recalled, 'memory');
    }
    expect(list.get.all.db()).toHaveLength(1);
    expect(reasoningItemIds(list)).toEqual(['rs_marker']);
  });
});
