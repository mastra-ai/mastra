import { APICallError } from '@internal/ai-sdk-v5';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { KnowledgeSemanticIndex, KNOWLEDGE_MAX_PAGE_CHUNKS } from '../semantic';

class MemoryVector extends MastraVector {
  indexes = new Map<string, { dimension: number; rows: Map<string, number[]> }>();
  constructor() {
    super({ id: 'memory-vector' });
  }
  async query({ indexName, topK = 10 }: QueryVectorParams): Promise<QueryResult[]> {
    return [...(this.indexes.get(indexName)?.rows.keys() ?? [])].slice(0, topK).map(id => ({ id, score: 1 }));
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
    return [...this.indexes.values()].flatMap(index => [...index.rows.keys()]).sort();
  }
}

type EmbedderState = {
  calls: number;
  /** Texts containing this word fail permanently (a 400, like an input the provider refuses). */
  reject?: string;
  /** How many calls answer 429 before calls succeed again; Infinity keeps rate limiting. */
  rateLimited?: number;
  dimension?: number;
};

function embedder(state: EmbedderState): MastraEmbeddingModel<string> {
  return {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'fake',
    maxEmbeddingsPerCall: 1,
    supportsParallelCalls: true,
    doEmbed: async ({ values }: { values: string[] }) => {
      state.calls++;
      if (state.rateLimited && state.rateLimited-- > 0) {
        throw new APICallError({
          message: 'Too many requests',
          url: 'https://api.voyageai.com/v1/embeddings',
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: { 'retry-after': '0' },
          isRetryable: true,
        });
      }
      if (state.reject && values.some(v => v.includes(state.reject!))) {
        throw new APICallError({
          message: 'input refused',
          url: 'https://api.voyageai.com/v1/embeddings',
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        });
      }
      return { embeddings: values.map(() => Array.from({ length: state.dimension ?? 4 }, () => 0.5)) };
    },
  } as unknown as MastraEmbeddingModel<string>;
}

const RETRY_DELAYS = KnowledgeSemanticIndex.retryDelaysMs;

