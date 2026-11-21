import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({
    storage,
    tools: true,
    scopes: {
      ...memory,
      'org:$orgId': memory['org:$orgId'],
      'docs:$orgId': {
        belongsTo: 'org:$orgId',
        access: [{ principal: 'org:$orgId', role: 'owner' }],
        pages: [{ key: 'start', name: 'Start here', pages: [{ key: 'faq', name: 'FAQ' }] }],
      },
    },
  });
  const tools = knowledge.createTools();
  const call = (held: string[], tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, held);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, storage, call };
}

describe('Knowledge host scope removal', () => {
  it('removes a template page for good, but only from the host', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'notes', name: 'Notes' });

    await expect(knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start' })).rejects.toThrow(
      '"docs:acme#start" has child pages; remove them first.',
    );
    await expect(knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'notes' })).rejects.toThrow(
      '"docs:acme#notes" is not declared in config; use removePage.',
    );
    await expect(call(['org:acme'], 'knowledge_page', { op: 'delete', page: 'docs:acme#start/faq' })).rejects.toThrow(
      /declared in config/,
    );

    const faq = await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start/faq', author: 'setup' });
    expect(faq!.deletedAt).toBeInstanceOf(Date);
    await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start' });
    expect(await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start' })).toBeNull();

    // A run materializing the scope again doesn't bring them back.
    await call(['org:acme'], 'knowledge_list', { from: 'docs:acme' });
    await expect(call(['org:acme'], 'knowledge_read', { page: 'docs:acme#start' })).rejects.toThrow(/not found/);
  });

  it('leaves a scope removed when its declaration is renamed between the check and the restore', async () => {
    const { knowledge } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'notes', name: 'Notes' });
    await knowledge.removePage({ scope: 'docs:acme', path: 'notes' });
    for (const path of ['start/faq', 'start']) await knowledge.removeTemplatePage({ scope: 'docs:acme', path });
    const removed = await knowledge.removeScope({ scope: 'docs:acme' });

    // Another host renames the declaration after this restore read and checked the scope.
    const pages = await knowledge.getStorage();
    const restore = pages.restoreScope.bind(pages);
    pages.restoreScope = async input => {
      await pages.renameScopeDeclaration({ from: 'docs:$orgId', to: 'docs:$tenantId', check: () => {} });
      return restore(input);
    };
    await expect(knowledge.restoreScope({ id: removed!.id })).rejects.toThrow(
      expect.objectContaining({ name: 'KnowledgeConflictError' }),
    );

    const after = (await pages.getPage({ id: removed!.id, read: 'all' }))!;
    expect(after).toMatchObject({ declaration: 'docs:$tenantId' });
    expect(after.deletedAt).toBeInstanceOf(Date);
    const activity = await pages.listPageActivity({ scopeId: removed!.id, read: 'all' });
    expect(activity.events.map(event => event.action)).not.toContain('scope-restored');
  });

  it('removes an empty scope, refuses writes to it, and restores it with the same id', async () => {
    const { knowledge, storage, call } = setup();
    await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start/faq' }).catch(() => {});
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'notes', name: 'Notes' });
    await expect(knowledge.removeScope({ scope: 'docs:acme' })).rejects.toThrow(
      '"docs:acme" still has pages or child scopes; remove them first.',
    );
    await knowledge.removePage({ scope: 'docs:acme', path: 'notes' });
    await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start/faq' });
    await knowledge.removeTemplatePage({ scope: 'docs:acme', path: 'start' });

    const removed = await knowledge.removeScope({ scope: 'docs:acme', author: 'setup' });
    expect(removed).toMatchObject({ isScope: true, address: 'docs:acme' });
    expect(removed!.deletedAt).toBeInstanceOf(Date);
    expect(await knowledge.removeScope({ scope: 'docs:acme' })).toBeNull();

    const store = await storage.getStore('knowledge');
    expect(await store!.getScopesByAddress(['docs:acme'])).toEqual([]);
    await expect(knowledge.upsertPage({ scope: 'docs:acme', path: 'back', name: 'Back' })).rejects.toThrow(/removed/);
    await expect(
      call(['org:acme'], 'knowledge_page', { op: 'write', scope: 'docs:acme', name: 'Back' }),
    ).rejects.toThrow(/removed/);

    const restored = await knowledge.restoreScope({ id: removed!.id, author: 'setup' });
    expect(restored).toMatchObject({ id: removed!.id, address: 'docs:acme' });
    expect(restored.deletedAt).toBeUndefined();
    const written = await knowledge.upsertPage({ scope: 'docs:acme', path: 'back', name: 'Back' });
    expect(written.page.scopeId).toBe(removed!.id);
    await expect(call(['org:acme'], 'knowledge_read', { page: 'docs:acme#start' })).rejects.toThrow(/not found/);
  });

  it('refuses to restore a page that is not a removed scope, or a scope no declaration matches', async () => {
    const { knowledge } = setup();
    const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'notes', name: 'Notes' });
    await expect(knowledge.restoreScope({ id: page.id })).rejects.toThrow(/isn't a scope/);
    await expect(knowledge.restoreScope({ id: 'missing' })).rejects.toThrow(/not found/i);

    const storage = new InMemoryStore();
    const before = new Knowledge({ storage, scopes: { 'wiki:$name': { access: [] } } });
    await before.upsertPage({ scope: 'wiki:a', path: 'x', name: 'X' });
    await before.removePage({ scope: 'wiki:a', path: 'x' });
    const scope = (await before.removeScope({ scope: 'wiki:a' }))!;
    const after = new Knowledge({ storage, scopes: { 'docs:$orgId': { access: [] } } });
    await expect(after.restoreScope({ id: scope.id })).rejects.toThrow(/does not match a declared scope type/);
  });
});
