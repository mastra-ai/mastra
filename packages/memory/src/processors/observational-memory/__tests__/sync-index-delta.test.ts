import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore, InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type { UpsertVectorParams, QueryVectorParams } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { parseObservationGroups } from '../observation-groups';

class CountingVector extends MastraVector {
  writes: NonNullable<UpsertVectorParams['metadata']> = [];
  fail = false;
  rows = new Map<string, NonNullable<UpsertVectorParams['metadata']>[number]>();
  constructor() {
    super({ id: 'sync-delta-vector' });
  }
  async createIndex() {}
  async upsert({ ids = [], metadata = [] }: UpsertVectorParams) {
    if (this.fail) throw new Error('vector write rejected');
    this.writes.push(...metadata);
    ids.forEach((id, i) => {
      const row = metadata[i];
      if (row) this.rows.set(id, row);
    });
    return ids;
  }
  async query({ filter, topK = 10 }: QueryVectorParams) {
    return [...this.rows.entries()]
      .filter(([, row]) => Object.entries(filter ?? {}).every(([key, value]) => row[key] === value))
      .slice(0, topK)
      .map(([id, metadata]) => ({ id, metadata, score: 1 }));
  }
  async listIndexes() {
    return [];
  }
  async describeIndex() {
    return { dimension: 3, count: 0, metric: 'cosine' as const };
  }
  async deleteIndex() {}
  async updateVector() {}
  async deleteVector() {}
  async deleteVectors() {}
}

class ReceiptFailureMemory extends InMemoryMemory {
  failReceipt = false;
  override async patchThread(input: Parameters<InMemoryMemory['patchThread']>[0]) {
    if (this.failReceipt && input.metadata?.mastra_om_observation_index) {
      throw new Error('receipt write rejected');
    }
    return super.patchThread(input);
  }
}

async function setup() {
  const storage = new InMemoryStore();
  const memoryStore = new ReceiptFailureMemory({ db: new InMemoryDB() });
  storage.stores.memory = memoryStore;
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
  const open = ({ destination = vector, modelId = 'synthetic-embedding' } = {}) =>
    new Memory({
      storage,
      vector: destination,
      embedder: {
        specificationVersion: 'v2',
        provider: 'synthetic',
        modelId,
        maxEmbeddingsPerCall: 100,
        supportsParallelCalls: false,
        doEmbed: async ({ values }) => {
          embedded.push(...values);
          return { embeddings: values.map(() => [1, 0, 0]), warnings: [] };
        },
      },
      options: {
        semanticRecall: false,
        generateTitle: false,
        workingMemory: { enabled: false },
        observationalMemory: {
          scope: 'thread',
          retrieval: { vector: true },
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
      id: `${threadId}-${cycle}`,
      threadId,
      resourceId,
      role: 'user',
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
  return { memory, open, storage, memoryStore, vector, embedded, observe, threadId, resourceId };
}

describe('synchronous observation indexing delta (#27930)', () => {
  it('writes and embeds only the new group in each cycle, including after recreating Memory', async () => {
    const { memory, open, observe, vector, embedded } = await setup();
    for (const cycle of [1, 2, 3, 4]) {
      expect((await observe(cycle === 4 ? open() : memory, cycle)).observed).toBe(true);
      expect(vector.writes).toHaveLength(cycle);
      expect(embedded).toHaveLength(cycle);
      expect(vector.writes[0]?.observed_at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 0, 1)).toISOString());
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
    const changed = record.activeObservations
      .replace(group.content, '- Updated fact.')
      .replace(group.range, 'updated-start:updated-end');
    await store.updateActiveObservations({ id: record.id, observations: changed, tokenCount: 10 });
    await observe(open(), 2);
    expect(vector.writes.filter(row => row.group_id === group.id)).toHaveLength(2);
    expect(vector.writes.findLast(row => row.group_id === group.id)?.text).toContain('Updated fact');
    expect(vector.writes.findLast(row => row.group_id === group.id)?.range).toBe('updated-start:updated-end');
    const head = await store.getObservationalMemory(threadId, resourceId);
    if (!head) throw new Error('OM head unavailable');
    const next = await store.createReflectionGeneration({
      currentRecord: head,
      reflection: head.activeObservations,
      tokenCount: 10,
    });
    await observe(open(), 3);
    expect(vector.writes.findLast(row => row.group_id === group.id)?.record_id).toBe(next.id);
    expect(vector.writes.filter(row => row.group_id === group.id)).toHaveLength(3);
  });

  it('repairs a failed first upsert on the next cycle after recreating Memory', async () => {
    const { memory, open, observe, vector, storage, threadId, resourceId } = await setup();
    vector.fail = true;
    await expect(observe(memory, 1)).rejects.toThrow('vector write rejected');
    const store = await storage.getStore('memory');
    expect((await store?.getObservationalMemory(threadId, resourceId))?.activeObservations).toContain(
      'Observed fact 1',
    );
    expect(vector.writes).toHaveLength(0);
    vector.fail = false;
    await observe(open(), 2);
    expect(vector.writes).toHaveLength(2);
    await observe(open(), 3);
    expect(vector.writes).toHaveLength(3);
  });

  it('rebuilds receipts when the vector destination or embedding model changes', async () => {
    const { memory, open, observe, vector, embedded } = await setup();
    await observe(memory, 1);
    const destination = new CountingVector();
    destination.id = 'replacement-vector';
    await observe(open({ destination }), 2);
    expect(vector.writes).toHaveLength(1);
    expect(destination.writes).toHaveLength(2);
    await observe(open({ destination, modelId: 'replacement-embedder' }), 3);
    expect(destination.writes).toHaveLength(5);
    expect(embedded).toHaveLength(6);
  });

  it('repairs a successful upsert whose acknowledgement could not be saved', async () => {
    const { memory, open, observe, vector, memoryStore } = await setup();
    memoryStore.failReceipt = true;
    await expect(observe(memory, 1)).rejects.toThrow('receipt write rejected');
    expect(vector.writes).toHaveLength(1);
    memoryStore.failReceipt = false;
    await observe(open(), 2);
    expect(vector.writes).toHaveLength(3);
    await observe(open(), 3);
    expect(vector.writes).toHaveLength(4);
  });

  it('repairs a conflicting vector write even when the newer receipt was saved last', async () => {
    const { memory, open, observe, vector } = await setup();
    await observe(memory, 1);
    const original = vector.writes[0];
    if (!original) throw new Error('Missing original vector');
    await observe(open(), 2);
    // The conflicting writer finishes its upsert before the current writer finishes its
    // receipt: durable metadata still acknowledges current, but the vector is retired.
    for (const [id, row] of vector.rows) {
      if (row.group_id === original.group_id) {
        vector.rows.set(id, { ...row, record_id: 'retired', index_revision: 'retired-revision' });
      }
    }
    await observe(open(), 3);
    const repaired = [...vector.rows.values()].find(row => row.group_id === original.group_id);
    expect(repaired?.record_id).toBe(original.record_id);
    expect(vector.writes.filter(row => row.group_id === original.group_id)).toHaveLength(2);
    await observe(open(), 4);
    expect(vector.writes.filter(row => row.group_id === original.group_id)).toHaveLength(2);
  });

  it('repairs vectors removed externally despite a durable receipt', async () => {
    const { memory, open, observe, vector } = await setup();
    await observe(memory, 1);
    vector.rows.clear();
    await observe(open(), 2);
    expect(vector.rows.size).toBe(2);
    expect(vector.writes).toHaveLength(3);
    await observe(open(), 3);
    expect(vector.writes).toHaveLength(4);
  });
});
