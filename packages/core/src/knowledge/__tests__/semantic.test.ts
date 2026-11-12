import { APICallError } from '@internal/ai-sdk-v5';
import { estimateTokenCount } from 'tokenx';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { KnowledgeSemanticIndex } from '../semantic';
import { agentRunContext } from './agent-run-context';

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
  /** Upserts left to fail, like a cold scale-to-zero database timing out the connection; -1 fails them all. */
  failUpserts = 0;
  upserts = 0;
  async upsert({ indexName, ids, vectors }: UpsertVectorParams): Promise<string[]> {
    this.upserts++;
    if (this.failUpserts !== 0) {
      if (this.failUpserts > 0) this.failUpserts--;
      throw new Error('Connection terminated due to connection timeout');
    }
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
  /** Set to make deleteVectors throw, like Astra, which can't delete by id list. */
  failDeletes = false;
  async deleteVectors({ indexName, ids }: DeleteVectorsParams): Promise<void> {
    if (this.failDeletes) throw new Error('deleteVectors is not supported');
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
type EmbedderState = {
  fail: boolean;
  calls: number;
  transient?: number;
  options?: Record<string, unknown>[];
  /** Refuses any input over this many estimated tokens, like a real embedder's input limit. */
  maxTokens?: number;
};
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
      if (state.maxTokens && values.some(text => estimateTokenCount(text) > state.maxTokens!)) {
        throw new APICallError({
          message: 'input too long',
          url: 'x',
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        });
      }
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
const RETRY_DELAYS = KnowledgeSemanticIndex.retryDelaysMs;

describe('Knowledge semantic search', () => {
  let store: KnowledgeStorage;
  let vector: MemoryVector;
  let embedder: EmbedderState;
  let warnings: string[];
  let knowledge: Knowledge;

  const as = (held: string[]) => {
    const tools = knowledge.createTools();
    return async (tool: string, input: Record<string, unknown>): Promise<Result> => {
      return (await tools[tool]!.execute!(input as never, agentRunContext('a', held) as never)) as Result;
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
    KnowledgeSemanticIndex.retryDelaysMs = [1, 1, 1];
  });
  afterEach(() => {
    KnowledgeSemanticIndex.retryDelaysMs = RETRY_DELAYS;
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

  it('a failed embed keeps the write, warns, and the next change embeds it; a failed search falls back to keywords', async () => {
    embedder.fail = true;
    const created = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    expect(created.page.name).toBe('Refund policy');
    expect(
      warnings.some(w =>
        w.includes(
          `Knowledge couldn't embed page "${created.page.id}" after retrying; it is findable by keyword search only until it is rewritten`,
        ),
      ),
    ).toBe(true);
    expect(warnings.some(w => w.includes('reindex'))).toBe(false);

    expect(titles(await acme()('knowledge_search', { query: 'refund' }))).toEqual(['Refund policy']);
    expect(warnings.some(w => w.includes('returning keyword results only'))).toBe(true);

    embedder.fail = false;
    expect(vector.ids()).toEqual([]);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual([]);

    await acme()('knowledge_page', { op: 'write', page: created.page.id, body: 'Refunds within 60 days.' });
    expect(vector.ids()).toEqual([`page:${created.page.id}`]);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual(['Refund policy']);
  });

  it('a failed vector removal warns that old vectors may remain, and search skips the removed page', async () => {
    const { page: mine } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'resource:u-acme',
      name: 'Mine',
      body: 'x',
    });
    const { page } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'resource:u-acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    vector.failDeletes = true;
    await acme()('knowledge_page', { op: 'merge', page: page.id, into: mine.id });
    await knowledge.upsertPage({ scope: 'org:acme', path: 'old', name: 'Old desk', body: 'x' });
    await knowledge.removePage({ scope: 'org:acme', path: 'old' });

    const removals = warnings.filter(w => w.includes('removal failed'));
    expect(removals).toHaveLength(2);
    expect(removals.every(w => w.includes('search skips content that no longer exists'))).toBe(true);
    expect(warnings.some(w => w.includes("couldn't embed"))).toBe(false);
    expect(vector.ids()).toContain(`page:${page.id}`);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).not.toContain('Refund policy');
  });

  it('a host upsertPage whose embed failed is embedded when the page next changes', async () => {
    embedder.fail = true;
    const first = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'refunds',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    expect(first.status).toBe('created');
    expect(warnings.some(w => w.includes('page "org:acme#refunds"') && w.includes('keyword search only'))).toBe(true);
    embedder.fail = false;

    // Re-sending the same content writes nothing, so nothing is embedded either.
    const same = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'refunds',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    expect(same.status).toBe('unchanged');
    expect(vector.ids()).toEqual([]);

    const changed = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'refunds',
      name: 'Refund policy',
      body: 'Refunds within 60 days.',
    });
    expect(changed.status).toBe('updated');
    expect(vector.ids()).toEqual([`page:${first.page.id}`]);
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).toEqual(['Refund policy']);
  });

  it('a note whose embed failed is embedded when it is next changed', async () => {
    await knowledge.upsertPage({ scope: 'org:acme', path: 'ops', name: 'Ops', body: 'misc' });
    const pages = vector.ids();
    embedder.fail = true;
    const note = await knowledge.addNote({ scope: 'org:acme', path: 'ops', text: 'Vacation requests go to HR.' });
    expect(vector.ids()).toEqual(pages);
    embedder.fail = false;

    const updated = await knowledge.updateNote({ id: note.id, text: 'Vacation requests go to HR by Friday.' });
    expect(vector.ids()).toEqual([...pages, `note:${updated.id}`]);
    expect(titles(await acme()('knowledge_search', { query: 'holiday' }))[0]).toBe(
      'note:Vacation requests go to HR by Friday.',
    );
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
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))).not.toContain('Refund policy');
  });

  /** About 5,000 estimated tokens of filler, with `fact` as one paragraph near the end. */
  const longBody = (fact: string) =>
    Array.from({ length: 24 }, (_, i) =>
      i === 20 ? fact : `## Part ${i}\n\n${'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(25)}`,
    ).join('\n\n');
  const chunkIds = (pageId: string) => vector.ids().filter(id => id.startsWith(`page:${pageId}`));

  it('embeds a page too long for the embedder as chunks, and finds it once by meaning', async () => {
    embedder.maxTokens = 3_000;
    const body = longBody('Reimbursement goes back to the original card.');
    expect(estimateTokenCount(body)).toBeGreaterThan(4_000);
    const { page } = await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Handbook', body });
    await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Courier contacts', body: 'Shipping.' });

    expect(warnings).toEqual([]);
    const ids = chunkIds(page.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(ids).toContain(`page:${page.id}`);
    expect(ids).toContain(`page:${page.id}#1`);

    const result = await acme()('knowledge_search', { query: 'money' });
    expect(titles(result)).toEqual(['Handbook', 'Courier contacts']);
    // The same hit as an unchunked page: one result, page summary only.
    expect(Object.keys(result.results[0]).sort()).toEqual(Object.keys(result.results[1]).sort());
  });

  it('a host upsertPage of a page too long for the embedder is searchable by meaning', async () => {
    embedder.maxTokens = 3_000;
    const result = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'guides/handbook',
      name: 'Handbook',
      body: longBody('Reimbursement goes back to the original card.'),
    });
    expect(result.status).toBe('created');
    expect(warnings).toEqual([]);
    expect(titles(await acme()('knowledge_search', { query: 'refund' }))).toContain('Handbook');
  });

  it('a shorter rewrite drops the old chunks, and deleting the page drops them all', async () => {
    embedder.maxTokens = 3_000;
    // A long body can only be replaced whole by the host; the tool edits it part by part.
    const write = (body: string) =>
      knowledge.upsertPage({ scope: 'org:acme', path: 'handbook', name: 'Handbook', body });
    const { page } = await write(longBody('Reimbursement goes back to the original card.'));
    expect(chunkIds(page.id).length).toBeGreaterThan(1);

    await write('Courier pickups at 3pm.');
    expect(chunkIds(page.id)).toEqual([`page:${page.id}`]);
    expect(titles(await acme()('knowledge_search', { query: 'money' }))).toEqual(['Handbook']);
    expect(titles(await acme()('knowledge_search', { query: 'delivery' }))[0]).toBe('Handbook');

    await write(longBody('Holiday calendar.'));
    expect(chunkIds(page.id).length).toBeGreaterThan(1);
    await knowledge.removePage({ scope: 'org:acme', path: 'handbook' });
    expect(chunkIds(page.id)).toEqual([]);
  });

  it('a rewrite still embeds the new body when the store cannot delete old chunks', async () => {
    await knowledge.upsertPage({ scope: 'org:acme', path: 'a', name: 'A', body: 'Courier pickups at 3pm.' });
    vector.failDeletes = true;
    await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'a',
      name: 'A',
      body: 'Reimbursement goes back to the card.',
    });
    expect(warnings).toEqual([]);
    expect(titles(await acme()('knowledge_search', { query: 'money' }))).toEqual(['A']);
  });

  it('a long name does not crowd the body out of its chunks', async () => {
    embedder.maxTokens = 3_000;
    const name = 'Handbook '.repeat(2_000);
    const { page } = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'handbook',
      name,
      body: longBody('Reimbursement goes back to the original card.'),
    });
    expect(warnings).toEqual([]);
    expect(chunkIds(page.id).length).toBeGreaterThan(1);
    expect(chunkIds(page.id).length).toBeLessThan(10);
  });

  it('a vector write that fails while the database wakes is retried, and the page is embedded', async () => {
    vector.failUpserts = 2;
    const { page } = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });
    const { status } = await knowledge.upsertPage({ scope: 'org:acme', path: 'desk', name: 'Desk', body: 'Courier.' });
    expect(status).toBe('created');
    vector.failUpserts = 2;
    const note = await knowledge.addNote({ scope: 'org:acme', path: 'desk', text: 'Vacation requests go to HR.' });

    expect(warnings).toEqual([]);
    expect(vector.ids()).toEqual(expect.arrayContaining([`page:${page.id}`, `note:${note.id}`]));
    expect(titles(await acme()('knowledge_search', { query: 'reimbursement' }))[0]).toBe('Refund policy');
  });

  it('retries a chunked page until every chunk is in', async () => {
    embedder.maxTokens = 3_000;
    vector.failUpserts = 3;
    const { page } = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'guides/handbook',
      name: 'Handbook',
      body: longBody('Reimbursement goes back to the original card.'),
    });
    expect(warnings).toEqual([]);
    expect(chunkIds(page.id).length).toBeGreaterThan(1);
    expect(titles(await acme()('knowledge_search', { query: 'refund' }))).toContain('Handbook');
  });

  it('when every try fails, the write stands and the warning names the page as keyword-only', async () => {
    vector.failUpserts = -1;
    const result = await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'guides/cli',
      name: 'CLI',
      body: 'Refunds within 30 days.',
    });
    expect(result.status).toBe('created');
    // Four tries for the page, after four for the guides parent it created.
    expect(vector.upserts).toBe(8);
    const failed = warnings.filter(w => w.includes("couldn't embed"));
    expect(failed).toEqual([
      expect.stringContaining('page "org:acme#guides" after retrying'),
      expect.stringContaining(
        'page "org:acme#guides/cli" after retrying; it is findable by keyword search only until it is rewritten: Error: Connection terminated',
      ),
    ]);
    expect(titles(await acme()('knowledge_search', { query: 'refund' }))).toEqual(['CLI']);
  });

  it('does not retry an embed the provider says cannot pass', async () => {
    embedder.maxTokens = 1;
    await knowledge.upsertPage({ scope: 'org:acme', path: 'a', name: 'A', body: 'Refunds within 30 days.' });
    expect(embedder.calls).toBe(1);
    expect(warnings.filter(w => w.includes('page "org:acme#a"'))).toHaveLength(1);
  });

  it('needs both vector and embedder', () => {
    expect(() => new Knowledge({ scopes: {}, vector })).toThrow(/needs both `vector` and `embedder`/);
  });
});

