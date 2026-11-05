import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { KnowledgeDeclarationError, knowledgeMemoryScopes, knowledgeSharedReadScope } from '../declarations';
import { Knowledge } from '../index';

const host = { author: 'host' };
const SHARED = ['linear:$account:$connection', 'linear:$account:$connection/archive', 'handbook:main'];

/** A store that shares Linear scopes it imported, next to a project's own `docs` scopes. */
async function setup(shared: string[] = SHARED) {
  const store = new InMemoryStore();
  const knowledge = new Knowledge({
    storage: store,
    tools: true,
    scopes: { ...knowledgeMemoryScopes(), 'docs:$team': { access: [{ principal: 'self', role: 'owner' }] } },
  });
  const storage = await knowledge.getStorage();
  const sharing = vi.spyOn(storage, 'listSharedScopeDeclarations').mockResolvedValue(shared);
  const { scope: linear } = await storage.materializeScope({
    address: 'linear:acme:conn_1',
    declaration: 'linear:$account:$connection',
    name: 'Linear (acme)',
    provenance: host,
    children: [
      { address: 'linear:acme:conn_1/archive', declaration: 'linear:$account:$connection/archive', name: 'Archive' },
    ],
  });
  await storage.createPage({ parentId: linear.id, key: 'roadmap', name: 'Roadmap', body: 'Ship Q3', provenance: host });
  const tools = knowledge.createTools({ write: true });
  const call = (tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, ['docs:eng']);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, storage, call, sharing };
}

describe('Knowledge scopes a store shares with every reader', () => {
  it('asks the store on every call, so a scope it starts sharing later reads at once', async () => {
    const { storage, call, sharing } = await setup();
    expect((await call('knowledge_search', { query: 'Spec' })).results).toEqual([]);
    // An importer added after the project started: declared on the store first, then written.
    sharing.mockResolvedValue([...SHARED, 'notion:$account:$connection']);
    const { scope } = await storage.materializeScope({
      address: 'notion:acme:conn_2',
      declaration: 'notion:$account:$connection',
      name: 'Notion (acme)',
      provenance: host,
    });
    await storage.createPage({ parentId: scope.id, key: 'spec', name: 'Spec', provenance: host });
    expect((await call('knowledge_search', { query: 'Spec' })).results.map((r: any) => r.page.ref)).toEqual([
      'notion:acme:conn_2#spec',
    ]);
    expect((await call('knowledge_list', {})).entries.map((entry: any) => entry.ref)).toContain('notion:acme:conn_2');
  });

  it('stops stored shared scopes failing the declaration check', async () => {
    const { knowledge } = await setup();
    await expect(knowledge.readScopeFor(['docs:eng'])).resolves.toMatchObject({
      addresses: ['docs:eng', 'handbook:main'],
    });
    const unshared = await setup([]);
    await expect(unshared.knowledge.readScopeFor(['docs:eng'])).rejects.toThrow(KnowledgeDeclarationError);
  });

  it('lists shared root scopes after the held ones at the root', async () => {
    const { call } = await setup();
    await call('knowledge_page', { op: 'write', scope: 'docs:eng', name: 'Plan', body: 'x' });
    expect((await call('knowledge_list', {})).entries.map((entry: any) => entry.ref)).toEqual([
      'docs:eng',
      'linear:acme:conn_1',
    ]);
    expect((await call('knowledge_read', {})).scopes.map((scope: any) => scope.address)).toEqual([
      'docs:eng',
      'linear:acme:conn_1',
    ]);
  });

  it('finds shared pages and reads them back by the ref search gives, and their scope by address', async () => {
    const { call } = await setup();
    const [hit] = (await call('knowledge_search', { query: 'Roadmap' })).results;
    expect(hit.page.ref).toBe('linear:acme:conn_1#roadmap');
    expect((await call('knowledge_read', { page: hit.page.ref })).page.name).toBe('Roadmap');
    expect((await call('knowledge_read', { page: 'linear:acme:conn_1' })).page.name).toBe('Linear (acme)');
    expect((await call('knowledge_read', { page: 'linear:acme:conn_1/archive' })).page.name).toBe('Archive');
    const narrowed = await call('knowledge_search', { query: 'Roadmap', scope: ['linear:acme:conn_1'] });
    expect(narrowed.results.map((result: any) => result.page.name)).toEqual(['Roadmap']);
    const { entries } = await call('knowledge_list', { from: 'linear:acme:conn_1' });
    expect(entries.map((entry: any) => entry.ref)).toEqual(
      expect.arrayContaining(['linear:acme:conn_1/archive', 'linear:acme:conn_1#roadmap']),
    );
  });

  it('shares reading only: writing there still takes a declared role', async () => {
    const { call } = await setup();
    await expect(
      call('knowledge_page', { op: 'write', scope: 'linear:acme:conn_1', name: 'Sneaky', body: 'x' }),
    ).rejects.toThrow(/declared scope type/);
    await expect(call('knowledge_page', { op: 'write', page: 'Roadmap', body: 'Changed' })).rejects.toThrow();
  });

  it('reads every scope of a pattern key, a concrete key, and template children of a child key', () => {
    expect(knowledgeSharedReadScope([...SHARED, 'not a key', 'linear:$account:$connection'])).toEqual({
      addresses: ['handbook:main'],
      prefixes: [
        { declaration: 'linear:$account:$connection', prefix: 'linear:' },
        { declaration: 'linear:$account:$connection/archive', prefix: 'linear:' },
      ],
    });
  });
});