describe('Knowledge reembed()', () => {
  let storage: InMemoryStore;
  let plain: Knowledge;
  let vector: MemoryVector;
  let state: EmbedderState;
  let knowledge: Knowledge;

  const withEmbedder = (s: EmbedderState) =>
    new Knowledge({
      storage,
      scopes: knowledgeMemoryScopes(),
      vector,
      embedder: embedder(s),
      embedderOptions: { maxRetries: 0 },
    });

  beforeEach(async () => {
    storage = new InMemoryStore();
    // Content written before any embedder was configured.
    plain = new Knowledge({ storage, scopes: knowledgeMemoryScopes() });
    for (const n of [1, 2, 3, 4, 5]) {
      await plain.upsertPage({ scope: 'org:acme', path: `p${n}`, name: `Acme ${n}`, body: `Acme body ${n}` });
    }
    await plain.upsertPage({ scope: 'org:globex', path: 'g1', name: 'Globex 1', body: 'Globex body' });
    await plain.addNote({ scope: 'org:acme', path: 'p1', text: 'A note on acme 1' });
    vector = new MemoryVector();
    state = { calls: 0 };
    knowledge = withEmbedder(state);
    KnowledgeSemanticIndex.retryDelaysMs = [1, 1, 1];
  });
  afterEach(() => {
    KnowledgeSemanticIndex.retryDelaysMs = RETRY_DELAYS;
  });

  const pageIds = async (scope: string) => {
    const store = (await storage.getStore('knowledge'))!;
    const [s] = await store.getScopesByAddress([scope]);
    return (await store.listPages({ read: 'all', scopeId: s!.id })).pages;
  };

  it('embeds pages and notes written before an embedder was configured, without changing them', async () => {
    const before = await pageIds('org:acme');
    expect(vector.ids()).toEqual([]);

    const result = await knowledge.reembed();

    expect(result.embedded).toEqual({ pages: 6, notes: 1 });
    expect(result.failed).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
    expect(vector.ids()).toHaveLength(7);
    const after = await pageIds('org:acme');
    expect(after.map(p => [p.id, p.version, p.body, p.updatedAt])).toEqual(
      before.map(p => [p.id, p.version, p.body, p.updatedAt]),
    );
  });

  it('works in batches: a cursor resumes where the last call stopped, and every page is embedded once', async () => {
    const seen: number[] = [];
    let cursor: string | undefined;
    do {
      const result = await knowledge.reembed({ limit: 2, cursor });
      seen.push(result.embedded.pages);
      cursor = result.nextCursor;
    } while (cursor);

    // Six pages in batches of two; the calls after them walk the scope tree for notes on scope pages.
    expect(seen.slice(0, 3)).toEqual([2, 2, 2]);
    expect(seen.slice(3).every(n => n === 0)).toBe(true);
    expect(vector.ids().filter(id => id.startsWith('page:'))).toHaveLength(6);
    expect(state.calls).toBe(7);
  });

  it('is idempotent: running it again rewrites the same vector ids', async () => {
    await knowledge.reembed();
    const first = vector.ids();
    await knowledge.reembed();
    expect(vector.ids()).toEqual(first);
  });

  it('limits the run to one scope', async () => {
    const result = await knowledge.reembed({ scope: 'org:globex' });
    const [globex] = await pageIds('org:globex');

    expect(result.embedded).toEqual({ pages: 1, notes: 0 });
    expect(vector.ids()).toEqual([`page:${globex!.id}`]);
  });

  it('throws for a scope that does not exist', async () => {
    await expect(knowledge.reembed({ scope: 'org:nobody' })).rejects.toThrow(/org:nobody/);
  });

  it('embeds notes written on scope pages', async () => {
    const store = (await storage.getStore('knowledge'))!;
    const [acme] = await store.getScopesByAddress(['org:acme']);
    await store.addNote({
      pageId: acme!.id,
      text: 'A note on the scope page',
      stampScopeIds: [acme!.id],
      mentions: [],
      provenance: { author: 'host' },
    });
    const result = await knowledge.reembed({ scope: 'org:acme' });
    expect(result.embedded.notes).toBe(2);
  });

  it('reports a page whose embed fails and carries on with the rest of the batch', async () => {
    state.reject = 'Acme body 3';
    const result = await knowledge.reembed({ scope: 'org:acme' });
    const p3 = (await pageIds('org:acme')).find(p => p.name === 'Acme 3')!;

    expect(result.failed).toEqual([{ kind: 'page', id: p3.id, error: expect.stringContaining('input refused') }]);
    expect(result.embedded.pages).toBe(4);
    expect(result.nextCursor).toBeUndefined();
  });

  it('stops early with a cursor when the provider keeps rate limiting, and the cursor retries that page', async () => {
    const first = await knowledge.reembed({ scope: 'org:acme', limit: 2 });
    expect(first.embedded.pages).toBe(2);

    state.rateLimited = Infinity;
    const limited = await knowledge.reembed({ scope: 'org:acme', limit: 2, cursor: first.nextCursor });
    expect(limited.rateLimited).toBe(true);
    expect(limited.embedded.pages).toBe(0);
    expect(limited.failed).toEqual([]);
    expect(limited.nextCursor).toBeDefined();

    state.rateLimited = 0;
    let cursor = limited.nextCursor;
    let pages = 0;
    while (cursor) {
      const result = await knowledge.reembed({ scope: 'org:acme', limit: 2, cursor });
      pages += result.embedded.pages;
      cursor = result.nextCursor;
    }
    expect(pages).toBe(3);
    expect(vector.ids().filter(id => id.startsWith('page:'))).toHaveLength(5);
  });

  it('retries a passing 429 and carries on', async () => {
    state.rateLimited = 1;
    const result = await knowledge.reembed({ scope: 'org:acme' });
    expect(result.rateLimited).toBeUndefined();
    expect(result.embedded.pages).toBe(5);
  });

  it('lists pages over the chunk cap, embedded up to the cap', async () => {
    // About 1,000 tokens per paragraph, so the body needs well over the cap's worth of 2,000-token chunks.
    const huge = Array.from(
      { length: KNOWLEDGE_MAX_PAGE_CHUNKS * 3 },
      (_, i) => `Paragraph ${i}. ${'lorem ipsum dolor '.repeat(330)}`,
    ).join('\n\n');
    await plain.upsertPage({ scope: 'org:globex', path: 'huge', name: 'Huge', body: huge });
    const result = await knowledge.reembed({ scope: 'org:globex' });
    const page = (await pageIds('org:globex')).find(p => p.name === 'Huge')!;

    expect(result.overChunkCap).toEqual([{ pageId: page.id, chunks: expect.any(Number) }]);
    expect(result.overChunkCap[0]!.chunks).toBeGreaterThan(KNOWLEDGE_MAX_PAGE_CHUNKS);
    expect(vector.ids().filter(id => id.startsWith(`page:${page.id}`))).toHaveLength(KNOWLEDGE_MAX_PAGE_CHUNKS);
  });

  it('moves vectors to the new dimension after switching embedders', async () => {
    await knowledge.reembed();
    const switched = withEmbedder({ calls: 0, dimension: 8 });
    await switched.reembed();
    expect([...vector.indexes].filter(([, index]) => index.rows.size > 0).map(([, index]) => index.dimension)).toEqual([
      8,
    ]);
  });

  it('rejects a limit out of range and a cursor it did not issue', async () => {
    await expect(knowledge.reembed({ limit: 0 })).rejects.toThrow(/limit/);
    await expect(knowledge.reembed({ limit: 501 })).rejects.toThrow(/limit/);
    await expect(knowledge.reembed({ cursor: 'nonsense' })).rejects.toThrow(/cursor/);
  });

  it('throws without a vector store and embedder', async () => {
    await expect(plain.reembed()).rejects.toThrow(/vector/);
  });
});
