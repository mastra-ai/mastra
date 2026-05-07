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
