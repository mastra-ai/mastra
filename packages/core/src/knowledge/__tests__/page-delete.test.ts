import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup(role: 'owner' | 'editor' = 'owner', storage = new InMemoryStore()) {
  const knowledge = new Knowledge({
    storage,
    tools: true,
    scopes: {
      ...memory,
      'org:$orgId': {
        ...memory['org:$orgId'],
        access: [{ principal: 'self', role }],
        pages: [{ key: 'policies', name: 'Policies' }],
      },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  const create = async (name: string, extra: Record<string, unknown> = {}) =>
    (await call('knowledge_page', { op: 'write', scope: 'org:acme', name, body: `${name} body`, ...extra })).page;
  return { storage, call, create };
}

describe('Knowledge page deletion', () => {
  it('lets an owner delete a leaf page by id, key path and name; it is then gone from reads and search', async () => {
    const { call, create } = setup();
    const byId = await create('Old refunds');
    const byKey = await create('Old shipping', { key: 'shipping' });
    const byName = await create('Old returns');
    for (const page of [byId.id, 'org:acme#shipping', 'Old returns']) {
      const { page: deleted } = await call('knowledge_page', { op: 'delete', page });
      expect(deleted.id).toBe(page === byId.id ? byId.id : page === 'org:acme#shipping' ? byKey.id : byName.id);
    }
    for (const page of [byId.id, byKey.id, byName.id]) {
      await expect(call('knowledge_read', { page })).rejects.toThrow(/not found/);
    }
    const { results } = await call('knowledge_search', { query: 'Old' });
    expect(results).toEqual([]);
  });

  it('refuses an editor', async () => {
    const storage = new InMemoryStore();
    const page = await setup('owner', storage).create('Keep me');
    const { call } = setup('editor', storage);
    await expect(call('knowledge_page', { op: 'delete', page: page.id })).rejects.toThrow(
      /Deleting a page needs owner on "org:acme"/,
    );
    expect((await call('knowledge_read', { page: page.id })).page.id).toBe(page.id);
  });

  it('refuses a page with child pages, a page declared in config and a scope page', async () => {
    const { call, create } = setup();
    const parent = await create('Parent', { key: 'parent' });
    await create('Child', { parent: parent.id });
    for (const page of [parent.id, 'org:acme#parent', 'Parent']) {
      await expect(call('knowledge_page', { op: 'delete', page })).rejects.toThrow(
        '"Parent" has child pages; move or delete them first.',
      );
    }
    for (const page of ['org:acme#policies', 'Policies']) {
      await expect(call('knowledge_page', { op: 'delete', page })).rejects.toThrow(
        `"org:acme#policies" is declared in config; change the scope's pages to remove it.`,
      );
    }
    await expect(call('knowledge_page', { op: 'delete', page: 'org:acme' })).rejects.toThrow(
      /is a scope page; scope pages can't be moved, merged or deleted/,
    );
    expect((await call('knowledge_read', { page: 'org:acme#parent' })).page.id).toBe(parent.id);
  });
});
