import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { MastraAuthProvider } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';

import { MASTRA_NORMALIZED_USER_KEY } from '../constants';
import { coreAuthMiddleware } from './helpers';

/**
 * End-to-end handshake: the auth middleware (packages/server) writes the
 * normalized user to the request context, and dynamic agent configuration
 * callbacks (packages/core) read it back as the `user` argument.
 */
describe('normalized user reaches DynamicArgument callbacks', () => {
  class FakeAuth extends MastraAuthProvider<{ sub: string; name: string; role?: string }> {
    constructor() {
      super({ name: 'fake' });
    }
    async authenticateToken() {
      return { sub: 'user-42', name: 'Ada Lovelace', role: 'admin' };
    }
    authorizeUser() {
      return true;
    }
  }

  function personalizedAgent() {
    return new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: ({ user }) =>
        user
          ? `You are helping ${user.name ?? user.id} (role: ${user.role ?? 'none'}).`
          : 'You are a helpful assistant.',
      model: 'openai/gpt-4o',
    });
  }

  it('personalizes instructions for an authenticated request', async () => {
    const requestContext = new RequestContext();

    const result = await coreAuthMiddleware({
      path: '/api/agents',
      method: 'GET',
      getHeader: () => undefined,
      rawRequest: new Request('http://localhost/api/agents'),
      token: 'valid-token',
      buildAuthorizeContext: () => null,
      mastra: { getServer: () => ({}), getLogger: () => null } as any,
      authConfig: new FakeAuth() as any,
      requestContext: requestContext as any,
    } as any);

    expect(result.action).toBe('next');
    expect(requestContext.get(MASTRA_NORMALIZED_USER_KEY)).toEqual({
      id: 'user-42',
      name: 'Ada Lovelace',
      role: 'admin',
    });

    const instructions = await personalizedAgent().getInstructions({ requestContext });
    expect(instructions).toBe('You are helping Ada Lovelace (role: admin).');
  });

  it('passes user: undefined when the request context has no authenticated user', async () => {
    const instructions = await personalizedAgent().getInstructions({ requestContext: new RequestContext() });
    expect(instructions).toBe('You are a helpful assistant.');
  });
});
