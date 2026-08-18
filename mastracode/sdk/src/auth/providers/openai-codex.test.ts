import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const blockers: http.Server[] = [];

async function getFreePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await closeServer(server);
  if (!address || typeof address === 'string') throw new Error('Failed to allocate a test port');
  return address.port;
}

async function getTestPorts(): Promise<{ defaultPort: number; fallbackPort: number }> {
  return {
    defaultPort: await getFreePort(),
    fallbackPort: await getFreePort(),
  };
}

async function blockPort(port: number): Promise<void> {
  const server = http.createServer((_, res) => {
    res.statusCode = 200;
    res.end('blocked');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  blockers.push(server);
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('OpenAI Codex OAuth callback port selection', () => {
  afterEach(async () => {
    while (blockers.length > 0) {
      const server = blockers.pop();
      if (server) await closeServer(server);
    }
  });

  it('uses the Codex default callback port first', async () => {
    const ports = await getTestPorts();
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.defaultPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('falls back to the Codex fallback port when the default is busy', async () => {
    const ports = await getTestPorts();
    await blockPort(ports.defaultPort);
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.fallbackPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('does not scan arbitrary callback ports after the Codex ports are busy', async () => {
    const ports = await getTestPorts();
    await blockPort(ports.defaultPort);
    await blockPort(ports.fallbackPort);
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.fallbackPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('uses the selected callback port in the authorization URL', async () => {
    const { __testing } = await import('./openai-codex.js');

    const { url } = await __testing.createAuthorizationFlow('http://localhost:1457/auth/callback', 'state');

    expect(new URL(url).searchParams.get('redirect_uri')).toBe('http://localhost:1457/auth/callback');
  });

  it('uses mastracode as the default OAuth originator', async () => {
    const { __testing } = await import('./openai-codex.js');

    const { url } = await __testing.createAuthorizationFlow('http://localhost:1455/auth/callback', 'state');

    expect(new URL(url).searchParams.get('originator')).toBe('mastracode');
  });

  it('requests the official Codex OAuth scopes', async () => {
    const { __testing } = await import('./openai-codex.js');

    const { url } = await __testing.createAuthorizationFlow('http://localhost:1455/auth/callback', 'state');

    expect(new URL(url).searchParams.get('scope')).toBe(
      'openid profile email offline_access api.connectors.read api.connectors.invoke',
    );
  });
});

describe('OpenAI Codex OAuth account id extraction', () => {
  it('extracts account id from id token before access token', async () => {
    const { __testing } = await import('./openai-codex.js');

    expect(
      __testing.getAccountId({
        idToken: jwt({ chatgpt_account_id: 'acct-id-token' }),
        access: jwt({ chatgpt_account_id: 'acct-access-token' }),
      }),
    ).toBe('acct-id-token');
  });

  it('extracts account id from nested access token claims', async () => {
    const { __testing } = await import('./openai-codex.js');

    expect(
      __testing.getAccountId({
        access: jwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-nested' } }),
      }),
    ).toBe('acct-nested');
  });

  it('does not use organization ids as ChatGPT account ids', async () => {
    const { __testing } = await import('./openai-codex.js');

    expect(
      __testing.getAccountId({
        access: jwt({ organizations: [{ id: 'org-123' }] }),
      }),
    ).toBeUndefined();
  });

  it('requires a ChatGPT account id for Codex credentials', async () => {
    const { __testing } = await import('./openai-codex.js');

    expect(() =>
      __testing.requireAccountId({
        access: jwt({ sub: 'user' }),
      }),
    ).toThrow('Failed to extract ChatGPT account id');
  });

  it('returns the previous account id when refreshed tokens do not include one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: jwt({ sub: 'user' }),
          refresh_token: 'refresh-new',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { refreshOpenAICodexToken } = await import('./openai-codex.js');

    await expect(refreshOpenAICodexToken('refresh-old', 'acct-previous')).resolves.toMatchObject({
      access: expect.any(String),
      refresh: 'refresh-new',
      accountId: 'acct-previous',
    });

    vi.unstubAllGlobals();
  });

  it('rejects refreshed tokens when no current or previous account id is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: jwt({ sub: 'user' }),
          refresh_token: 'refresh-new',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { refreshOpenAICodexToken } = await import('./openai-codex.js');

    await expect(refreshOpenAICodexToken('refresh-old')).rejects.toThrow('Failed to extract ChatGPT account id');

    vi.unstubAllGlobals();
  });
});

describe('OpenAI Codex device OAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges device authorization for OAuth credentials', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_auth_id: 'device-123',
            user_code: 'ABCD-EFGH',
            interval: '1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_code: 'auth-code',
            code_verifier: 'verifier',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ chatgpt_account_id: 'acct-device' }),
            refresh_token: 'refresh-device',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onAuth = vi.fn();
    const sleep = vi.fn(async () => {});
    const { __testing } = await import('./openai-codex.js');

    await expect(
      __testing.loginOpenAICodexDevice({
        onAuth,
        sleep,
      }),
    ).resolves.toMatchObject({
      access: expect.any(String),
      refresh: 'refresh-device',
      accountId: 'acct-device',
    });

    expect(onAuth).toHaveBeenCalledWith({
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
    });
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://auth.openai.com/api/accounts/deviceauth/usercode',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      client_id: expect.any(String),
      originator: 'mastracode',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://auth.openai.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
    const tokenBody = fetchMock.mock.calls[2]?.[1]?.body as URLSearchParams;
    expect(tokenBody.get('redirect_uri')).toBe('https://auth.openai.com/deviceauth/callback');
  });

  it('rejects device credentials without a ChatGPT account id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_auth_id: 'device-123',
            user_code: 'ABCD-EFGH',
            interval: '1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_code: 'auth-code',
            code_verifier: 'verifier',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ sub: 'user' }),
            refresh_token: 'refresh-device',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { __testing } = await import('./openai-codex.js');

    await expect(
      __testing.loginOpenAICodexDevice({
        onAuth: vi.fn(),
        sleep: async () => {},
      }),
    ).rejects.toThrow('Failed to extract ChatGPT account id');
  });

  it('accepts the official usercode alias from device authorization responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_auth_id: 'device-123',
            usercode: 'ABCD-EFGH',
            interval: '1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_code: 'auth-code',
            code_verifier: 'verifier',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ chatgpt_account_id: 'acct-device' }),
            refresh_token: 'refresh-device',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onAuth = vi.fn();
    const { __testing } = await import('./openai-codex.js');

    await __testing.loginOpenAICodexDevice({
      onAuth,
      sleep: async () => {},
    });

    expect(onAuth).toHaveBeenCalledWith({
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
    });
  });

  it('polls while device authorization is pending', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_auth_id: 'device-123',
            user_code: 'ABCD-EFGH',
            interval: '1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_code: 'auth-code',
            code_verifier: 'verifier',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ chatgpt_account_id: 'acct-device' }),
            refresh_token: 'refresh-device',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const sleep = vi.fn(async () => {});
    const { __testing } = await import('./openai-codex.js');

    await __testing.loginOpenAICodexDevice({
      onAuth: vi.fn(),
      onProgress: vi.fn(),
      sleep,
    });

    expect(sleep).toHaveBeenCalledWith(1000);
  });
});

