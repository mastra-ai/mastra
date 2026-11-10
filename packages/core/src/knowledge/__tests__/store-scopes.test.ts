import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { KnowledgeDeclarationError, knowledgeMemoryScopes } from '../declarations';
import type { KnowledgeScopeDeclarations } from '../declarations';
import { Knowledge } from '../index';

const host = { author: 'host' };
const imports = [{ principal: 'imports:all', role: 'viewer' as const }];
/** What a hosted store's Linear importer declares: runs holding `imports:all` read its scopes. */
const LINEAR: KnowledgeScopeDeclarations = {
  'imports:$name': {},
  'linear:$account:$connection': {
    displayLabel: 'Linear',
    access: imports,
    children: [{ name: 'archive', access: imports }],
  },
};

/** A store that declares Linear scopes it imported, next to a project's own `docs` scopes. */
async function setup(
  stored: KnowledgeScopeDeclarations = LINEAR,
  config: KnowledgeScopeDeclarations = {},
  held: string[] = ['docs:eng', 'imports:all'],
) {
  const store = new InMemoryStore();
  const knowledge = new Knowledge({
    storage: store,
    tools: true,
    scopes: { ...knowledgeMemoryScopes(), 'docs:$team': { access: [{ principal: 'self', role: 'owner' }] }, ...config },
  });
  const storage = await knowledge.getStorage();
  const declaring = vi.spyOn(storage, 'getScopeDeclarations').mockResolvedValue(stored);
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
    setRunAgentScopes(requestContext, held);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, storage, call, declaring };
}

const names = (result: any) => result.results.map((hit: any) => hit.page.name);

