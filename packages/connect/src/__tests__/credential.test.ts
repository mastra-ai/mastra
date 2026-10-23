import { describe, expect, it, vi } from 'vitest';

import { credential } from '../credential.js';

const TOKEN = 'fake-test-token';

function options(fetchMock: ReturnType<typeof vi.fn>) {
  return {
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  };
}

describe('credential', () => {
  it('fetches and returns the oauth2 credential union', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ type: 'oauth2', accessToken: 'fake-provider-token', expiresAt: '2026-10-01T00:00:00Z' }),
      );
    const result = await credential('c_1', options(fetchMock));
    expect(result).toEqual({ type: 'oauth2', accessToken: 'fake-provider-token', expiresAt: '2026-10-01T00:00:00Z' });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://example.test/v2/connections/c_1/credentials');
  });

  it('returns the api_key union', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ type: 'api_key', apiKey: 'fake-api-key' }));
    await expect(credential('c_1', options(fetchMock))).resolves.toEqual({ type: 'api_key', apiKey: 'fake-api-key' });
  });

  it('maps a 404 to connection_not_found', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'nope' }, { status: 404 }));
    await expect(credential('c_missing', options(fetchMock))).rejects.toMatchObject({
      code: 'connection_not_found',
      status: 404,
    });
  });
});
