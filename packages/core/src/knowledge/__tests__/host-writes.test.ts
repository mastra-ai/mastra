import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraVector } from '../../vector';
import type { MastraEmbeddingModel, QueryResult } from '../../vector';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import type { KnowledgeChangeEvent } from '../index';

/** Records which ids are embedded; enough of a vector store for writes. */
class RecordingVector extends MastraVector {
  rows = new Map<string, string>();
  indexes = new Set<string>();
  constructor() {
    super({ id: 'recording' });
  }
  async upsert({ ids, metadata }: any): Promise<string[]> {
    ids.forEach((id: string, i: number) => this.rows.set(id, metadata?.[i]?.kind ?? ''));
    return ids;
  }
  async deleteVectors({ ids }: any): Promise<void> {
    for (const id of ids ?? []) this.rows.delete(id);
  }
  async createIndex({ indexName }: any): Promise<void> {
    this.indexes.add(indexName);
  }
  async listIndexes(): Promise<string[]> {
    return [...this.indexes];
  }
  async query(): Promise<QueryResult[]> {
    return [];
  }
  async describeIndex(): Promise<any> {
    return { dimension: 2, count: this.rows.size, metric: 'cosine' };
  }
  async deleteIndex(): Promise<void> {}
  async updateVector(): Promise<void> {}
  async deleteVector(): Promise<void> {}
}

const embedder = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'flat',
  maxEmbeddingsPerCall: 1,
  supportsParallelCalls: true,
  doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [1, 0]) }),
} as unknown as MastraEmbeddingModel<string>;

const memory = knowledgeMemoryScopes();

function setup() {
  const storage = new InMemoryStore();
  const vector = new RecordingVector();
  const knowledge = new Knowledge({
    storage,
    tools: true,
    vector,
    embedder,
    scopes: {
      ...memory,
      'org:$orgId': memory['org:$orgId'],
      'docs:$orgId': {
        belongsTo: 'org:$orgId',
        access: [{ principal: 'org:$orgId', role: 'viewer' }],
        pages: [{ key: 'start', name: 'Start here' }],
      },
    },
  });
  const tools = knowledge.createTools();
  const call = (held: string[], tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, held);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, storage, vector, call };
}

