import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory } from './index';

/**
 * Saving messages embeds their text for semantic recall. The same text (a repeated reply, a
 * re-saved message, a cloned thread) is embedded once per Memory instance and reused, while every
 * message still gets its own vector row under its own id.
 */

type StoredRow = { id: string; vector: number[]; metadata: Record<string, any> };

function makeVectorStore() {
  const indexes = new Map<string, Map<string, StoredRow>>();
  const store = {
    id: 'map-vector',
    async createIndex({ indexName }: { indexName: string }) {
      if (!indexes.has(indexName)) indexes.set(indexName, new Map());
    },
    async listIndexes() {
      return [...indexes.keys()];
    },
    async describeIndex({ indexName }: { indexName: string }) {
      return { dimension: 3, metric: 'cosine', count: indexes.get(indexName)?.size ?? 0 };
    },
    async upsert({
      indexName,
      ids,
      vectors,
      metadata,
    }: {
      indexName: string;
      ids: string[];
      vectors: number[][];
      metadata: Record<string, any>[];
    }) {
      const rows = indexes.get(indexName)!;
      ids.forEach((id, i) => rows.set(id, { id, vector: vectors[i]!, metadata: metadata[i]! }));
      return ids;
    },
    async query() {
      return [];
    },
    async deleteVectors() {},
  };
  const rows = () => [...indexes.values()].flatMap(index => [...index.values()]);
  return { store: store as unknown as MastraVector, rows };
}

function makeEmbedder({
  modelId = 'counting-embedder',
  maxInputTokens,
}: { modelId?: string; maxInputTokens?: number } = {}) {
  const stats = { calls: 0, inputs: [] as string[], failing: false };
  const embedder = {
    specificationVersion: 'v1' as const,
    provider: 'test',
    modelId,
    maxEmbeddingsPerCall: 256,
    supportsParallelCalls: true,
    ...(maxInputTokens ? { maxInputTokens } : {}),
    async doEmbed({ values }: { values: string[] }) {
      stats.calls++;
      if (stats.failing) {
        throw new Error('embedder unavailable');
      }
      stats.inputs.push(...values);
      return {
        embeddings: values.map(value => [value.length, modelId.length, 1]),
        usage: { tokens: values.length },
      };
    },
  };
  return { embedder, stats };
}

async function setup(embedderOptions?: Parameters<typeof makeEmbedder>[0]) {
  const vector = makeVectorStore();
  const { embedder, stats } = makeEmbedder(embedderOptions);
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector: vector.store,
    embedder: embedder as any,
    options: { semanticRecall: true },
  });
  const threadId = randomUUID();
  const resourceId = 'resource-1';
  await memory.saveThread({
    thread: { id: threadId, resourceId, title: 'reuse', createdAt: new Date(), updatedAt: new Date() },
  });
  const make = (id: string, text: string): MastraDBMessage => ({
    id,
    threadId,
    resourceId,
    role: 'user',
    type: 'text',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  });
  return { memory, stats, embedder, rows: vector.rows, make, threadId };
}

const texts = Array.from({ length: 50 }, (_, i) => `repeat ${i} short text`);

describe('semantic recall embedding reuse across saves', () => {
  it('embeds repeated texts once while writing a row for every new message', async () => {
    const { memory, stats, rows, make } = await setup();

    for (let save = 0; save < 3; save++) {
      await memory.saveMessages({ messages: texts.map(text => make(randomUUID(), text)) });
    }

    expect(stats.inputs).toHaveLength(50);
    expect(new Set(stats.inputs)).toEqual(new Set(texts));
    expect(rows()).toHaveLength(150);
    expect(new Set(rows().map(row => row.metadata.message_id)).size).toBe(150);
  });

  it('keeps one row per message when the same messages are saved again', async () => {
    const { memory, stats, rows, make } = await setup();
    const ids = texts.map(() => randomUUID());

    for (let save = 0; save < 3; save++) {
      await memory.saveMessages({ messages: ids.map((id, i) => make(id, texts[i]!)) });
    }

    expect(stats.inputs).toHaveLength(50);
    expect(rows()).toHaveLength(50);
    expect(new Set(rows().map(row => row.metadata.message_id))).toEqual(new Set(ids));
  });

  it('embeds distinct and edited texts', async () => {
    const { memory, stats, rows, make } = await setup();
    const id = randomUUID();

    await memory.saveMessages({ messages: [make(id, 'first wording')] });
    await memory.saveMessages({ messages: [make(id, 'second wording')] });
    await memory.saveMessages({ messages: [make(randomUUID(), 'a different message')] });

    expect(stats.inputs).toEqual(['first wording', 'second wording', 'a different message']);
    const edited = rows().find(row => row.metadata.message_id === id)!;
    expect(edited.vector).toEqual(['second wording'.length, 'counting-embedder'.length, 1]);
  });

  it('reports embedding usage only for texts it actually embedded', async () => {
    const { memory, make } = await setup();

    const first = await memory.saveMessages({ messages: texts.map(text => make(randomUUID(), text)) });
    const second = await memory.saveMessages({ messages: texts.map(text => make(randomUUID(), text)) });

    expect(first.usage?.tokens).toBe(50);
    expect(second.usage?.tokens ?? 0).toBe(0);
  });

  it('does not reuse a failed embedding', async () => {
    const { memory, stats, rows, make } = await setup();
    stats.failing = true;
    await expect(memory.saveMessages({ messages: [make(randomUUID(), 'retry me')] })).rejects.toThrow();
    stats.failing = false;
    await memory.saveMessages({ messages: [make(randomUUID(), 'retry me')] });

    expect(stats.inputs).toEqual(['retry me']);
    expect(rows()).toHaveLength(1);
  });

  it('embeds again after the embedder changes', async () => {
    const { memory, stats, rows, make } = await setup();
    await memory.saveMessages({ messages: [make(randomUUID(), 'same text')] });

    const replacement = makeEmbedder({ modelId: 'other-embedder' });
    memory.setEmbedder(replacement.embedder as any);
    await memory.saveMessages({ messages: [make(randomUUID(), 'same text')] });

    expect(stats.inputs).toEqual(['same text']);
    expect(replacement.stats.inputs).toEqual(['same text']);
    expect(rows().map(row => row.vector[1])).toContain('other-embedder'.length);
  });

  it('keeps indexing raw-string content', async () => {
    const { memory, stats, rows, make } = await setup();
    const messages = texts.map(text => ({ ...make(randomUUID(), text), content: text }));

    await memory.saveMessages({ messages: messages as any });

    expect(stats.inputs).toHaveLength(50);
    expect(rows()).toHaveLength(50);
  });

  it('keeps chunks within the embedder input limit when reusing long texts', async () => {
    const { memory, stats, rows, make } = await setup({ maxInputTokens: 512 });
    const long = 'long text '.repeat(450);

    await memory.saveMessages({ messages: [make(randomUUID(), long)] });
    await memory.saveMessages({ messages: [make(randomUUID(), long)] });

    expect(stats.inputs.length).toBeGreaterThan(1);
    expect(stats.inputs.every(chunk => chunk.length <= 1536)).toBe(true);
    expect(rows()).toHaveLength(stats.inputs.length * 2);
  });
});
