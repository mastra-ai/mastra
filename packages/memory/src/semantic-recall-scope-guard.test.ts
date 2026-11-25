import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { beforeEach, describe, expect, it } from 'vitest';

import { Memory } from './index';

/**
 * Semantic recall scopes its vector query with a `thread_id` or `resource_id` filter. A vector
 * store that returns hits outside that filter, or returns hits whose metadata misstates where
 * the message lives, must not put other threads' or other resources' messages into recall.
 * Storage is real; the vector store is a stand-in that applies the filter, ignores it, or ignores
 * it and labels every hit with the caller's own scope.
 */

type Mode = 'applies-filter' | 'ignores-filter' | 'misstates-metadata';
type Row = { id: string; score: number; metadata: Record<string, any> };

function matches(metadata: Record<string, any>, filter: any): boolean {
  if (!filter) return true;
  if (filter.$and) return filter.$and.every((part: any) => matches(metadata, part));
  return Object.entries(filter).every(([key, value]) => metadata[key] === value);
}

/** The scope part of a filter: the `resource_id`/`thread_id` equality Memory adds. */
function scopeOf(filter: any): Record<string, any> {
  const parts = filter?.$and ?? [filter ?? {}];
  return Object.assign({}, ...parts.map((part: any) => ({ ...part })));
}

function scopeTestVector(mode: Mode, rows: () => Row[]) {
  const store = {
    id: `scope-test-${mode}`,
    async createIndex() {},
    async listIndexes() {
      return ['memory_messages_3', 'memory_observations_3'];
    },
    async describeIndex() {
      return { dimension: 3, metric: 'cosine', count: rows().length };
    },
    async upsert({ ids }: { ids: string[] }) {
      return ids;
    },
    async query({ filter }: { filter?: any }) {
      if (mode === 'applies-filter') return rows().filter(row => matches(row.metadata, filter));
      if (mode === 'ignores-filter') return rows();
      return rows().map(row => ({ ...row, metadata: { ...row.metadata, ...scopeOf(filter) } }));
    },
    async deleteVectors() {},
  };
  return store as unknown as MastraVector;
}

const embedder = {
  specificationVersion: 'v1' as const,
  provider: 'test',
  modelId: 'scope-test',
  maxEmbeddingsPerCall: 256,
  supportsParallelCalls: true,
  async doEmbed({ values }: { values: string[] }) {
    return { embeddings: values.map(() => [1, 0, 0]) };
  },
};

const MODES: Mode[] = ['applies-filter', 'ignores-filter', 'misstates-metadata'];

