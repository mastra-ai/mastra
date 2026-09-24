import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSSOLoginRequest } from './sso-login';

describe('makeSSOLoginRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: 'https://sso.example.com/login' })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('builds the login URL on the client apiPrefix and carries the redirect', async () => {
    await makeSSOLoginRequest(
      { options: { baseUrl: 'http://localhost:4000', apiPrefix: 'mastra/' } },
      { redirectUri: 'http://localhost:4111/agents' },
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:4000/mastra/auth/sso/login?redirect_uri=http%3A%2F%2Flocalhost%3A4111%2Fagents',
    );
  });

  it('defaults to /api when the client has no apiPrefix', async () => {
    await makeSSOLoginRequest({ options: { baseUrl: 'http://localhost:4000' } }, {});

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/auth/sso/login');
  });

  it('forwards the client headers but keeps a JSON Content-Type', async () => {
    await makeSSOLoginRequest(
      {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: { 'x-tenant-id': 'tenant-123', 'Content-Type': 'text/plain' },
        },
      },
      {},
    );

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'x-tenant-id': 'tenant-123',
      'Content-Type': 'application/json',
    });
  });

  it('rejects when the server refuses the login', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(makeSSOLoginRequest({ options: { baseUrl: 'http://localhost:4000' } }, {})).rejects.toThrow(
      'Failed to initiate SSO login: 500',
    );
  });
});
