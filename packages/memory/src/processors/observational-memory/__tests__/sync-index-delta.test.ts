import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type { UpsertVectorParams } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { parseObservationGroups } from '../observation-groups';

class CountingVector extends MastraVector {
  writes: NonNullable<UpsertVectorParams['metadata']> = [];
  fail = false;
  constructor() { super({ id: 'sync-delta-vector' }); }
  async createIndex() {}
  async upsert({ ids = [], metadata = [] }: UpsertVectorParams) {
    if (this.fail) throw new Error('vector write rejected');
    this.writes.push(...metadata);
    return ids;
  }
  async query() { return []; }
  async listIndexes() { return []; }
  async describeIndex() { return { dimension: 3, count: 0, metric: 'cosine' as const }; }
  async deleteIndex() {}
  async updateVector() {}
  async deleteVector() {}
  async deleteVectors() {}
}

async function setup() {
  const storage = new InMemoryStore();
  const vector = new CountingVector();
  const embedded: string[] = [];
  let fact = 0;
  const observer = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'observation' },
        { type: 'text-delta', id: 'observation', delta: `<observations>\n- Observed fact ${++fact}.\n</observations>` },
        { type: 'text-end', id: 'observation' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
  const open = () => new Memory({
    storage, vector,
    embedder: {
      specificationVersion: 'v2', provider: 'synthetic', modelId: 'synthetic-embedding',
      maxEmbeddingsPerCall: 100, supportsParallelCalls: false,
      doEmbed: async ({ values }) => {
        embedded.push(...values);
        return { embeddings: values.map(() => [1, 0, 0]), warnings: [] };
      },
    },
    options: {
      semanticRecall: false, generateTitle: false, workingMemory: { enabled: false },
      observationalMemory: {
        scope: 'thread', retrieval: { vector: true },
        observation: { model: observer, bufferTokens: false, messageTokens: 1 },
        reflection: { model: observer, observationTokens: 1_000_000 },
      },
    },
  });
  const threadId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  const memory = open();
  await memory.createThread({ threadId, resourceId, title: 'Index delta' });
  const observe = async (instance: Memory, cycle: number) => {
    const message: MastraDBMessage = {
      id: `${threadId}-${cycle}`, threadId, resourceId, role: 'user',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, cycle)),
      content: { format: 2, parts: [{ type: 'text', text: `Remember fact ${cycle}.` }] },
    };
    await instance.persistMessages([message]);
    const engine = await instance.omEngine;
    if (!engine) throw new Error('OM engine unavailable');
    const result = await engine.observe({ force: true, threadId, resourceId, messages: [message] });
    await instance.settled();
    return result;
  };
  return { memory, open, storage, vector, embedded, observe, threadId, resourceId };
}

describe('synchronous observation indexing delta (#27930)', () => {
  it('writes and embeds only the new group in each cycle, including after recreating Memory', async () => {
    const { memory, open, observe, vector, embedded } = await setup();
    for (const cycle of [1, 2, 3, 4]) {
      expect((await observe(cycle === 4 ? open() : memory, cycle)).observed).toBe(true);
      expect(vector.writes).toHaveLength(cycle);
      expect(embedded).toHaveLength(cycle);
    }
    expect(new Set(vector.writes.map(row => row.group_id)).size).toBe(4);
  });

  it('reindexes a changed retained group and rewrites record_id after generation rollover', async () => {
    const { memory, open, observe, vector, storage, threadId, resourceId } = await setup();
    await observe(memory, 1);
    const store = await storage.getStore('memory');
    if (!store) throw new Error('Memory store unavailable');
    const record = await store.getObservationalMemory(threadId, resourceId);
    if (!record) throw new Error('OM record unavailable');
    const group = parseObservationGroups(record.activeObservations)[0];
    if (!group) throw new Error('Observation group unavailable');
    const changed = record.activeObservations.replace(group.content, '- Updated fact.');
    await store.updateActiveObservations({ id: record.id, observations: changed, tokenCount: 10 });
    await observe(open(), 2);
    expect(vector.writes.filter(row => row.group_id === group.id)).toHaveLength(2);
    expect(vector.writes.findLast(row => row.group_id === group.id)?.text).toContain('Updated fact');
    const head = await store.getObservationalMemory(threadId, resourceId);
    if (!head) throw new Error('OM head unavailable');
    const next = await store.createReflectionGeneration({
      currentRecord: head, reflection: head.activeObservations, tokenCount: 10,
    });
    await observe(open(), 3);
    expect(vector.writes.findLast(row => row.group_id === group.id)?.record_id).toBe(next.id);
    expect(vector.writes.filter(row => row.group_id === group.id)).toHaveLength(3);
  });

  it('repairs a failed first upsert on the next cycle after recreating Memory', async () => {
    const { memory, open, observe, vector } = await setup();
    vector.fail = true;
    await observe(memory, 1).catch(() => undefined);
    expect(vector.writes).toHaveLength(0);
    vector.fail = false;
    await observe(open(), 2);
    expect(vector.writes).toHaveLength(2);
    await observe(open(), 3);
    expect(vector.writes).toHaveLength(3);
  });
});
