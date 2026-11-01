import { APICallError } from '@internal/ai-sdk-v5';
import { beforeEach, describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { MastraVector } from '../../vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  MastraEmbeddingModel,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '../../vector';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

/** A real exact-cosine vector store held in memory; records every topK it is asked for. */
class MemoryVector extends MastraVector {
  indexes = new Map<string, { dimension: number; rows: Map<string, number[]> }>();
  topKs: number[] = [];

  constructor() {
    super({ id: 'memory-vector' });
  }
  async query({ indexName, queryVector, topK = 10 }: QueryVectorParams): Promise<QueryResult[]> {
    this.topKs.push(topK);
    const rows = this.indexes.get(indexName)?.rows ?? new Map();
    const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
    const q = queryVector!;
    return [...rows]
      .map(([id, v]) => ({ id, score: v.reduce((a, x, i) => a + x * q[i]!, 0) / (norm(v) * norm(q)) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, topK);
  }
  async upsert({ indexName, ids, vectors }: UpsertVectorParams): Promise<string[]> {
    const index = this.indexes.get(indexName)!;
    ids!.forEach((id, i) => index.rows.set(id, vectors[i]!));
    return ids!;
  }
  async createIndex({ indexName, dimension }: CreateIndexParams): Promise<void> {
    this.indexes.set(indexName, { dimension, rows: new Map() });
  }
  async listIndexes(): Promise<string[]> {
    return [...this.indexes.keys()];
  }
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const index = this.indexes.get(indexName)!;
    return { dimension: index.dimension, count: index.rows.size, metric: 'cosine' };
  }
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    this.indexes.delete(indexName);
  }
  async updateVector(_: UpdateVectorParams): Promise<void> {
    throw new Error('not used');
  }
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    this.indexes.get(indexName)?.rows.delete(id);
  }
  async deleteVectors({ indexName, ids }: DeleteVectorsParams): Promise<void> {
    for (const id of ids ?? []) this.indexes.get(indexName)?.rows.delete(id);
  }
  ids(): string[] {
    return [...this.indexes.values()].flatMap(index => [...index.rows.keys()]);
  }
}

/** Words map onto concept axes, so "reimbursement" lands near "refund" with no shared word. */
const CONCEPTS: Record<string, number> = {
  refund: 0,
  refunds: 0,
  reimbursement: 0,
  money: 0,
  back: 0,
  shipping: 1,
  delivery: 1,
  courier: 1,
  holiday: 2,
  vacation: 2,
  leave: 2,
};
type EmbedderState = { fail: boolean; calls: number; transient?: number; options?: Record<string, unknown>[] };
function conceptEmbedder(state: EmbedderState): MastraEmbeddingModel<string> {
  return {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'concepts',
    maxEmbeddingsPerCall: 1,
    supportsParallelCalls: true,
    doEmbed: async ({ values, ...options }: { values: string[] } & Record<string, unknown>) => {
      state.calls++;
      state.options?.push(options);
      if (state.fail) throw new Error('embedder down');
      if (state.transient && state.transient-- > 0) {
        throw new APICallError({
          message: 'rate limited',
          url: 'x',
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });
      }
      return {
        embeddings: values.map(text => {
          const v = [0.01, 0.01, 0.01, 0.01];
          for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
            const axis = CONCEPTS[word];
            v[axis ?? 3]! += axis === undefined ? 0.05 : 1;
          }
          return v;
        }),
      };
    },
  } as unknown as MastraEmbeddingModel<string>;
}

type Result = Record<string, any>;

