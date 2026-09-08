import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStorage, getOAuthProviders, PROVIDER_DEFAULT_MODELS } from '../storage.js';
import {
  kimiCodingOAuthProvider,
  loginKimiCoding,
  pollKimiCodingDeviceLogin,
  refreshKimiCodingToken,
  startKimiCodingDeviceLogin,
} from './kimi-coding.js';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function expectKimiDeviceHeaders(init: RequestInit | undefined): string {
  const headers = new Headers(init?.headers);
  expect(headers.get('x-msh-platform')).toBe('mastracode');
  expect(headers.get('x-msh-version')).toBeTruthy();
  expect(headers.get('x-msh-device-name')).toBeTruthy();
  expect(headers.get('x-msh-device-model')).toBeTruthy();
  expect(headers.get('x-msh-os-version')).toBeTruthy();
  const deviceId = headers.get('x-msh-device-id');
  expect(deviceId).toMatch(/^[0-9a-f]{32}$/);
  return deviceId ?? '';
}

const deviceCodeBody = {
  device_code: 'dev-code',
  user_code: 'ABCD-1234',
  verification_uri: 'https://auth.kimi.com/device',
  verification_uri_complete: 'https://auth.kimi.com/device?user_code=ABCD-1234',
  interval: 5,
  expires_in: 600,
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('Kimi For Coding OAuth', () => {
  it('starts a device login with the Kimi client id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(deviceCodeBody));

    const pending = await startKimiCodingDeviceLogin();

    expect(pending.url).toBe('https://auth.kimi.com/device?user_code=ABCD-1234');
    expect(pending.instructions).toContain('ABCD-1234');
    expect(pending.state.intervalMs).toBe(5000);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://auth.kimi.com/api/oauth/device_authorization');
    expectKimiDeviceHeaders(init as RequestInit);
    expect(new URLSearchParams((init as RequestInit).body as string).get('client_id')).toBe(
      '17e5f671-d194-4dfb-9706-5516cb48c098',
    );
  });

  it.each(['file:///tmp/token', 'http://auth.kimi.com/device'])(
    'rejects an untrusted verification URL: %s',
    async url => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ...deviceCodeBody, verification_uri_complete: url }));
      await expect(startKimiCodingDeviceLogin()).rejects.toThrow('Invalid Kimi For Coding');
    },
  );

  it('completes device polling with OAuth credentials', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(deviceCodeBody))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
    const pending = await startKimiCodingDeviceLogin();

    const result = await pollKimiCodingDeviceLogin(pending);

    expect(result).toMatchObject({
      status: 'complete',
      credentials: { access: 'at', refresh: 'rt', deviceId: expect.stringMatching(/^[0-9a-f]{32}$/) },
    });
    const [, deviceInit] = fetchMock.mock.calls[0]!;
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://auth.kimi.com/api/oauth/token');
    expect(expectKimiDeviceHeaders(init as RequestInit)).toBe(expectKimiDeviceHeaders(deviceInit as RequestInit));
    expect(new URLSearchParams((init as RequestInit).body as string).get('device_code')).toBe('dev-code');
  });

  it('reports pending and denied device flows', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(deviceCodeBody))
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }, 400));
    const pending = await startKimiCodingDeviceLogin();
    expect(await pollKimiCodingDeviceLogin(pending)).toMatchObject({ status: 'pending' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'access_denied' }, 400));
    expect(await pollKimiCodingDeviceLogin(pending)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('denied'),
    });
  });

  it('runs the blocking login flow', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(deviceCodeBody))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
      const onAuth = vi.fn();
      const promise = loginKimiCoding({ onAuth, onPrompt: vi.fn() });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toMatchObject({ access: 'at', refresh: 'rt' });
      expect(onAuth).toHaveBeenCalledWith({
        url: 'https://auth.kimi.com/device?user_code=ABCD-1234',
        instructions: 'Enter code: ABCD-1234',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries transient refresh failures', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'server_error' }, 500))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }));
      const promise = refreshKimiCodingToken('old-rt', { deviceId: 'a'.repeat(32) });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toMatchObject({ access: 'new-at' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
    );
    await expect(refreshKimiCodingToken('old-rt', { deviceId: 'b'.repeat(32) })).resolves.toMatchObject({
      access: 'new-at',
      refresh: 'new-rt',
      deviceId: 'b'.repeat(32),
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(expectKimiDeviceHeaders(init as RequestInit)).toBe('b'.repeat(32));
    expect(new URLSearchParams((init as RequestInit).body as string).get('refresh_token')).toBe('old-rt');
  });

  it('shares one refresh across concurrent expired-token requests', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kimi-auth-'));
    try {
      const storage = new AuthStorage(join(dir, 'auth.json'));
      storage.set('kimi-for-coding', {
        type: 'oauth',
        access: 'old-at',
        refresh: 'old-rt',
        expires: 0,
        deviceId: 'c'.repeat(32),
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
      );

      await expect(
        Promise.all([storage.getApiKey('kimi-for-coding'), storage.getApiKey('kimi-for-coding')]),
      ).resolves.toEqual(['new-at', 'new-at']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(storage.get('kimi-for-coding')).toMatchObject({ deviceId: 'c'.repeat(32) });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('registers the expected provider identity and default model', () => {
    expect(kimiCodingOAuthProvider.id).toBe('kimi-for-coding');
    expect(kimiCodingOAuthProvider.name).toBe('Kimi For Coding');
    expect(kimiCodingOAuthProvider.getApiKey({ access: 'at', refresh: 'rt', expires: 0 })).toBe('at');
    expect(getOAuthProviders()).toContain(kimiCodingOAuthProvider);
    expect(PROVIDER_DEFAULT_MODELS['kimi-for-coding']).toBe('kimi-for-coding/kimi-for-coding');
  });
});
