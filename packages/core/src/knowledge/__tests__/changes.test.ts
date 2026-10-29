import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { ConsoleLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { KnowledgeChangeEvent } from '../changes';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({
    id: 'kb',
    storage,
    tools: true,
    pinnedContext: true,
    scopes: {
      ...memory,
      'org:$orgId': {
        ...memory['org:$orgId'],
        displayLabel: 'Organization',
        access: [{ principal: 'self', role: 'owner' }],
        children: [{ name: 'internal', displayLabel: 'Internal', description: 'Staff only.' }],
      },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  const events: KnowledgeChangeEvent[] = [];
  const unsubscribe = knowledge.onChange(event => events.push(event));
  const summary = () => events.map(({ kind, op }) => `${kind}:${op}`);
  return { storage, knowledge, call, events, summary, unsubscribe };
}

describe('Knowledge change events', () => {
  it('reports every committed tool write, after it commits, with ids only', async () => {
    const { call, events, summary } = setup();
    const created = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Billing' });
    expect(summary()).toContain('scope:create');
    expect(events.at(-1)).toMatchObject({
      knowledgeId: 'kb',
      kind: 'page',
      op: 'create',
      pageId: created.page.id,
      scopeId: events.find(event => event.kind === 'scope')!.pageId,
    });
    expect(events.at(-1)!.at).toBeInstanceOf(Date);

    events.length = 0;
    await call('knowledge_page', { op: 'write', page: created.page.id, body: 'Invoices go out monthly.' });
    const note = await call('knowledge_note', { op: 'add', page: 'Billing', scope: ['org:acme'], text: 'Net 30.' });
    await call('knowledge_pin', { op: 'pin', page: created.page.id, audience: ['org:acme'] });
    await call('knowledge_pin', { op: 'unpin', page: created.page.id, audience: ['org:acme'] });
    await call('knowledge_note', { op: 'remove', note: note.note.id });
    const target = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Finance' });
    await call('knowledge_page', { op: 'merge', page: created.page.id, into: target.page.id });
    expect(summary()).toEqual([
      'page:update',
      'note:add',
      'pin:add',
      'pin:remove',
      'note:remove',
      'page:create',
      'page:merge',
    ]);
    expect(events[1]).toMatchObject({ kind: 'note', pageId: created.page.id, noteId: note.note.id });
    expect(events.at(-1)).toMatchObject({ pageId: target.page.id, sourceId: created.page.id });
  });

  it('reports host writes through getStorage(), but not a scope that already existed', async () => {
    const { knowledge, call, summary, events } = setup();
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Billing' });
    events.length = 0;
    await call('knowledge_search', { query: 'billing' });
    expect(events).toEqual([]);
    const store = await knowledge.getStorage();
    const scope = (await store.getScopesByAddress(['org:acme']))[0]!;
    await store.createPage({ scopeId: scope.id, parentId: scope.id, name: 'Host page', createdBy: 'host' } as never);
    expect(summary()).toEqual(['page:create']);
  });

  it('stops after unsubscribe, and a throwing listener neither fails the write nor stops others', async () => {
    const { knowledge, call, events, unsubscribe } = setup();
    const error = vi.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(() => {});
    knowledge.onChange(() => {
      throw new Error('listener broke');
    });
    await expect(call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Billing' })).resolves.toBeTruthy();
    expect(events.length).toBeGreaterThan(0);
    expect(error).toHaveBeenCalled();
    unsubscribe();
    events.length = 0;
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Other' });
    expect(events).toEqual([]);
    error.mockRestore();
  });

  it('does not see writes on a store obtained outside the Knowledge instance', async () => {
    const { storage, call, events } = setup();
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Billing' });
    events.length = 0;
    const raw = (await storage.getStore('knowledge'))!;
    const scope = (await raw.getScopesByAddress(['org:acme']))[0]!;
    await raw.createPage({ scopeId: scope.id, parentId: scope.id, name: 'Direct', createdBy: 'host' } as never);
    expect(events).toEqual([]);
  });
});

describe('Knowledge scopeDeclaration', () => {
  it('returns display fields for declarations and template children, without access rules', () => {
    const { knowledge } = setup();
    const org = knowledge.scopeDeclaration('org:$orgId');
    expect(org).toMatchObject({
      key: 'org:$orgId',
      displayLabel: 'Organization',
      children: [
        { key: 'org:$orgId/internal', name: 'internal', displayLabel: 'Internal', description: 'Staff only.' },
      ],
    });
    expect(org).not.toHaveProperty('access');
    expect(knowledge.scopeDeclaration('org:$orgId/internal')).toMatchObject({
      key: 'org:$orgId/internal',
      displayLabel: 'Internal',
      children: [],
    });
    expect(knowledge.scopeDeclaration('team:$teamId')).toBeUndefined();
  });
});
