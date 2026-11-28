import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'http://localhost:9999',
  createApiClient: vi.fn(() => ({
    GET: vi.fn().mockResolvedValue({
      data: { user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' }, organizationId: 'org-1' },
    }),
    POST: vi.fn().mockResolvedValue({
      data: { accessToken: 'new-tok', refreshToken: 'new-ref' },
    }),
  })),
  authHeaders: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MASTRA_API_TOKEN;
  delete process.env.MASTRA_ORG_ID;
});

describe('getToken', () => {
  it.each([
    ['returns MASTRA_API_TOKEN from env when set', 'env-token-789'],
    ['prefers env token over file credentials', 'from-env'],
  ] as const)('%s', async (_title, value) => {
    process.env.MASTRA_API_TOKEN = value;
    vi.resetModules();

    const { getToken } = await import('./credentials.js');
    const token = await getToken();

    expect(token).toBe(value);
  });
});

describe('token requests', () => {
  it('passes the abort signal when verifying a token', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { verifyToken } = await import('./credentials.js');

    await expect(verifyToken('token', controller.signal)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/v1/auth/verify', {
      headers: { Authorization: 'Bearer token' },
      signal: controller.signal,
    });
  });

  it('passes the abort signal when refreshing a token', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'mastra-cli-credentials-'));
    const controller = new AbortController();

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => tempHome };
    });

    try {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', fetchMock);

      const { saveCredentials, tryRefreshToken } = await import('./credentials.js');
      const credentials = {
        token: 'expired-token',
        refreshToken: 'refresh-token',
        user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
        organizationId: 'org-1',
      };
      await saveCredentials(credentials);

      await expect(tryRefreshToken(credentials, controller.signal)).resolves.toBeNull();
      // The caller signal is combined with a request timeout, so assert an
      // abort signal is present rather than the caller's exact instance.
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/v1/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        signal: expect.any(AbortSignal),
      });
    } finally {
      vi.doUnmock('node:os');
      vi.resetModules();
      await rm(tempHome, { recursive: true, force: true });
    }
  });
});

describe('concurrent token refresh', () => {
  it('reuses credentials rotated by another refresh instead of submitting a stale refresh token twice', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'mastra-cli-credentials-'));
    let releaseRefresh!: () => void;
    const refreshStarted = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => tempHome };
    });

    try {
      const fetchMock = vi.fn().mockImplementation(async () => {
        await refreshStarted;
        return {
          ok: true,
          json: async () => ({ accessToken: 'new-token', refreshToken: 'new-refresh-token' }),
        };
      });
      vi.stubGlobal('fetch', fetchMock);

      const { loadCredentials, saveCredentials, tryRefreshToken } = await import('./credentials.js');
      const credentials = {
        token: 'expired-token',
        refreshToken: 'stale-refresh-token',
        user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
        organizationId: 'org-1',
      };
      await saveCredentials(credentials);

      const firstRefresh = tryRefreshToken({ ...credentials });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const secondRefresh = tryRefreshToken({ ...credentials });
      releaseRefresh();

      await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual(['new-token', 'new-token']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await expect(loadCredentials()).resolves.toMatchObject({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });
    } finally {
      vi.doUnmock('node:os');
      vi.resetModules();
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it('does not refresh from caller credentials after a logout cleared the stored credentials', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'mastra-cli-credentials-'));

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => tempHome };
    });

    try {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { tryRefreshToken } = await import('./credentials.js');
      const credentials = {
        token: 'expired-token',
        refreshToken: 'stale-refresh-token',
        user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
        organizationId: 'org-1',
      };

      await expect(tryRefreshToken(credentials)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('node:os');
      vi.resetModules();
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it('does not return another account token when a different user logged in meanwhile', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'mastra-cli-credentials-'));

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => tempHome };
    });

    try {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { saveCredentials, tryRefreshToken } = await import('./credentials.js');
      await saveCredentials({
        token: 'other-user-token',
        refreshToken: 'other-user-refresh-token',
        user: { id: 'u2', email: 'other@e.com', firstName: 'C', lastName: 'D' },
        organizationId: 'org-2',
      });

      const callerCredentials = {
        token: 'expired-token',
        refreshToken: 'stale-refresh-token',
        user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
        organizationId: 'org-1',
      };

      await expect(tryRefreshToken(callerCredentials)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('node:os');
      vi.resetModules();
      await rm(tempHome, { recursive: true, force: true });
    }
  });
});