describe('semantic recall stays inside the requested scope whatever the vector store returns', () => {
  let storage: InMemoryStore;
  let rows: Row[];

  beforeEach(async () => {
    storage = new InMemoryStore();
    const db = (await storage.getStore('memory'))!;
    for (const [id, resourceId] of [
      ['alice-thread', 'alice'],
      ['alice-other', 'alice'],
      ['bob-thread', 'bob'],
    ] as const) {
      await db.saveThread({ thread: { id, resourceId, title: 'scope', createdAt: new Date(), updatedAt: new Date() } });
    }
    const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
    const message = (id: string, threadId: string, resourceId: string, text: string, seconds: number) => ({
      id,
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: at(seconds),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    });
    await db.saveMessages({
      messages: [
        message('alice-msg', 'alice-thread', 'alice', 'ALICE_SAME_THREAD', 1),
        message('alice-other-msg', 'alice-other', 'alice', 'ALICE_OTHER_THREAD', 2),
        message('bob-before', 'bob-thread', 'bob', 'BOB_NEIGHBOUR', 3),
        message('bob-msg', 'bob-thread', 'bob', 'BOB_PRIVATE', 4),
      ],
    });
    rows = [
      {
        id: 'v-alice',
        score: 1,
        metadata: { message_id: 'alice-msg', thread_id: 'alice-thread', resource_id: 'alice' },
      },
      {
        id: 'v-alice-other',
        score: 1,
        metadata: { message_id: 'alice-other-msg', thread_id: 'alice-other', resource_id: 'alice' },
      },
      { id: 'v-bob', score: 1, metadata: { message_id: 'bob-msg', thread_id: 'bob-thread', resource_id: 'bob' } },
      // A hit with no scope metadata at all.
      { id: 'v-bare', score: 1, metadata: { message_id: 'bob-before' } },
    ];
  });

  async function recalledIds(
    mode: Mode,
    scope: 'thread' | 'resource',
    resourceId: string | undefined,
    extra: { filter?: Record<string, any>; messageRange?: number } = {},
  ) {
    const memory = new Memory({
      storage,
      vector: scopeTestVector(mode, () => rows),
      embedder: embedder as any,
      options: {
        lastMessages: 0,
        semanticRecall: { scope, topK: 10, messageRange: extra.messageRange ?? 0, filter: extra.filter },
      },
    });
    const result = await memory.recall({ threadId: 'alice-thread', resourceId, vectorSearchString: 'secret' });
    return result.messages.map(message => message.id).sort();
  }

  describe.each(MODES)('when the vector store %s', mode => {
    it('thread scope without a resourceId returns only the thread’s own messages', async () => {
      expect(await recalledIds(mode, 'thread', undefined)).toEqual(['alice-msg']);
    });

    it('thread scope with a resourceId leaves out the same resource’s other threads', async () => {
      expect(await recalledIds(mode, 'thread', 'alice')).toEqual(['alice-msg']);
    });

    it('resource scope returns the resource’s other threads and leaves out other resources', async () => {
      expect(await recalledIds(mode, 'resource', 'alice')).toEqual(['alice-msg', 'alice-other-msg']);
    });

    it('context around a hit never comes from another thread or resource', async () => {
      expect(await recalledIds(mode, 'thread', undefined, { messageRange: 1 })).toEqual(['alice-msg']);
      expect(await recalledIds(mode, 'resource', 'alice', { messageRange: 1 })).toEqual([
        'alice-msg',
        'alice-other-msg',
      ]);
    });

    it('a user filter combined with the scope does not widen it', async () => {
      rows.forEach(row => (row.metadata.topic = 'notes'));
      expect(await recalledIds(mode, 'thread', undefined, { filter: { topic: 'notes' } })).toEqual(['alice-msg']);
    });
  });

  // Observation rows carry their text in the vector metadata, so a store that relabels them can't
  // be checked against storage; only the honest-metadata cases apply.
  it.each(['applies-filter', 'ignores-filter'] as const)(
    'observation search leaves out other resources and, with a thread filter, other threads (%s)',
    async mode => {
      rows = [
        {
          id: 'o-alice',
          score: 0.9,
          metadata: { group_id: 'g-alice', thread_id: 'alice-thread', resource_id: 'alice', text: 'ALICE_OBS' },
        },
        {
          id: 'o-alice-other',
          score: 0.8,
          metadata: {
            group_id: 'g-alice-other',
            thread_id: 'alice-other',
            resource_id: 'alice',
            text: 'ALICE_OTHER_OBS',
          },
        },
        {
          id: 'o-bob',
          score: 0.95,
          metadata: { group_id: 'g-bob', thread_id: 'bob-thread', resource_id: 'bob', text: 'BOB_OBS' },
        },
      ];
      const memory = new Memory({
        storage,
        vector: scopeTestVector(mode, () => rows),
        embedder: embedder as any,
        options: { semanticRecall: { scope: 'resource', topK: 5 } },
      });

      const all = await memory.searchMessages({ query: 'secret', resourceId: 'alice' });
      expect(all.results.map(result => result.groupId)).toEqual(['g-alice', 'g-alice-other']);

      const oneThread = await memory.searchMessages({
        query: 'secret',
        resourceId: 'alice',
        filter: { threadId: 'alice-thread' },
      });
      expect(oneThread.results.map(result => result.groupId)).toEqual(['g-alice']);
    },
  );
});
