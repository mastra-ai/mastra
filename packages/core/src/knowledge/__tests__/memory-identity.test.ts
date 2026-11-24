import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { agentRunContext } from './agent-run-context';

// An Agent's `resource:`/`thread:` scopes are raw Memory ids (`resource:slack:U123` is user
// `slack:U123`). Knowledge binds the resolved ids encoded and takes identity from nowhere else.
function asAgent(storage: InMemoryStore, scopes: string[]) {
  const knowledge = new Knowledge({ id: 'kb', storage, tools: true, scopes: knowledgeMemoryScopes() });
  const tools = knowledge.createTools();
  const context = agentRunContext('a', scopes);
  return (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
}

describe('Knowledge Memory identity from Agent scopes', () => {
  it('binds a raw colon id encoded', async () => {
    const call = asAgent(new InMemoryStore(), ['resource:slack:U123']);
    const written = await call('knowledge_page', { op: 'write', scope: 'resource:slack%3AU123', name: 'Mine' });
    expect(written.page.id).toBeDefined();
  });

  it("doesn't let a literal-percent id read the colon id's pages", async () => {
    const storage = new InMemoryStore();
    const secret = await asAgent(storage, ['resource:slack:U123'])('knowledge_page', {
      op: 'write',
      scope: 'resource:slack%3AU123',
      name: 'Secret',
      body: 'COLON_ID_SECRET',
    });

    // User `slack%3AU123` (a literal percent) lives at resource:slack%253AU123.
    const read = await asAgent(storage, ['resource:slack%3AU123'])('knowledge_read', { page: secret.page.id }).catch(
      e => e,
    );
    expect(JSON.stringify(read?.message ?? read)).not.toContain('COLON_ID_SECRET');
  });

  it('ignores resource:/thread: strings written into the run scopes directly', async () => {
    // Core strips identity scopes before marking a run's scopes, so this only happens when code
    // marks them itself. They still mustn't act as a second, canonical identity.
    const storage = new InMemoryStore();
    const secret = await asAgent(storage, ['resource:slack:U123'])('knowledge_page', {
      op: 'write',
      scope: 'resource:slack%3AU123',
      name: 'Secret',
      body: 'COLON_ID_SECRET',
    });
    const knowledge = new Knowledge({ id: 'kb', storage, tools: true, scopes: knowledgeMemoryScopes() });
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, ['resource:slack%3AU123']);
    const read = await knowledge.createTools().knowledge_read!.execute!(
      { page: secret.page.id } as never,
      {
        requestContext,
        agent: { agentId: 'a', resourceId: 'slack%3AU123' },
      } as never,
    ).catch(e => e);
    expect(JSON.stringify((read as any)?.message ?? read)).not.toContain('COLON_ID_SECRET');
  });
});
