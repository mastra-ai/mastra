import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

// A run's held scopes have no pages until something writes there. The model still has to see them, or
// it concludes on its first turn that it has nowhere to read or write.
function setup() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: true,
    scopes: {
      ...knowledgeMemoryScopes(),
      // An identity with no role anywhere: held, but nothing to do there.
      'agent:$agentId': { access: [] },
      'docs:$orgId': { belongsTo: 'org:$orgId', access: [{ principal: 'org:$orgId', role: 'viewer' }] },
    },
  });
  const tools = knowledge.createTools();
  const call = (tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, ['org:acme', 'agent:support', 'docs:acme']);
    return tools[tool]!.execute!(
      input as never,
      { requestContext, agent: { agentId: 'support', resourceId: 'user-abhi', threadId: 't-abhi-1' } } as never,
    ) as Promise<any>;
  };
  return { knowledge, call };
}

describe('Knowledge held scopes before any page exists', () => {
  it('knowledge_read lists every held scope with its role and what the run can do there', async () => {
    const { call } = setup();
    const { scopes } = await call('knowledge_read', {});
    expect(scopes).toEqual([
      { address: 'org:acme', name: 'org:acme', role: 'editor', can: 'write', empty: true },
      { address: 'agent:support', name: 'agent:support', can: 'none', empty: true },
      { address: 'docs:acme', name: 'docs:acme', role: 'viewer', can: 'read', empty: true },
      { address: 'resource:user-abhi', name: 'resource:user-abhi', role: 'owner', can: 'write', empty: true },
      { address: 'thread:t-abhi-1', name: 'thread:t-abhi-1', role: 'owner', can: 'write', empty: true },
    ]);
  });

  it('a held scope that exists but the run cannot read shows only its address', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'agent:support', path: 'secret', name: 'Secret', body: 'hidden' });
    const store = await knowledge.getStorage();
    const [stored] = await store.getScopesByAddress(['agent:support']);
    expect(stored).toBeDefined();
    const { scopes } = await call('knowledge_read', {});
    expect(scopes.find((scope: any) => scope.address === 'agent:support')).toEqual({
      address: 'agent:support',
      name: 'agent:support',
      can: 'none',
      empty: true,
    });
    const listed = await call('knowledge_list', {});
    expect(listed.entries.find((entry: any) => entry.ref === 'agent:support')).toEqual({
      ref: 'agent:support',
      name: 'agent:support',
      depth: 1,
      children: 0,
      scope: true,
      can: 'none',
      empty: true,
    });
  });

  it('knowledge_list lists them too, and a written scope then shows its name and pages', async () => {
    const { call } = setup();
    const before = await call('knowledge_list', {});
    expect(before.entries.map((entry: any) => [entry.ref, entry.can, entry.empty])).toEqual([
      ['org:acme', 'write', true],
      ['agent:support', 'none', true],
      ['docs:acme', 'read', true],
      ['resource:user-abhi', 'write', true],
      ['thread:t-abhi-1', 'write', true],
    ]);

    await call('knowledge_page', { op: 'write', name: 'Plan', scope: 'thread:t-abhi-1', body: 'Ship it.' });
    const { scopes } = await call('knowledge_read', {});
    const thread = scopes.find((scope: any) => scope.address === 'thread:t-abhi-1');
    expect(thread).toMatchObject({ role: 'owner', can: 'write' });
    expect(thread.empty).toBeUndefined();
    expect(thread.name).toEqual(expect.any(String));
    const after = await call('knowledge_list', {});
    expect(after.entries.find((entry: any) => entry.ref === 'thread:t-abhi-1')).toMatchObject({
      children: 1,
      scope: true,
      can: 'write',
    });
  });
});