describe('Codex device login step primitives', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('startCodexDeviceLogin returns serializable pending state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ device_auth_id: 'device-123', user_code: 'ABCD-EFGH', interval: 3 }), {
          status: 200,
        }),
      ),
    );
    const { startCodexDeviceLogin } = await import('./openai-codex.js');

    const pending = await startCodexDeviceLogin();
    expect(pending).toMatchObject({
      deviceAuthId: 'device-123',
      userCode: 'ABCD-EFGH',
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
      intervalMs: 3000,
    });
    expect(pending.deadlineAt).toBeGreaterThan(Date.now());
    expect(JSON.parse(JSON.stringify(pending))).toEqual(pending);
  });

  it('pollCodexDeviceLogin reports pending on 403 without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 403 })));
    const { pollCodexDeviceLogin } = await import('./openai-codex.js');

    const result = await pollCodexDeviceLogin({
      deviceAuthId: 'device-123',
      userCode: 'ABCD-EFGH',
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
      intervalMs: 5000,
      deadlineAt: Date.now() + 900_000,
    });
    expect(result).toEqual({ status: 'pending', nextPollMs: 5000 });
  });

  it('pollCodexDeviceLogin completes by exchanging the server-held verifier', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authorization_code: 'auth-code', code_verifier: 'verifier' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ chatgpt_account_id: 'acct-device' }),
            refresh_token: 'refresh-device',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { pollCodexDeviceLogin } = await import('./openai-codex.js');

    const result = await pollCodexDeviceLogin({
      deviceAuthId: 'device-123',
      userCode: 'ABCD-EFGH',
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
      intervalMs: 5000,
      deadlineAt: Date.now() + 900_000,
    });
    expect(result.status).toBe('complete');
    expect(result.status === 'complete' && result.credentials).toMatchObject({
      refresh: 'refresh-device',
      accountId: 'acct-device',
    });
  });

  it('pollCodexDeviceLogin fails past the deadline without polling upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { pollCodexDeviceLogin } = await import('./openai-codex.js');

    const result = await pollCodexDeviceLogin({
      deviceAuthId: 'device-123',
      userCode: 'ABCD-EFGH',
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
      intervalMs: 5000,
      deadlineAt: Date.now() - 1,
    });
    expect(result).toEqual({
      status: 'failed',
      error: 'OpenAI Codex device authorization timed out after 15 minutes',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pollCodexDeviceLogin fails loudly on unexpected statuses with the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('server exploded', { status: 500 })));
    const { pollCodexDeviceLogin } = await import('./openai-codex.js');

    const result = await pollCodexDeviceLogin({
      deviceAuthId: 'device-123',
      userCode: 'ABCD-EFGH',
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
      intervalMs: 5000,
      deadlineAt: Date.now() + 900_000,
    });
    expect(result).toEqual({
      status: 'failed',
      error: 'OpenAI Codex device authorization failed: 500 server exploded',
    });
  });
});

