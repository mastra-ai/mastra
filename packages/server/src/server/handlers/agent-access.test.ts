import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { listAgentsVisibleTo } from './agent-access';

function caller(id: string, permissions: string[] = ['*:read', '*:execute']) {
  const ctx = new RequestContext();
  ctx.set(MASTRA_USER_KEY, { id });
  ctx.set(MASTRA_RESOURCE_ID_KEY, id);
  ctx.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  return ctx;
}

const storedAgent = (id: string, record: Record<string, unknown>) =>
  new Agent({ id, name: id, instructions: 'x', model: 'openai/gpt-4o-mini', rawConfig: { id, ...record } } as any);

/**
 * Hydrated stored agents are registered on Mastra next to code agents (source 'stored'), the same way MastraEditor
 * registers them. Handlers that iterate `mastra.listAgents()` must not surface the private ones to other users.
 */
describe('listAgentsVisibleTo', () => {
  const mastra = new Mastra({
    logger: false,
    agents: { code: new Agent({ id: 'code', name: 'code', instructions: 'x', model: 'openai/gpt-4o-mini' }) },
  });
  mastra.addAgent(storedAgent('private', { authorId: 'alice', visibility: 'private' }), 'private', {
    source: 'stored',
  });
  mastra.addAgent(storedAgent('public', { authorId: 'alice', visibility: 'public' }), 'public', { source: 'stored' });
  mastra.addAgent(storedAgent('legacy', {}), 'legacy', { source: 'stored' });
  const visible = (ctx: RequestContext) => Object.keys(listAgentsVisibleTo(mastra.listAgents(), ctx)).sort();

  it("hides another user's private stored agent", () => {
    expect(visible(caller('bob'))).toEqual(['code', 'legacy', 'public']);
  });

  it('keeps it for the owner, admins and scoped read grants', () => {
    expect(visible(caller('alice'))).toContain('private');
    expect(visible(caller('admin', ['*']))).toContain('private');
    expect(visible(caller('grantee', ['*:read', 'stored-agents:read:private']))).toContain('private');
  });

  it('is unrestricted without auth', () => {
    expect(visible(new RequestContext())).toEqual(['code', 'legacy', 'private', 'public']);
  });

  // A caller (e.g. an in-process MCP tool) that forgets the request context must not be treated as "no auth".
  it('fails closed when the caller passes no request context', () => {
    expect(() => visible(undefined as unknown as RequestContext)).toThrow();
  });
});
