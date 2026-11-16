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
  it('returns MASTRA_API_TOKEN from env when set', async () => {
    process.env.MASTRA_API_TOKEN = 'env-token-789';
    vi.resetModules();

    const { getToken } = await import('./credentials.js');
    const token = await getToken();

    expect(token).toBe('env-token-789');
  });

  it('prefers env token over file credentials', async () => {
    process.env.MASTRA_API_TOKEN = 'from-env';
    vi.resetModules();

    const { getToken } = await import('./credentials.js');
    const token = await getToken();

    expect(token).toBe('from-env');
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
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const { tryRefreshToken } = await import('./credentials.js');
    const credentials = {
      token: 'expired-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'e@e.com', firstName: 'A', lastName: 'B' },
      organizationId: 'org-1',
    };

    await expect(tryRefreshToken(credentials, controller.signal)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/v1/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-token' }),
      signal: controller.signal,
    });
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
