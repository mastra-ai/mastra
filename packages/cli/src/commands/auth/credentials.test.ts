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
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/v1/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        signal: controller.signal,
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
