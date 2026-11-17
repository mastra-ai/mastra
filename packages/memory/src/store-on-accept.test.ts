/**
 * `storeOnAccept` stores a sent message when `sendMessage` accepts it, without waiting for the run.
 * The memory processors save the same row again later (observational memory per step, message
 * history at turn end). A slow acceptance write must never land after those saves, and it must not
 * embed the message a second time for semantic recall.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from './index';

const resourceId = 'store-on-accept-user';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function vectorStore() {
  const rows = new Map<string, unknown>();
  return {
    rows,
    store: {
      id: 'map-vector',
      async createIndex() {},
      async listIndexes() {
        return ['memory_messages'];
      },
      async describeIndex() {
        return { dimension: 3, metric: 'cosine', count: rows.size };
      },
      async upsert({ ids }: { ids: string[] }) {
        ids.forEach(id => rows.set(id, true));
        return ids;
      },
      async query() {
        return [];
      },
      async deleteVectors() {},
    } as unknown as MastraVector,
  };
}

function countingEmbedder() {
  const inputs: string[] = [];
  return {
    inputs,
    embedder: {
      specificationVersion: 'v1' as const,
      provider: 'test',
      modelId: 'counting-embedder',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }: { values: string[] }) {
        inputs.push(...values);
        return { embeddings: values.map(value => [value.length, 1, 1]), usage: { tokens: values.length } };
      },
    },
  };
}

type SaveCall = { ids: string[]; startedAt: number; endedAt?: number };

/** Records every memory-store write; the first write holding a user signal row is held for `delayMs`. */
async function instrumentSaves(storage: InMemoryStore, delayMs: number) {
  const store = (await storage.getStore('memory'))!;
  const saveMessages = store.saveMessages.bind(store);
  const calls: SaveCall[] = [];
  let delayed = false;
  vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
    const call: SaveCall = { ids: args.messages.map(message => message.id), startedAt: performance.now() };
    calls.push(call);
    if (!delayed && args.messages.some(message => message.role === 'signal')) {
      delayed = true;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    try {
      return await saveMessages(args);
    } finally {
      call.endedAt = performance.now();
    }
  });
  return { calls };
}

async function setup(name: string, memory: Memory, storage: InMemoryStore) {
  const agent = new Agent({ id: name, name, instructions: 'Reply briefly.', model: textModel('final reply'), memory });
  new Mastra({ agents: { [name]: agent }, storage, logger: false });
  const threadId = `${name}-thread`;
  await memory.saveThread({
    thread: { id: threadId, resourceId, title: name, createdAt: new Date(), updatedAt: new Date() },
  });
  return { agent, threadId };
}

async function sendAndFinish(agent: Agent, threadId: string, contents: string) {
  const result = agent.sendMessage(
    { contents },
    {
      resourceId,
      threadId,
      storeOnAccept: true,
      ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
    },
  );
  const accepted = await result.accepted;
  if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
  await accepted.output.consumeStream();
  return result.signal.id;
}

function rowsFor(messages: MastraDBMessage[], id: string) {
  return messages.filter(message => message.id === id);
}

const observationalMemory = {
  enabled: true,
  scope: 'thread' as const,
  observation: {
    model: textModel('<observations></observations>'),
    messageTokens: 500_000,
    bufferTokens: false as const,
  },
  reflection: { observationTokens: 60_000 },
};

describe('storeOnAccept with memory processors', () => {
  for (const variant of ['message history', 'observational memory'] as const) {
    it(`${variant}: a slow acceptance write settles before the run saves the same row`, async () => {
      const storage = new InMemoryStore();
      const memory = new Memory({
        storage,
        options: {
          generateTitle: false,
          ...(variant === 'observational memory' ? { observationalMemory } : {}),
        },
      });
      const { agent, threadId } = await setup(`soa-${variant.replace(' ', '-')}`, memory, storage);
      const saves = await instrumentSaves(storage, 300);

      const id = await sendAndFinish(agent, threadId, 'hello there');

      const withMessage = saves.calls.filter(call => call.ids.includes(id));
      expect(withMessage.length).toBeGreaterThanOrEqual(2);
      const [acceptance, ...later] = withMessage;
      for (const save of later) expect(save.startedAt).toBeGreaterThanOrEqual(acceptance!.endedAt!);

      const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
      const rows = rowsFor(messages, id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.content.parts).toEqual([expect.objectContaining({ type: 'text', text: 'hello there' })]);
      expect(messages.some(message => message.role === 'assistant')).toBe(true);
    });
  }

  it('semantic recall embeds the sent message once', async () => {
    const storage = new InMemoryStore();
    const vector = vectorStore();
    const embedder = countingEmbedder();
    const memory = new Memory({
      storage,
      vector: vector.store,
      embedder: embedder.embedder as any,
      options: { generateTitle: false, semanticRecall: true },
    });
    const { agent, threadId } = await setup('soa-semantic-recall', memory, storage);

    await sendAndFinish(agent, threadId, 'a sentence worth recalling');

    expect(embedder.inputs.filter(input => input.includes('a sentence worth recalling'))).toHaveLength(1);
  });
});
