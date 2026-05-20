/**
 * Unit tests for MCPOAuthClientProvider
 *
 */

import { describe, it, expect, vi } from 'vitest';

import type { OAuthClientProvider } from '../shared/oauth-types.js';
import { exchangeAuthorization, refreshAuthorization } from '../shared/oauth-types.js';
import { MCPOAuthClientProvider } from './oauth-provider.js';

const BASE_METADATA = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  response_types_supported: ['code'] as string[],
};

function makeProvider(opts?: { clientInformation?: { client_id: string; client_secret: string } }) {
  return new MCPOAuthClientProvider({
    redirectUrl: 'http://localhost:3000/callback',
    clientMetadata: {
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client',
    },
    clientInformation: opts?.clientInformation,
  });
}

function makeTokenMock() {
  const captured: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    captured.push({
      url: url.toString(),
      headers: Object.fromEntries(new Headers(init?.headers as HeadersInit).entries()),
      body: init?.body?.toString() ?? '',
    });
    return new Response(
      JSON.stringify({ access_token: 'new-token', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  return { fetchFn, captured };
}

function getAddClientAuthentication(provider: MCPOAuthClientProvider) {
  return (provider as OAuthClientProvider).addClientAuthentication;
}

describe('MCPOAuthClientProvider.addClientAuthentication', () => {
  it('is undefined so the SDK default credential path runs (issue #16854)', () => {
    const provider = makeProvider();
    expect(getAddClientAuthentication(provider)).toBeUndefined();
  });

  it('attaches client_id and client_secret via client_secret_post on token exchange', async () => {
    const { fetchFn, captured } = makeTokenMock();

    const provider = makeProvider({ clientInformation: { client_id: 'cid', client_secret: 'csec' } });

    await exchangeAuthorization('https://auth.example.com', {
      metadata: {
        ...BASE_METADATA,
        token_endpoint_auth_methods_supported: ['client_secret_post'],
      },
      clientInformation: { client_id: 'cid', client_secret: 'csec' },
      authorizationCode: 'code-123',
      codeVerifier: 'verifier-abc',
      redirectUri: 'http://localhost:3000/callback',
      addClientAuthentication: getAddClientAuthentication(provider),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(captured).toHaveLength(1);
    const body = new URLSearchParams(captured[0]!.body);
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('csec');
  });

  it('attaches credentials via Authorization: Basic on client_secret_basic token exchange', async () => {
    const { fetchFn, captured } = makeTokenMock();

    const provider = makeProvider({ clientInformation: { client_id: 'cid', client_secret: 'csec' } });

    await exchangeAuthorization('https://auth.example.com', {
      metadata: {
        ...BASE_METADATA,
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      },
      clientInformation: { client_id: 'cid', client_secret: 'csec' },
      authorizationCode: 'code-456',
      codeVerifier: 'verifier-def',
      redirectUri: 'http://localhost:3000/callback',
      addClientAuthentication: getAddClientAuthentication(provider),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]!.headers['authorization']).toMatch(/^Basic /);
    // body should NOT contain client_secret for Basic auth
    const body = new URLSearchParams(captured[0]!.body);
    expect(body.get('client_secret')).toBeNull();
  });

  it('attaches credentials on token refresh', async () => {
    const { fetchFn, captured } = makeTokenMock();

    const provider = makeProvider({ clientInformation: { client_id: 'cid', client_secret: 'csec' } });

    await refreshAuthorization('https://auth.example.com', {
      metadata: {
        ...BASE_METADATA,
        token_endpoint_auth_methods_supported: ['client_secret_post'],
      },
      clientInformation: { client_id: 'cid', client_secret: 'csec' },
      refreshToken: 'old-refresh-token',
      addClientAuthentication: getAddClientAuthentication(provider),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(captured).toHaveLength(1);
    const body = new URLSearchParams(captured[0]!.body);
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('csec');
    expect(body.get('grant_type')).toBe('refresh_token');
  });
});