describe('Knowledge host page writes', () => {
  it('creates a page at a key path, then updates it in place and skips unchanged writes', async () => {
    const { knowledge, vector } = setup();
    const events: KnowledgeChangeEvent[] = [];
    knowledge.onChange(event => events.push(event));

    const first = await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'guides/install',
      name: 'Install',
      description: 'How to install',
      body: 'npm i acme',
      author: 'sync:docs',
    });
    expect(first.status).toBe('created');
    expect(first.page).toMatchObject({ key: 'install', name: 'Install', body: 'npm i acme', version: 1 });
    expect(first.page.createdBy.author).toBe('sync:docs');

    const again = await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'guides/install',
      name: 'Install',
      description: 'How to install',
      body: 'npm i acme',
    });
    expect(again).toMatchObject({ status: 'unchanged', page: { id: first.page.id, version: 1 } });

    const updated = await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'guides/install',
      name: 'Install',
      body: 'pnpm add acme',
    });
    expect(updated).toMatchObject({
      status: 'updated',
      page: { id: first.page.id, version: 2, body: 'pnpm add acme' },
    });
    expect(updated.page.description).toBe('How to install');

    expect(vector.rows.get(`page:${first.page.id}`)).toBe('page');
    expect(events.filter(event => event.kind === 'page').map(event => (event as { op: string }).op)).toEqual([
      'create',
      'create',
      'update',
    ]);
  });

  it('creates missing pages along the path named by their key, and later writes name them', async () => {
    const { knowledge, storage } = setup();
    const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'guides/cli/login', name: 'Log in' });
    const store = (await storage.getStore('knowledge'))!;
    const guides = await store.getPageByPath({ scopeId: page.scopeId, path: ['guides'], read: 'all' });
    expect(guides).toMatchObject({ name: 'guides', key: 'guides' });

    const named = await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'guides',
      name: 'Guides',
      body: 'All guides',
    });
    expect(named).toMatchObject({ status: 'updated', page: { id: guides!.id, name: 'Guides' } });
  });

  it('keeps notes on a page across body updates', async () => {
    const { knowledge } = setup();
    const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'faq', name: 'FAQ', body: 'v1' });
    const store = await knowledge.getStorage();
    await store.addNote({
      pageId: page.id,
      text: 'Customers keep asking about SSO.',
      stampScopeIds: [page.scopeId],
      mentions: [],
      provenance: { author: 'agent:support' },
    });
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'faq', name: 'FAQ', body: 'v2' });
    const { notes } = await store.listNotes({ pageId: page.id, read: 'all' });
    expect(notes.map(note => note.text)).toEqual(['Customers keep asking about SSO.']);
  });

  it('is readable by runs the scope rules let in, not by others', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'install', name: 'Install', body: 'npm i acme' });
    const read = await call(['org:acme'], 'knowledge_read', { page: 'docs:acme#install' });
    expect(read.page.name).toBe('Install');
    await expect(call(['org:other'], 'knowledge_read', { page: 'docs:acme#install' })).rejects.toThrow(/not found/);
  });

  it('removes a page and its vector, and returns null when there is nothing to remove', async () => {
    const { knowledge, vector, call } = setup();
    const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'old', name: 'Old', body: 'gone soon' });
    const removed = await knowledge.removePage({ scope: 'docs:acme', path: 'old' });
    expect(removed).toMatchObject({ id: page.id });
    expect(removed!.deletedAt).toBeInstanceOf(Date);
    expect(vector.rows.has(`page:${page.id}`)).toBe(false);
    await expect(call(['org:acme'], 'knowledge_read', { page: 'docs:acme#old' })).rejects.toThrow(/not found/);

    expect(await knowledge.removePage({ scope: 'docs:acme', path: 'old' })).toBeNull();
    expect(await knowledge.removePage({ scope: 'docs:nobody', path: 'old' })).toBeNull();

    const recreated = await knowledge.upsertPage({ scope: 'docs:acme', path: 'old', name: 'Old', body: 'back' });
    expect(recreated.status).toBe('created');
    expect(recreated.page.id).not.toBe(page.id);
  });

  it('writes a page declared in config but refuses to remove it, and refuses a page with children', async () => {
    const { knowledge } = setup();
    const start = await knowledge.upsertPage({ scope: 'docs:acme', path: 'start', name: 'Start here', body: 'Hi' });
    expect(start.status).toBe('updated');
    await expect(knowledge.removePage({ scope: 'docs:acme', path: 'start' })).rejects.toThrow(
      `"docs:acme#start" is declared in config; change the scope's pages to remove it.`,
    );

    await knowledge.upsertPage({ scope: 'docs:acme', path: 'guides/install', name: 'Install' });
    await expect(knowledge.removePage({ scope: 'docs:acme', path: 'guides' })).rejects.toThrow(
      '"docs:acme#guides" has child pages; remove them first.',
    );
  });

  it('refuses undeclared scopes and bad paths', async () => {
    const { knowledge } = setup();
    await expect(knowledge.upsertPage({ scope: 'wiki:acme', path: 'a', name: 'A' })).rejects.toThrow(
      /does not match a declared scope type/,
    );
    for (const path of ['', 'a//b', '/a', 'a/']) {
      await expect(knowledge.upsertPage({ scope: 'docs:acme', path, name: 'A' })).rejects.toThrow(/non-empty keys/);
    }
    await expect(knowledge.upsertPage({ scope: 'docs:acme', path: 'a#b', name: 'A' })).rejects.toThrow();
  });

  it('settles concurrent writes to one new path on a single page', async () => {
    const { knowledge } = setup();
    const results = await Promise.all(
      ['one', 'two', 'three'].map(body =>
        knowledge.upsertPage({ scope: 'docs:acme', path: 'race', name: 'Race', body }),
      ),
    );
    expect(new Set(results.map(result => result.page.id)).size).toBe(1);
  });
});
