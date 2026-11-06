import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { mcpOAuthEndpoints, startMcpOAuth } from './oauth.js';
import { startTestAuthorizationServer, startTestMcpServer } from './test-utils.js';
import { createGuardedFetch } from './url-policy.js';
import type { GuardedFetch } from './url-policy.js';

const endpoints = mcpOAuthEndpoints('http://factory.test');

async function setup() {
  const { mcpServers: storage } = await createFactoryStorageForTests();
  const authorizationServer = await startTestAuthorizationServer();
  const mcp = await startTestMcpServer({ authorizationServer });
  authorizationServer.preregister({ clientId: 'factory-client', redirectUris: [endpoints.redirectUrl] });
  const record = await storage.create({
    orgId: 'org-a',
    userId: 'admin-a',
    input: { slug: 'orders', name: 'Orders', url: mcp.url, authType: 'oauth', oauth: { clientId: 'factory-client' } },
  });
  return { storage, authorizationServer, mcp, record };
}

describe('startMcpOAuth', () => {
  it('sends authorization-server discovery through the network guard', async () => {
    const ctx = await setup();
    // The MCP server is reachable; its authorization server is a plain-http loopback address.
    const guarded = createGuardedFetch({ allowPrivateNetwork: false });
    const fetch: GuardedFetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return url.host === ctx.mcp.host ? globalThis.fetch(input, init) : guarded(input, init);
    };

    const result = await startMcpOAuth({ ...ctx, endpoints, state: 'state-1', fetch, allowPrivateNetwork: false });

    expect(result).toEqual({
      status: 'error',
      error: `Requests to "${ctx.authorizationServer.host}" were blocked because they do not use https.`,
    });
    expect(ctx.authorizationServer.authorizeClientIds).toEqual([]);
  });

  it('never sends the browser to a plain-http sign-in page outside local development', async () => {
    const ctx = await setup();

    const result = await startMcpOAuth({
      ...ctx,
      endpoints,
      state: 'state-1',
      fetch: globalThis.fetch,
      allowPrivateNetwork: false,
    });

    expect(result).toEqual({
      status: 'error',
      error: 'The authorization server returned a sign-in address that does not use https.',
    });
  });
});
