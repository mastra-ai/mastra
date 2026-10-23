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
  failNextUpsert = false;
  constructor() {
    super({ id: 'sync-delta-vector' });
  }
  async createIndex() {}
  async upsert({ ids = [], metadata = [] }: UpsertVectorParams) {
    if (this.failNextUpsert) {
      this.failNextUpsert = false;
      throw new Error('vector store unavailable');
    }
    this.writes.push(...metadata);
    return ids;
  }
  async query() {
    return [];
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

async function setup({ scope = 'thread' }: { scope?: 'thread' | 'resource' } = {}) {
  const threadId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  const storage = new InMemoryStore();
  const vector = new CountingVector();
  const embedded: string[] = [];
  let fact = 0;
  // When set, the next Observer call waits here, so another instance can commit meanwhile.
  let hold: { reached: () => void; release: Promise<void> } | undefined;
  const observer = new MockLanguageModelV2({
    doStream: async () => {
      const facts = `Date: Jan 1, 2026\n- Observed fact ${++fact}.`;
      // The resource-scope Observer answers per thread.
      const text = `<observations>\n${scope === 'resource' ? `<thread id="${threadId}">\n${facts}\n</thread>` : facts}\n</observations>`;
      const held = hold;
      hold = undefined;
      if (held) {
        held.reached();
        await held.release;
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'observation' },
          { type: 'text-delta', id: 'observation', delta: text },
          { type: 'text-end', id: 'observation' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  const open = () =>
    new Memory({
      storage,
      vector,
      embedder: {
        specificationVersion: 'v2',
        provider: 'synthetic',
        modelId: 'synthetic-embedding',
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
          scope,
          retrieval: { vector: true },
          observation: { model: observer, bufferTokens: false, messageTokens: 1 },
          reflection: { model: observer, observationTokens: 1_000_000 },
        },
      },
    });
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
  const holdNextObserverCall = () => {
    let reached!: () => void;
    let release!: () => void;
    const reachedPromise = new Promise<void>(resolve => (reached = resolve));
    hold = { reached, release: new Promise<void>(resolve => (release = resolve)) };
    return { reached: reachedPromise, release };
  };
  const headGroups = async () => {
    const store = await storage.getStore('memory');
    const head = await store?.getObservationalMemory(scope === 'resource' ? null : threadId, resourceId);
    if (!head) throw new Error('OM head unavailable');
    return { head, store: store!, groups: parseObservationGroups(head.activeObservations) };
  };
  return { memory, open, vector, embedded, observe, holdNextObserverCall, headGroups };
}

describe('synchronous observation indexing delta (#27930)', () => {
  it('writes and embeds only the new group in each cycle, including after recreating Memory', async () => {
    const { memory, open, observe, vector, embedded, headGroups } = await setup();
    for (const cycle of [1, 2, 3, 4]) {
      expect((await observe(cycle === 4 ? open() : memory, cycle)).observed).toBe(true);
      expect(vector.writes).toHaveLength(cycle);
      expect(embedded).toHaveLength(cycle);
      expect(embedded[cycle - 1]).toContain(`Observed fact ${cycle}.`);
    }
    expect(vector.writes[0]?.observed_at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 0, 1)).toISOString());
    const { groups } = await headGroups();
    expect(vector.writes.map(row => row.group_id)).toEqual(groups.map(group => group.id));
  });

  it('does not index retained groups after a reflection rolls the generation over', async () => {
    const { memory, observe, vector, headGroups } = await setup();
    await observe(memory, 1);
    const { head, store } = await headGroups();
    const next = await store.createReflectionGeneration({
      currentRecord: head,
      reflection: head.activeObservations,
      tokenCount: 10,
    });
    await observe(memory, 2);
    expect(vector.writes).toHaveLength(2);
    expect(vector.writes[1]?.record_id).toBe(next.id);
    expect(vector.writes[1]?.text).toContain('Observed fact 2.');
  });

  it('indexes nothing when another instance already committed the same messages', async () => {
    const { memory, open, observe, vector, holdNextObserverCall, headGroups } = await setup();
    const held = holdNextObserverCall();
    const losing = observe(open(), 1);
    await held.reached;
    await observe(memory, 1);
    held.release();
    expect((await losing).observed).toBe(true);
    const { groups } = await headGroups();
    expect(groups).toHaveLength(1);
    expect(vector.writes.map(row => row.group_id)).toEqual([groups[0]?.id]);
  });

  it('indexes the recomposed group that committed when another instance moved the head', async () => {
    const { memory, open, observe, vector, holdNextObserverCall, headGroups } = await setup();
    await observe(memory, 1);
    const held = holdNextObserverCall();
    const recomposed = observe(open(), 3);
    await held.reached;
    await observe(memory, 2);
    held.release();
    expect((await recomposed).observed).toBe(true);
    const { groups } = await headGroups();
    expect(groups).toHaveLength(3);
    expect(vector.writes).toHaveLength(3);
    expect(new Set(vector.writes.map(row => row.group_id))).toEqual(new Set(groups.map(group => group.id)));
  });

  it('writes and embeds only the new group when resource scope merges a same-date thread section', async () => {
    const { memory, observe, vector, embedded, headGroups } = await setup({ scope: 'resource' });
    await observe(memory, 1);
    await observe(memory, 2);
    // The second cycle merges into the first cycle's same-date thread section, so its group must
    // keep its opening tag there for the vector's group ID to resolve when paging.
    const { groups } = await headGroups();
    expect(groups.map(group => group.content)).toEqual([
      'Date: Jan 1, 2026\n- Observed fact 1.',
      'Date: Jan 1, 2026\n- Observed fact 2.',
    ]);
    expect(vector.writes.map(row => row.group_id)).toEqual(groups.map(group => group.id));
    expect(embedded).toHaveLength(2);
    expect(embedded[1]).toContain('Observed fact 2.');
    expect(embedded[1]).not.toContain('Observed fact 1.');
  });

  it('retries a committed group whose vector write failed on the next cycle', async () => {
    const { memory, observe, vector, headGroups } = await setup();
    vector.failNextUpsert = true;
    // The observations committed, so the failed write does not fail the cycle.
    expect((await observe(memory, 1)).observed).toBe(true);
    expect((await headGroups()).groups).toHaveLength(1);
    expect(vector.writes).toHaveLength(0);
    await observe(memory, 2);
    const { groups } = await headGroups();
    expect(groups).toHaveLength(2);
    expect(vector.writes.map(row => row.group_id).sort()).toEqual(groups.map(group => group.id).sort());
    await observe(memory, 3);
    expect(vector.writes).toHaveLength(3);
  });

  it('retries a failed group write after a reflection rolls the generation over', async () => {
    const { memory, observe, vector, headGroups } = await setup();
    vector.failNextUpsert = true;
    expect((await observe(memory, 1)).observed).toBe(true);
    const { head, store, groups } = await headGroups();
    await store.createReflectionGeneration({
      currentRecord: head,
      reflection: head.activeObservations,
      tokenCount: 10,
    });
    await observe(memory, 2);
    // The retried write keeps naming the generation its group was committed to.
    expect(vector.writes.find(row => row.group_id === groups[0]?.id)?.record_id).toBe(head.id);
    expect(vector.writes).toHaveLength(2);
  });

  it('does not retry a failed group write after its observational memory was cleared', async () => {
    const { memory, observe, vector, headGroups } = await setup();
    vector.failNextUpsert = true;
    expect((await observe(memory, 1)).observed).toBe(true);
    const { head, groups } = await headGroups();
    const engine = await memory.omEngine;
    await engine!.clear(head.threadId!, head.resourceId);
    await observe(memory, 2);
    expect(vector.writes.map(row => row.group_id)).not.toContain(groups[0]?.id);
    expect(vector.writes).toHaveLength(1);
    expect(engine!.unindexedObservations.size).toBe(0);
  });

  it('keeps both groups indexable when the lineage check for a retried group fails once', async () => {
    const { memory, observe, vector, headGroups } = await setup();
    vector.failNextUpsert = true;
    expect((await observe(memory, 1)).observed).toBe(true);
    const { head, store, groups } = await headGroups();
    await store.createReflectionGeneration({
      currentRecord: head,
      reflection: head.activeObservations,
      tokenCount: 10,
    });
    const readHistory = store.getObservationalMemoryHistory.bind(store);
    let failHistoryRead = true;
    store.getObservationalMemoryHistory = async (...args) => {
      if (failHistoryRead) {
        failHistoryRead = false;
        throw new Error('storage unavailable');
      }
      return readHistory(...args);
    };
    await observe(memory, 2);
    expect(vector.writes.map(row => row.text)).toEqual([expect.stringContaining('Observed fact 2.')]);
    await observe(memory, 3);
    expect(vector.writes.map(row => row.group_id)).toContain(groups[0]?.id);
    expect(vector.writes).toHaveLength(3);
  });
});