describe('Knowledge scope declarations a store supplies', () => {
  it("gives a run holding a rule's principal its role: search, read by ref and address, narrow and list", async () => {
    const { call } = await setup();
    const [hit] = (await call('knowledge_search', { query: 'Roadmap' })).results;
    expect(hit.page.ref).toBe('linear:acme:conn_1#roadmap');
    expect((await call('knowledge_read', { page: hit.page.ref })).page.name).toBe('Roadmap');
    expect((await call('knowledge_read', { page: 'linear:acme:conn_1' })).page.name).toBe('Linear (acme)');
    expect((await call('knowledge_read', { page: 'linear:acme:conn_1/archive' })).page.name).toBe('Archive');
    expect(names(await call('knowledge_search', { query: 'Roadmap', scope: ['linear:acme:conn_1'] }))).toEqual([
      'Roadmap',
    ]);
    const { entries } = await call('knowledge_list', { from: 'linear:acme:conn_1' });
    expect(entries.map((entry: any) => entry.ref)).toEqual(
      expect.arrayContaining(['linear:acme:conn_1/archive', 'linear:acme:conn_1#roadmap']),
    );
  });

  it("gives a run that doesn't hold the principal nothing, and lists only held scopes at the root", async () => {
    const { call } = await setup(LINEAR, {}, ['docs:eng']);
    await call('knowledge_page', { op: 'write', scope: 'docs:eng', name: 'Plan', body: 'x' });
    expect((await call('knowledge_search', { query: 'Roadmap' })).results).toEqual([]);
    expect((await call('knowledge_list', {})).entries.map((entry: any) => entry.ref)).toEqual(['docs:eng']);
    expect((await call('knowledge_read', {})).scopes.map((scope: any) => scope.address)).toEqual(['docs:eng']);
  });

  it('reads the store on every call, so a declaration it adds later applies on the next', async () => {
    const { storage, call, declaring } = await setup();
    expect((await call('knowledge_search', { query: 'Spec' })).results).toEqual([]);
    // An importer added after the project started: declared on the store, then written.
    declaring.mockResolvedValue({ ...LINEAR, 'notion:$account:$connection': { access: imports } });
    const { scope } = await storage.materializeScope({
      address: 'notion:acme:conn_2',
      declaration: 'notion:$account:$connection',
      name: 'Notion (acme)',
      provenance: host,
    });
    await storage.createPage({ parentId: scope.id, key: 'spec', name: 'Spec', provenance: host });
    expect((await call('knowledge_search', { query: 'Spec' })).results.map((hit: any) => hit.page.ref)).toEqual([
      'notion:acme:conn_2#spec',
    ]);
  });

  it('keeps a store declaration whose rule names a type the store declares after it', async () => {
    const { knowledge, call } = await setup({
      'linear:$account:$connection': {
        access: [{ principal: 'crew:$account', role: 'viewer' }, ...imports],
        children: [{ name: 'archive', access: imports }],
      },
      'crew:$account': {},
      'imports:$name': {},
    });
    const warn = vi.spyOn((knowledge as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn');
    expect(names(await call('knowledge_search', { query: 'Roadmap' }))).toEqual(['Roadmap']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps store declarations that only compile together, next to one that never does', async () => {
    const { knowledge, call } = await setup({
      'linear:$account:$connection': {
        access: [{ principal: 'crew:$account', role: 'viewer' }, ...imports],
        children: [{ name: 'archive', access: imports }],
      },
      'crew:$account': { access: [{ principal: 'team:$account', role: 'viewer' }] },
      'team:$account': { access: [{ principal: 'crew:$account', role: 'viewer' }] },
      'ticket:$id': { access: [{ principal: 'nowhere:$id', role: 'viewer' }] },
      'imports:$name': {},
    });
    const warn = vi.spyOn((knowledge as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn');
    expect(names(await call('knowledge_search', { query: 'Roadmap' }))).toEqual(['Roadmap']);
    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('"ticket:$id"'));
  });

  it('keeps a pair of store declarations that name each other', async () => {
    const { knowledge } = await setup({
      ...LINEAR,
      'crew:$account': { access: [{ principal: 'team:$account', role: 'viewer' }] },
      'team:$account': { access: [{ principal: 'crew:$account', role: 'viewer' }] },
    });
    const warn = vi.spyOn((knowledge as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn');
    await expect(knowledge.readScopeFor(['crew:acme', 'team:acme'])).resolves.toMatchObject({
      addresses: expect.arrayContaining(['crew:acme', 'team:acme']),
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes the declaration check for stored scopes the store declares, and only those', async () => {
    await expect((await setup()).knowledge.readScopeFor(['docs:eng', 'imports:all'])).resolves.toMatchObject({
      addresses: ['docs:eng'],
      prefixes: [
        { declaration: 'linear:$account:$connection', prefix: 'linear:' },
        { declaration: 'linear:$account:$connection/archive', prefix: 'linear:' },
      ],
    });
    await expect((await setup({})).knowledge.readScopeFor(['docs:eng'])).rejects.toThrow(KnowledgeDeclarationError);
  });

  it('reads nothing a store declaration gives no rule, and writes only with the role a rule gives', async () => {
    const closed = await setup({
      'imports:$name': {},
      'linear:$account:$connection': { children: [{ name: 'archive' }] },
    });
    expect((await closed.call('knowledge_search', { query: 'Roadmap' })).results).toEqual([]);

    const viewer = await setup();
    await expect(viewer.call('knowledge_page', { op: 'write', page: 'Roadmap', body: 'Changed' })).rejects.toThrow(
      /needs editor on "linear:acme:conn_1"; this run has viewer/,
    );

    const editor = await setup({
      'imports:$name': {},
      'linear:$account:$connection': {
        access: [{ principal: 'imports:all', role: 'editor' }],
        children: [{ name: 'archive' }],
      },
    });
    await editor.call('knowledge_page', { op: 'write', page: 'Roadmap', body: 'Changed' });
    expect((await editor.call('knowledge_read', { page: 'linear:acme:conn_1#roadmap' })).page.body).toBe('Changed');
  });

  it("keeps the config's declaration of a key both declare", async () => {
    const { call } = await setup(LINEAR, { 'linear:$account:$connection': { children: [{ name: 'archive' }] } });
    expect((await call('knowledge_search', { query: 'Roadmap' })).results).toEqual([]);
  });

  it("skips a store declaration that doesn't compile, with a warning, and keeps the rest", async () => {
    const { knowledge, call } = await setup({
      ...LINEAR,
      'ticket:$id': { access: [{ principal: 'team:$id', role: 'viewer' }] },
    });
    const warn = vi.spyOn((knowledge as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn');
    expect(names(await call('knowledge_search', { query: 'Roadmap' }))).toEqual(['Roadmap']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"ticket:$id"'));
  });

  it('explains a grant and lists it in scope grants', async () => {
    const { knowledge } = await setup();
    const explained = await knowledge.explainAccess(['docs:eng', 'imports:all'], {
      page: 'linear:acme:conn_1#roadmap',
    });
    expect(explained).toMatchObject({
      role: 'viewer',
      reasons: [{ principal: 'imports:all', role: 'viewer', rule: 'linear:$account:$connection', via: 'rule' }],
    });
    expect(knowledge.scopeGrants({ address: 'linear:acme:conn_1' })).toEqual([
      { principal: 'imports:all', role: 'viewer' },
    ]);
  });
});
