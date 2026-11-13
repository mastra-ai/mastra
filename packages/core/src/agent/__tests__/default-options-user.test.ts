import { describe, expect, it } from 'vitest';
import { MASTRA_NORMALIZED_USER_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';

function contextWithUser(role: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_NORMALIZED_USER_KEY, { id: 'user-1', role });
  return requestContext;
}

describe('agent option callbacks receive the authenticated user', () => {
  const agent = new Agent({
    id: 'default-options-user',
    name: 'Default Options User',
    instructions: 'You are a test agent',
    model: 'openai/gpt-4o-mini',
    defaultOptions: ({ user }) => ({ maxSteps: user?.role === 'admin' ? 10 : 2 }),
    defaultNetworkOptions: ({ user }) => ({ maxSteps: user?.role === 'admin' ? 20 : 4 }),
    scopes: ({ scopes, user }) => (user ? [...scopes, `org:${user.role}`] : scopes),
  });

  it('passes user to defaultOptions', async () => {
    expect((await agent.getDefaultOptions({ requestContext: contextWithUser('admin') })).maxSteps).toBe(10);
    expect((await agent.getDefaultOptions({ requestContext: new RequestContext() })).maxSteps).toBe(2);
  });

  it('passes user to defaultNetworkOptions', async () => {
    expect((await agent.getDefaultNetworkOptions({ requestContext: contextWithUser('admin') })).maxSteps).toBe(20);
    expect((await agent.getDefaultNetworkOptions({ requestContext: new RequestContext() })).maxSteps).toBe(4);
  });

  it('passes user to the scopes function', async () => {
    const scopes = ['resource:user-1'];
    expect(await agent.getScopes({ requestContext: contextWithUser('admin'), scopes })).toEqual([
      'resource:user-1',
      'org:admin',
    ]);
    expect(await agent.getScopes({ requestContext: new RequestContext(), scopes })).toEqual(['resource:user-1']);
  });
});