describe('openaiCodexOAuthProvider auth modes', () => {
  const originalAuthMode = process.env.MASTRACODE_OPENAI_CODEX_AUTH_MODE;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalAuthMode === undefined) {
      delete process.env.MASTRACODE_OPENAI_CODEX_AUTH_MODE;
    } else {
      process.env.MASTRACODE_OPENAI_CODEX_AUTH_MODE = originalAuthMode;
    }
  });

  it('advertises browser and device auth modes', async () => {
    const { openaiCodexOAuthProvider, OPENAI_CODEX_AUTH_MODES } = await import('./openai-codex.js');

    expect(openaiCodexOAuthProvider.authModes).toBe(OPENAI_CODEX_AUTH_MODES);
    expect(OPENAI_CODEX_AUTH_MODES.map(m => m.id)).toEqual(['browser', 'device']);
  });

  it('uses the device flow when callbacks.authMode is "device" even without the env var', async () => {
    delete process.env.MASTRACODE_OPENAI_CODEX_AUTH_MODE;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ device_auth_id: 'device-123', user_code: 'ABCD-EFGH', interval: '1' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authorization_code: 'auth-code', code_verifier: 'verifier' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt({ chatgpt_account_id: 'acct-device' }),
            refresh_token: 'refresh-device',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { openaiCodexOAuthProvider } = await import('./openai-codex.js');
    const onAuth = vi.fn();

    await expect(
      openaiCodexOAuthProvider.login({
        onAuth,
        onPrompt: async () => '',
        authMode: 'device',
      }),
    ).resolves.toMatchObject({ accountId: 'acct-device', refresh: 'refresh-device' });

    expect(onAuth).toHaveBeenCalledWith({
      url: 'https://auth.openai.com/codex/device',
      instructions: 'Enter code: ABCD-EFGH',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://auth.openai.com/api/accounts/deviceauth/usercode',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('honors callbacks.authMode="browser" even when the env var requests device mode', async () => {
    process.env.MASTRACODE_OPENAI_CODEX_AUTH_MODE = 'device';
    const fetchMock = vi.fn().mockRejectedValue(new Error('unexpected fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const { openaiCodexOAuthProvider } = await import('./openai-codex.js');

    // Browser flow needs a local callback server; the call may fail when the test
    // environment cannot bind, but we only care that the device endpoint is *not* hit.
    await openaiCodexOAuthProvider
      .login({
        onAuth: () => {
          throw new Error('stop-after-onAuth');
        },
        onPrompt: async () => {
          throw new Error('stop-after-onPrompt');
        },
        authMode: 'browser',
      })
      .catch(() => undefined);

    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://auth.openai.com/api/accounts/deviceauth/usercode',
      expect.any(Object),
    );
  });
});