describe('KnowledgeSemanticIndex bounds', () => {
  it('looks at no more than 1,000 distinct candidates in one search', async () => {
    const vector = new MemoryVector();
    const index = new KnowledgeSemanticIndex(vector, conceptEmbedder({ fail: false, calls: 0 }));
    // 3,000 notes, none the run can read: every one is a candidate that takes no slot.
    await index.indexNote({ id: 'n0', text: 'refund' } as never);
    const [indexName] = await vector.listIndexes();
    const rows = vector.indexes.get(indexName!)!.rows;
    for (let i = 1; i < 3_000; i++) rows.set(`note:n${i}`, [1, 0.01, 0.01, 0.01 + i / 1e6]);

    let looked = 0;
    const found = await index.search('refund', 10, async () => {
      looked++;
      return null;
    });
    expect(found).toEqual([]);
    expect(looked).toBe(1_000);
  });

  it.each([
    { parallel: true, atLeast: 2, atMost: 4 },
    { parallel: false, atLeast: 1, atMost: 1 },
  ])(
    "embeds a long page's chunks a few at a time, one at a time when parallel calls is $parallel",
    async ({ parallel, atLeast, atMost }) => {
      let inFlight = 0;
      let most = 0;
      const embedder = {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'slow',
        maxEmbeddingsPerCall: 1,
        supportsParallelCalls: parallel,
        doEmbed: async ({ values }: { values: string[] }) => {
          most = Math.max(most, ++inFlight);
          await new Promise(resolve => setTimeout(resolve, 5));
          inFlight--;
          return { embeddings: values.map(() => [1, 0, 0, 0]) };
        },
      } as unknown as MastraEmbeddingModel<string>;
      const index = new KnowledgeSemanticIndex(new MemoryVector(), embedder);
      const body = Array.from(
        { length: 12 },
        (_, i) => `## Part ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(200)}`,
      ).join('\n\n');
      await index.indexPage({ id: 'p1', name: 'Long', body, isScope: false } as never);

      expect(most).toBeGreaterThanOrEqual(atLeast);
      expect(most).toBeLessThanOrEqual(atMost);
    },
  );
});
