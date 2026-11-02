import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: true,
    scopes: {
      ...memory,
      'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'editor' }] },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  return { call };
}

describe('writing a scope page', () => {
  it('refuses a name or description change by address, id and name, and leaves the page unchanged', async () => {
    const { call } = setup();
    const { page: scope } = await call('knowledge_read', { page: 'org:acme' });
    for (const page of ['org:acme', scope.id, scope.name]) {
      for (const change of [{ name: 'Renamed' }, { description: 'Replaced' }, { name: 'Renamed', body: 'b' }]) {
        await expect(call('knowledge_page', { op: 'write', page, ...change })).rejects.toThrow(
          `"${page}" is a scope page; its name and description come from config, so only its body can be written.`,
        );
      }
    }
    const { page: after } = await call('knowledge_read', { page: scope.id });
    expect(after.name).toBe(scope.name);
    expect(after.description).toBe(scope.description);
    expect(after.version).toBe(scope.version);
  });

  it('still writes the body', async () => {
    const { call } = setup();
    const { page } = await call('knowledge_page', { op: 'write', page: 'org:acme', body: 'How Acme works.' });
    expect((await call('knowledge_read', { page: page.id })).page.body).toBe('How Acme works.');
  });

  it('treats a null name or description as no change', async () => {
    const { call } = setup();
    const { page: scope } = await call('knowledge_read', { page: 'org:acme' });
    await call('knowledge_page', { op: 'write', page: 'org:acme', name: null, description: null, body: 'b' });
    const { page: after } = await call('knowledge_read', { page: scope.id });
    expect(after.name).toBe(scope.name);
    expect(after.description).toBe(scope.description);
  });

  it('leaves other pages renameable', async () => {
    const { call } = setup();
    const { page } = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Refunds', body: 'x' });
    const { page: renamed } = await call('knowledge_page', {
      op: 'write',
      page: page.id,
      name: 'Refund policy',
      description: 'When we refund.',
    });
    expect(renamed.name).toBe('Refund policy');
    expect(renamed.description).toBe('When we refund.');
  });
});
