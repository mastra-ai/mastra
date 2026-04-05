import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockPlatformFetch = vi.fn();

vi.mock('./client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'http://localhost:9999',
  createApiClient: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
  })),
  authHeaders: vi.fn((token: string, orgId?: string) => {
    const h: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (orgId) h['x-organization-id'] = orgId;
    return h;
  }),
  platformFetch: (...args: unknown[]) => mockPlatformFetch(...args),
  throwApiError: (message: string, status: number, detail?: string) => {
    if (status === 401) throw new Error('Session expired. Run: mastra auth login');
    if (detail) throw new Error(detail);
    throw new Error(`${message}: ${status}`);
  },
}));

const mockGetToken = vi.fn().mockResolvedValue('test-token');
const mockLoadCredentials = vi.fn();
const mockGetCurrentOrgId = vi.fn().mockResolvedValue('org-1');
const mockSetCurrentOrgId = vi.fn().mockResolvedValue(undefined);
const mockClearCredentials = vi.fn().mockResolvedValue(undefined);
const mockLogin = vi.fn().mockResolvedValue({
  token: 'new-token',
  user: { id: 'u1', email: 'user@test.com', firstName: 'A', lastName: 'B' },
  organizationId: 'org-1',
});

vi.mock('./credentials.js', () => ({
  getToken: mockGetToken,
  loadCredentials: mockLoadCredentials,
  getCurrentOrgId: mockGetCurrentOrgId,
  setCurrentOrgId: mockSetCurrentOrgId,
  clearCredentials: mockClearCredentials,
  login: mockLogin,
}));

const mockFetchOrgs = vi.fn();

vi.mock('./api.js', () => ({
  fetchOrgs: mockFetchOrgs,
}));

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('test-token');
  mockGetCurrentOrgId.mockResolvedValue('org-1');
  mockFetchOrgs.mockResolvedValue([
    { id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true },
    { id: 'org-2', name: 'Other Org', role: 'member', isCurrent: false },
  ]);
});

afterEach(() => {
  delete process.env.MASTRA_ORG_ID;
  delete process.env.MASTRA_API_TOKEN;
});

/* ------------------------------------------------------------------ */
/*  login / logout                                                     */
/* ------------------------------------------------------------------ */

describe('loginAction', () => {
  it('calls login()', async () => {
    const { loginAction } = await import('./login.js');
    await loginAction();
    expect(mockLogin).toHaveBeenCalled();
  });
});

describe('logoutAction', () => {
  it('calls clearCredentials and logs message', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logoutAction } = await import('./login.js');
    await logoutAction();

    expect(mockClearCredentials).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Logged out'));
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  whoami                                                             */
/* ------------------------------------------------------------------ */

describe('whoamiAction', () => {
  it('displays user info when logged in', async () => {
    mockLoadCredentials.mockResolvedValue({
      token: 'tok',
      user: { id: 'u1', email: 'user@test.com', firstName: 'A', lastName: 'B' },
      organizationId: 'org-1',
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { whoamiAction } = await import('./whoami.js');
    await whoamiAction();

    // Should display email and user ID
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('user@test.com');
    expect(output).toContain('u1');
    spy.mockRestore();
  });

  it('exits with code 1 when not logged in', async () => {
    mockLoadCredentials.mockResolvedValue(null);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { whoamiAction } = await import('./whoami.js');
    await expect(whoamiAction()).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    spy.mockRestore();
  });

  it('shows env-based auth when MASTRA_API_TOKEN is set', async () => {
    process.env.MASTRA_API_TOKEN = 'env-token';

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { whoamiAction } = await import('./whoami.js');
    await whoamiAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('MASTRA_API_TOKEN');
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  orgs                                                               */
/* ------------------------------------------------------------------ */

describe('listOrgsAction', () => {
  it('lists organizations', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { listOrgsAction } = await import('./orgs.js');
    await listOrgsAction();

    expect(mockGetToken).toHaveBeenCalled();
    expect(mockFetchOrgs).toHaveBeenCalledWith('test-token');

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Test Org');
    expect(output).toContain('Other Org');
    spy.mockRestore();
  });

  it('shows message when no orgs exist', async () => {
    mockFetchOrgs.mockResolvedValue([]);

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { listOrgsAction } = await import('./orgs.js');
    await listOrgsAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No organizations');
    spy.mockRestore();
  });
});

describe('switchOrgAction', () => {
  it('rejects when MASTRA_API_TOKEN is set', async () => {
    process.env.MASTRA_API_TOKEN = 'env-token';

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { switchOrgAction } = await import('./orgs.js');
    await expect(switchOrgAction()).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('MASTRA_API_TOKEN');
    mockExit.mockRestore();
    spy.mockRestore();
  });

  it('rejects when MASTRA_ORG_ID is set', async () => {
    process.env.MASTRA_ORG_ID = 'env-org';

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { switchOrgAction } = await import('./orgs.js');
    await expect(switchOrgAction()).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('MASTRA_ORG_ID');
    mockExit.mockRestore();
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  tokens                                                             */
/* ------------------------------------------------------------------ */

describe('createTokenAction', () => {
  it('creates a token and displays the secret', async () => {
    mockPlatformFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          token: {
            id: 't1',
            name: 'ci-token',
            obfuscatedValue: 'msk_***',
            lastUsedAt: null,
            createdAt: '2025-01-01',
          },
          secret: 'msk_secret_value',
        }),
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createTokenAction } = await import('./tokens.js');
    await createTokenAction('ci-token');

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('ci-token');
    expect(output).toContain('msk_secret_value');
    expect(output).toContain('will not be shown again');
    spy.mockRestore();
  });

  it('throws when no org selected', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    delete process.env.MASTRA_ORG_ID;

    const { createTokenAction } = await import('./tokens.js');
    await expect(createTokenAction('test')).rejects.toThrow('No organization selected');
  });
});

describe('listTokensAction', () => {
  it('lists tokens', async () => {
    mockPlatformFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: [
            { id: 't1', name: 'ci-token', obfuscatedValue: 'msk_***abc', lastUsedAt: null, createdAt: '2025-01-01' },
          ],
        }),
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { listTokensAction } = await import('./tokens.js');
    await listTokensAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('ci-token');
    expect(output).toContain('msk_***abc');
    spy.mockRestore();
  });

  it('shows message when no tokens exist', async () => {
    mockPlatformFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tokens: [] }),
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { listTokensAction } = await import('./tokens.js');
    await listTokensAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No tokens');
    spy.mockRestore();
  });
});

describe('revokeTokenAction', () => {
  it('revokes a token', async () => {
    mockPlatformFetch.mockResolvedValueOnce({ ok: true });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { revokeTokenAction } = await import('./tokens.js');
    await revokeTokenAction('token-123');

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('token-123');
    expect(output).toContain('revoked');
    spy.mockRestore();
  });

  it('throws on failed revocation', async () => {
    mockPlatformFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('not found'),
    });

    const { revokeTokenAction } = await import('./tokens.js');
    await expect(revokeTokenAction('bad-id')).rejects.toThrow('not found');
  });
});