describe('Knowledge semantic search', () => {
  let store: KnowledgeStorage;
  let vector: MemoryVector;
  let embedder: EmbedderState;
  let warnings: string[];
  let knowledge: Knowledge;

  const as = (held: string[]) => {
    const tools = knowledge.createTools();
    return async (tool: string, input: Record<string, unknown>): Promise<Result> => {
      const requestContext = new RequestContext();
      setRunAgentScopes(requestContext, held);
      return (await tools[tool]!.execute!(
        input as never,
        { requestContext, agent: { agentId: 'a' } } as never,
      )) as Result;
    };
  };
  const acme = () => as(['org:acme', 'resource:u-acme']);
  const globex = () => as(['org:globex', 'resource:u-globex']);
  const titles = (result: Result) =>
    result.results.map((hit: Result) => (hit.type === 'note' ? `note:${hit.note.text}` : hit.page.name));

  beforeEach(async () => {
    const storage = new InMemoryStore();
    store = (await storage.getStore('knowledge'))!;
    vector = new MemoryVector();
    embedder = { fail: false, calls: 0 };
    warnings = [];
    knowledge = new Knowledge({
      storage,
      scopes: knowledgeMemoryScopes(),
      tools: true,
      vector,
      embedder: conceptEmbedder(embedder),
    });
    (knowledge as any).logger = { warn: (m: string) => warnings.push(m), debug() {}, info() {}, error() {} };
  });

  it('finds a page by meaning that keyword search misses', async () => {
    await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Courier contacts',
      body: 'Shipping partners.',
    });

    // Keyword search alone finds nothing for the synonym.
    expect(await store.searchPages({ query: 'reimbursement', read: 'all' })).toEqual([]);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))[0]).toBe('Refund policy');
  });

  it('25 better-scoring hidden pages neither take slots nor hide the one visible match (§ semantic filtering)', async () => {
    for (let i = 0; i < 25; i++) {
      await globex()('knowledge_page', {
        op: 'write',
        scope: 'org:globex',
        name: `Globex refund ${i}`,
        body: 'refund refund refund money back reimbursement',
      });
    }
    await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Acme handbook',
      body: 'Refunds, plus office hours and parking.',
    });

    vector.topKs = [];
    const result = await acme()('knowledge_search', { query: 'reimbursement', limit: 1 });
    expect(titles(result)).toEqual(['Acme handbook']);
    // It had to refill past the hidden hits: 4, then 16, then 64.
    expect(vector.topKs).toEqual([4, 16, 64]);
    // And the other tenant still sees its own.
    expect(titles(await globex()('knowledge_search', { query: 'reimbursement', limit: 3 }))).toHaveLength(3);
  });

  it('notes are indexed, and only surface where the note itself is readable', async () => {
    const { page } = await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Ops', body: 'misc' });
    await acme()('knowledge_note', {
      op: 'add',
      page: page.id,
      scope: ['resource:u-acme'],
      text: 'Vacation requests go to HR.',
    });

    expect(titles(await acme()('knowledge_search', { query: 'holiday' }))[0]).toBe('note:Vacation requests go to HR.');
    // Same org, different user: the page is readable but the note's only stamp is not.
    expect(titles(await as(['org:acme', 'resource:u-other'])('knowledge_search', { query: 'holiday' }))).toEqual([
      'Ops',
    ]);
  });

  it('keeps the index in step with edits, note removal and merges', async () => {
    await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Notes', body: 'Refunds and vacation.' });
    const { page } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Desk',
      body: 'Courier pickups at 3pm.',
    });
    expect(titles(await acme()('knowledge_search', { query: 'delivery' }))[0]).toBe('Desk');

    await acme()('knowledge_page', { op: 'write', page: page.id, body: 'Vacation vacation calendar.' });
    expect(titles(await acme()('knowledge_search', { query: 'holiday' }))[0]).toBe('Desk');
    expect(titles(await acme()('knowledge_search', { query: 'delivery' }))[0]).toBe('Notes');

    const { note } = await acme()('knowledge_note', {
      op: 'add',
      page: page.id,
      scope: ['org:acme'],
      text: 'Shipping cutoff is noon.',
    });
    expect(vector.ids()).toContain(`note:${note.id}`);
    await acme()('knowledge_note', { op: 'remove', note: note.id });
    expect(vector.ids()).not.toContain(`note:${note.id}`);

    // Merging a page away needs owner, which the user holds on their own resource scope.
    const { page: mine } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'resource:u-acme',
      name: 'Mine',
      body: 'x',
    });
    const { page: other } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'resource:u-acme',
      name: 'Old desk',
      body: 'x',
    });
    expect(vector.ids()).toContain(`page:${other.id}`);
    await acme()('knowledge_page', { op: 'merge', page: other.id, into: mine.id });
    expect(vector.ids()).not.toContain(`page:${other.id}`);
  });

  it('a failed embed keeps the write, warns, and reindex() repairs it; a failed search falls back to keywords', async () => {
    embedder.fail = true;
    const created = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    expect(created.page.name).toBe('Refund policy');
    expect(warnings.some(w => w.includes('run knowledge.reindex()'))).toBe(true);

    expect(titles(await acme()('knowledge_search', { query: 'refund' }))).toEqual(['Refund policy']);
    expect(warnings.some(w => w.includes('returning keyword results only'))).toBe(true);

    embedder.fail = false;
    expect(vector.ids()).toEqual([]);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual([]);
    // Scope pages are not embedded; the one ordinary page is.
    expect(await knowledge.reindex()).toBe(1);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual(['Refund policy']);
  });

  it('reindex() repairs notes written on scope pages, which listPages leaves out', async () => {
    embedder.fail = true;
    await acme()('knowledge_note', {
      op: 'add',
      page: 'org:acme',
      scope: ['org:acme'],
      text: 'Vacation requests go to HR.',
    });
    expect(vector.ids()).toEqual([]);
    embedder.fail = false;

    expect(await knowledge.reindex()).toBe(1);
    expect(titles(await acme()('knowledge_search', { query: 'holiday' }))).toEqual([
      'note:Vacation requests go to HR.',
    ]);
  });

  it('embeds through the SDK: maxRetries retries transient failures, headers and providerOptions reach the model', async () => {
    const state: EmbedderState = { fail: false, calls: 0, transient: 2, options: [] };
    knowledge = new Knowledge({
      storage: new InMemoryStore(),
      scopes: knowledgeMemoryScopes(),
      tools: true,
      vector,
      embedder: conceptEmbedder(state),
      embedderOptions: { maxRetries: 2, headers: { 'x-team': 'kb' }, providerOptions: { test: { dims: 4 } } },
    });
    (knowledge as any).logger = { warn: (m: string) => warnings.push(m), debug() {}, info() {}, error() {} };

    await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Refund policy', body: 'Refunds.' });
    expect(warnings).toEqual([]);
    expect(state.calls).toBe(3);
    expect(vector.ids()).toHaveLength(1);
    expect(state.options![0]).toMatchObject({ headers: { 'x-team': 'kb' }, providerOptions: { test: { dims: 4 } } });
    expect(state.options![0]).not.toHaveProperty('maxRetries');
  });

  it('a stale vector for a deleted page never surfaces', async () => {
    const { page } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds.',
    });
    await store.deletePage({ id: page.id, expectedVersion: page.version, deletedBy: 'host' });
    expect(vector.ids()).toContain(`page:${page.id}`);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual([]);
  });

  it('needs both vector and embedder; reindex without them throws', async () => {
    expect(() => new Knowledge({ scopes: {}, vector })).toThrow(/needs both `vector` and `embedder`/);
    await expect(new Knowledge({ scopes: {}, storage: new InMemoryStore() }).reindex()).rejects.toThrow(/no `vector`/);
  });
});
