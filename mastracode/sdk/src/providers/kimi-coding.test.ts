import { describe, expect, it, vi } from 'vitest';
import { buildKimiCodingOAuthFetch, KIMI_CODING_MODELS } from './kimi-coding.js';

describe('Kimi For Coding model provider', () => {
  it('publishes the subscription catalog', () => {
    expect(KIMI_CODING_MODELS).toEqual(['k3', 'k3-256k', 'kimi-for-coding', 'kimi-for-coding-highspeed']);
  });

  it('injects a refreshed OAuth bearer token', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', upstream);
    try {
      const credentialStore = {
        reload: vi.fn(),
        get: vi.fn(() => ({ type: 'oauth' as const, access: 'old', refresh: 'rt', expires: 0 })),
        getStoredApiKey: vi.fn(),
        getApiKey: vi.fn(async () => 'fresh-token'),
      };
      const fetchWithAuth = buildKimiCodingOAuthFetch({ credentialStore });

      await fetchWithAuth('https://api.kimi.com/coding/v1/messages', {
        headers: { Authorization: 'Bearer stale', 'x-test': 'kept' },
      });

      const [, init] = upstream.mock.calls[0]!;
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer fresh-token');
      expect(headers.get('x-test')).toBe('kept');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
