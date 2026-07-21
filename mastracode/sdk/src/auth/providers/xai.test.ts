import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginXAI, pollXAIDeviceLogin, refreshXAIToken, startXAIDeviceLogin, xaiOAuthProvider } from './xai.js';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const deviceCodeBody = {
  device_code: 'dev-code',
  user_code: 'ABCD-1234',
  verification_uri: 'https://auth.x.ai/activate',
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

describe('startXAIDeviceLogin', () => {
  it('requests a device code and returns serializable pending state', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(deviceCodeBody));

    const pending = await startXAIDeviceLogin();

    expect(pending.deviceCode).toBe('dev-code');
    expect(pending.userCode).toBe('ABCD-1234');
    expect(pending.url).toBe('https://auth.x.ai/activate');
    expect(pending.instructions).toContain('ABCD-1234');
    expect(pending.state.intervalMs).toBe(5000);
    // Round-trips through JSON (persisted as pending jsonb by web routes).
    expect(JSON.parse(JSON.stringify(pending))).toEqual(pending);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://auth.x.ai/oauth2/device/code');
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('client_id')).toBe('b1a00492-073a-47ea-816f-4c329264a828');
    expect(body.get('scope')).toContain('grok-cli:access');
  });

  it('prefers verification_uri_complete when present', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...deviceCodeBody, verification_uri_complete: 'https://auth.x.ai/activate?user_code=ABCD-1234' }),
    );

    const pending = await startXAIDeviceLogin();
    expect(pending.url).toBe('https://auth.x.ai/activate?user_code=ABCD-1234');
  });

  it('rejects a non-https verification_uri', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...deviceCodeBody, verification_uri: 'http://evil.example/activate' }),
    );

    await expect(startXAIDeviceLogin()).rejects.toThrow(/non-https verification_uri/);
  });

  it('throws on a failed device code request with the response body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 400 }));

    await expect(startXAIDeviceLogin()).rejects.toThrow(/400 nope/);
  });
});

describe('pollXAIDeviceLogin', () => {
  async function startPending() {
    fetchMock.mockResolvedValueOnce(jsonResponse(deviceCodeBody));
    return startXAIDeviceLogin();
  }

  it('returns pending with nextPollMs on authorization_pending', async () => {
    const pending = await startPending();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }, 400));

    const result = await pollXAIDeviceLogin(pending);

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') throw new Error('unreachable');
    expect(result.nextPollMs).toBeGreaterThan(0);
    expect(result.pending.state.slowDownResponses).toBe(0);

    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://auth.x.ai/oauth2/token');
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code');
    expect(body.get('device_code')).toBe('dev-code');
  });

  it('grows the interval and tracks slow_down responses', async () => {
    const pending = await startPending();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'slow_down' }, 400));

    const result = await pollXAIDeviceLogin(pending);

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') throw new Error('unreachable');
    // RFC 8628 section 3.5: +5s when no server interval provided.
    expect(result.pending.state.intervalMs).toBe(10000);
    expect(result.pending.state.slowDownResponses).toBe(1);
  });

  it('completes with credentials on a successful token response', async () => {
    const pending = await startPending();
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

    const before = Date.now();
    const result = await pollXAIDeviceLogin(pending);

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') throw new Error('unreachable');
    expect(result.credentials.access).toBe('at');
    expect(result.credentials.refresh).toBe('rt');
    // 1h minus 5-minute skew
    expect(result.credentials.expires).toBeGreaterThanOrEqual(before + 3600_000 - 300_000);
  });

  it('fails without retrying on access_denied', async () => {
    const pending = await startPending();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'access_denied' }, 400));

    const result = await pollXAIDeviceLogin(pending);

    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('denied') });
  });

  it('fails loudly with the response body on unknown errors', async () => {
    const pending = await startPending();
    fetchMock.mockResolvedValueOnce(new Response('{"error":"server_error"}', { status: 500 }));

    const result = await pollXAIDeviceLogin(pending);

    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('server_error') });
  });

  it('fails with a timeout after the deadline passes', async () => {
    const pending = await startPending();
    pending.state.deadlineAt = Date.now() - 1;

    const result = await pollXAIDeviceLogin(pending);

    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('timed out') });
    // No upstream poll after the deadline.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('loginXAI', () => {
  it('runs the blocking device flow to completion', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(deviceCodeBody))
        .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }, 400))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

      const onAuth = vi.fn();
      const loginPromise = loginXAI({ onAuth, onPrompt: vi.fn() });

      await vi.runAllTimersAsync();
      const creds = await loginPromise;

      expect(creds.access).toBe('at');
      expect(onAuth).toHaveBeenCalledWith({
        url: 'https://auth.x.ai/activate',
        instructions: 'Enter code: ABCD-1234',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors AbortSignal cancellation', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(deviceCodeBody));
    const controller = new AbortController();
    controller.abort();

    await expect(loginXAI({ onAuth: vi.fn(), onPrompt: vi.fn(), signal: controller.signal })).rejects.toThrow(
      'Login cancelled',
    );
  });
});

describe('refreshXAIToken', () => {
  it('exchanges a refresh token and keeps the old refresh token if not rotated', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'new-at', expires_in: 3600 }));

    const creds = await refreshXAIToken('old-rt');

    expect(creds.access).toBe('new-at');
    expect(creds.refresh).toBe('old-rt');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://auth.x.ai/oauth2/token');
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-rt');
  });

  it('uses the rotated refresh token when returned', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
    );

    const creds = await refreshXAIToken('old-rt');
    expect(creds.refresh).toBe('new-rt');
  });

  it('throws with the response body on failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('invalid_grant', { status: 400 }));

    await expect(refreshXAIToken('old-rt')).rejects.toThrow(/400 invalid_grant/);
  });
});

describe('xaiOAuthProvider', () => {
  it('exposes id, name, and getApiKey', () => {
    expect(xaiOAuthProvider.id).toBe('xai');
    expect(xaiOAuthProvider.name).toContain('xAI');
    expect(xaiOAuthProvider.getApiKey({ access: 'at', refresh: 'rt', expires: 0 })).toBe('at');
  });
});