describe('getCurrentOrgId', () => {
  it('returns MASTRA_ORG_ID from env when set', async () => {
    process.env.MASTRA_ORG_ID = 'env-org-123';
    vi.resetModules();

    const { getCurrentOrgId } = await import('./credentials.js');
    const orgId = await getCurrentOrgId();

    expect(orgId).toBe('env-org-123');
  });
});

describe('validateOrgAccess', () => {
  it('passes when org is in the user org list', async () => {
    vi.resetModules();
    vi.doMock('./api.js', () => ({
      fetchOrgs: vi.fn().mockResolvedValue([
        { id: 'org-1', name: 'Org One', role: 'admin', isCurrent: true },
        { id: 'org-2', name: 'Org Two', role: 'member', isCurrent: false },
      ]),
    }));

    const { validateOrgAccess } = await import('./credentials.js');
    await expect(validateOrgAccess('tok', 'org-1')).resolves.toBeUndefined();
  });

  it('throws when org is not in the user org list', async () => {
    vi.resetModules();
    vi.doMock('./api.js', () => ({
      fetchOrgs: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Org One', role: 'admin', isCurrent: true }]),
    }));

    const { validateOrgAccess } = await import('./credentials.js');
    await expect(validateOrgAccess('tok', 'deleted-org')).rejects.toThrow(
      'No access to organization deleted-org. Run: mastra auth orgs',
    );
  });
});

describe('Credentials interface shape', () => {
  it('accepts minimal credentials', () => {
    const creds = {
      token: 'tok',
      user: { id: 'u1', email: 'e@e.com', firstName: null, lastName: null },
      organizationId: 'org1',
    };
    expect(creds.token).toBeDefined();
    expect(creds.user.email).toBeDefined();
    expect(creds.organizationId).toBeDefined();
  });

  it('accepts credentials with optional fields', () => {
    const creds = {
      token: 'tok',
      refreshToken: 'ref-tok',
      user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
      organizationId: 'org1',
      currentOrgId: 'org2',
    };
    expect(creds.refreshToken).toBe('ref-tok');
    expect(creds.currentOrgId).toBe('org2');
  });
});

describe('openBrowser', () => {
  const originalPlatform = process.platform;

  async function loadWithMockedExec() {
    vi.resetModules();
    const execFileSync = vi.fn();
    vi.doMock('node:child_process', () => ({ execFileSync }));
    const { openBrowser } = await import('./credentials.js');
    return { openBrowser, execFileSync };
  }

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  }

  afterEach(() => {
    setPlatform(originalPlatform);
    vi.doUnmock('node:child_process');
  });

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'calc.exe', '--help', '', 'ftp://example.com/x'])(
    'refuses to open %j and never spawns a process',
    async url => {
      const { openBrowser, execFileSync } = await loadWithMockedExec();

      expect(() => openBrowser(url)).toThrow(/Refusing to open/);
      expect(execFileSync).not.toHaveBeenCalled();
    },
  );

  it('passes the URL as a single argument on macOS', async () => {
    setPlatform('darwin');
    const { openBrowser, execFileSync } = await loadWithMockedExec();

    openBrowser('https://example.com/login?a=1&b=2');

    expect(execFileSync).toHaveBeenCalledWith('open', ['https://example.com/login?a=1&b=2']);
  });

  it('does not route the URL through cmd.exe on Windows', async () => {
    setPlatform('win32');
    const { openBrowser, execFileSync } = await loadWithMockedExec();

    openBrowser('https://example.com/login?a=1&calc.exe');

    expect(execFileSync).toHaveBeenCalledWith('rundll32.exe', [
      'url.dll,FileProtocolHandler',
      'https://example.com/login?a=1&calc.exe',
    ]);
    expect(execFileSync.mock.calls.some(([cmd]) => /^cmd/i.test(String(cmd)))).toBe(false);
  });

  it('percent-encodes shell metacharacters that are not valid in a URL', async () => {
    setPlatform('darwin');
    const { openBrowser, execFileSync } = await loadWithMockedExec();

    openBrowser('http://localhost:3000/a b"$(touch x)`id`');

    const [, args] = execFileSync.mock.calls[0]!;
    expect(args).toEqual(['http://localhost:3000/a%20b%22$(touch%20x)%60id%60']);
  });
});
