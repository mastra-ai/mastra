import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProviderAuthRequiredError } from '../auth/provider-auth-error.js';
import { AuthStorage } from '../auth/storage.js';
import { buildKimiCodingApiKeyFetch, buildKimiCodingOAuthFetch, KIMI_CODING_MODELS } from './kimi-coding.js';

describe('Kimi For Coding model provider', () => {
  it('publishes the subscription catalog', () => {
    expect(KIMI_CODING_MODELS).toEqual(['k3', 'k3-256k', 'kimi-for-coding', 'kimi-for-coding-highspeed']);
  });

  it('sends API keys in the Authorization header', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', upstream);
    try {
      const fetchWithAuth = buildKimiCodingApiKeyFetch('api-key');

      await fetchWithAuth('https://api.kimi.com/coding/v1/messages', {
        headers: { 'x-api-key': 'placeholder', 'x-test': 'kept' },
      });

      const [, init] = upstream.mock.calls[0]!;
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer api-key');
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('x-test')).toBe('kept');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('injects a refreshed OAuth bearer token', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', upstream);
    try {
      const credentialStore = {
        reload: vi.fn(),
        get: vi.fn(() => ({
          type: 'oauth' as const,
          access: 'old',
          refresh: 'rt',
          expires: 0,
          deviceId: 'd'.repeat(32),
        })),
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
      expect(headers.get('x-msh-device-id')).toBe('d'.repeat(32));
      expect(headers.get('x-msh-platform')).toBe('mastracode');
      expect(headers.get('x-test')).toBe('kept');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('requests a reconnect when OAuth credentials lack a valid device ID', async () => {
    const credentialStore = {
      reload: vi.fn(),
      get: vi.fn(() => ({
        type: 'oauth' as const,
        access: 'access-token',
        refresh: 'refresh-token',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'access-token'),
    };

    await expect(
      buildKimiCodingOAuthFetch({ credentialStore })('https://api.kimi.com/coding/v1/messages'),
    ).rejects.toBeInstanceOf(ProviderAuthRequiredError);
    expect(credentialStore.getApiKey).not.toHaveBeenCalled();
  });

  it('refreshes expired OAuth credentials with the persisted device ID', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kimi-model-refresh-'));
    const authPath = join(dir, 'auth.json');
    const deviceId = 'f'.repeat(32);
    try {
      const storage = new AuthStorage(authPath);
      storage.set('kimi-for-coding', {
        type: 'oauth',
        access: 'expired-token',
        refresh: 'old-refresh-token',
        expires: 0,
        deviceId,
      });
      const upstream = vi.fn<typeof fetch>().mockImplementation(async input => {
        if (String(input) === 'https://auth.kimi.com/api/oauth/token') {
          return new Response(
            JSON.stringify({
              access_token: 'fresh-token',
              refresh_token: 'fresh-refresh-token',
              expires_in: 900,
            }),
          );
        }
        return new Response('{}');
      });
      vi.stubGlobal('fetch', upstream);

      await buildKimiCodingOAuthFetch({ credentialStore: storage })('https://api.kimi.com/coding/v1/messages');

      expect(upstream).toHaveBeenCalledTimes(2);
      const [, refreshInit] = upstream.mock.calls[0]!;
      const refreshHeaders = new Headers(refreshInit?.headers);
      expect(refreshHeaders.get('x-msh-device-id')).toBe(deviceId);
      expect(refreshHeaders.get('x-msh-platform')).toBe('mastracode');
      const [, modelInit] = upstream.mock.calls[1]!;
      const modelHeaders = new Headers(modelInit?.headers);
      expect(modelHeaders.get('authorization')).toBe('Bearer fresh-token');
      expect(modelHeaders.get('x-msh-device-id')).toBe(deviceId);
    } finally {
      vi.unstubAllGlobals();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reuses the persisted login device ID after storage reload', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kimi-model-auth-'));
    const authPath = join(dir, 'auth.json');
    const deviceId = 'e'.repeat(32);
    try {
      const storage = new AuthStorage(authPath);
      storage.set('kimi-for-coding', {
        type: 'oauth',
        access: 'access-token',
        refresh: 'refresh-token',
        expires: Date.now() + 60_000,
        deviceId,
      });
      const reloadedStorage = new AuthStorage(authPath);
      const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', upstream);

      await buildKimiCodingOAuthFetch({ credentialStore: reloadedStorage })('https://api.kimi.com/coding/v1/messages');

      const [, init] = upstream.mock.calls[0]!;
      expect(new Headers(init?.headers).get('x-msh-device-id')).toBe(deviceId);
    } finally {
      vi.unstubAllGlobals();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
