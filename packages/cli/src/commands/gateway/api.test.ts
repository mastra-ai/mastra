import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.test',
  MASTRA_PROJECTS_URL: 'https://projects.test',
  authHeaders: (token: string, orgId?: string) => ({ Authorization: `Bearer ${token}`, 'x-organization-id': orgId }),
  extractApiErrorDetail: (body: { detail?: string } | undefined) => body?.detail,
  platformFetch: vi.fn(),
}));

const { platformFetch } = await import('../auth/client.js');
const { createGatewayApiKey, creditsPageUrl, getGatewayCredits, revokeGatewayApiKey } = await import('./api');

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function requestBody(call: number) {
  return JSON.parse(String(vi.mocked(platformFetch).mock.calls[call]![1]!.body));
}

beforeEach(() => {
  vi.mocked(platformFetch).mockReset();
});

describe('createGatewayApiKey', () => {
  it('creates an organization key', async () => {
    const signal = new AbortController().signal;
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(201, { keyId: 'key-1', apiKey: 'msk_org' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app', signal)).resolves.toEqual({
      apiKey: 'msk_org',
      keyId: 'key-1',
    });

    expect(platformFetch).toHaveBeenCalledWith(
      'https://platform.test/v1/gateway/organization/v2/keys',
      expect.objectContaining({ method: 'POST', signal }),
    );
    expect(requestBody(0)).toEqual({ label: 'my-app' });
  });

  it('provisions a Gateway project key where the organization key service does not exist', async () => {
    vi.mocked(platformFetch)
      .mockResolvedValueOnce(respond(404, { error: 'Not found' }))
      .mockResolvedValueOnce(respond(201, { project: { id: 'p1', name: 'my-app' }, apiKey: 'msk_project' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app')).resolves.toEqual({ apiKey: 'msk_project' });

    expect(vi.mocked(platformFetch).mock.calls[1]![0]).toBe('https://platform.test/v1/gateway/projects/provision');
    expect(requestBody(1)).toEqual({ name: 'my-app', keyLabel: 'my-app' });
  });

  it('surfaces a failing organization key service instead of provisioning a project', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(503, { error: 'Gateway v2 key service unavailable' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app')).rejects.toThrow('Request failed (503)');
    expect(platformFetch).toHaveBeenCalledOnce();
  });

  it('surfaces other failures without falling back', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(403, { detail: 'Read-only role' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app')).rejects.toThrow('Read-only role');
    expect(platformFetch).toHaveBeenCalledOnce();
  });
});

describe('getGatewayCredits', () => {
  it("reads the balance of the customer's credit pool", async () => {
    const signal = new AbortController().signal;
    vi.mocked(platformFetch).mockResolvedValueOnce(
      respond(200, {
        customer: {
          creditPool: { featureId: 'gateway_credits_teams' },
          balances: { gateway_credits: { remaining: 3 }, gateway_credits_teams: { remaining: 12.5 } },
        },
      }),
    );

    await expect(getGatewayCredits('token', 'org-1', signal)).resolves.toEqual({ remaining: 12.5, unlimited: false });
    expect(platformFetch).toHaveBeenCalledWith(
      'https://platform.test/v1/billing/customer',
      expect.objectContaining({ signal }),
    );
  });

  it('finds the balance by its feature id when it is stored under another key', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(
      respond(200, {
        customer: {
          creditPool: { featureId: 'gateway_credits' },
          balances: { pool_1: { featureId: 'gateway_credits', remaining: 7 } },
        },
      }),
    );

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual({ remaining: 7, unlimited: false });
  });

  it('counts granted minus used credits when the balance has no remaining amount', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(
      respond(200, {
        customer: { balances: { gateway_credits: { featureId: 'gateway_credits', granted: 100, usage: 30 } } },
      }),
    );

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual({ remaining: 70, unlimited: false });
  });

  it('treats a new customer as an empty Starter balance', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(200, { customer: null }));

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual({ remaining: 0, unlimited: false });
  });
});

describe('revokeGatewayApiKey', () => {
  it('deletes the organization key', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(200, { ok: true }));

    await revokeGatewayApiKey('token', 'org-1', 'key-1');

    expect(platformFetch).toHaveBeenCalledWith(
      'https://platform.test/v1/gateway/organization/v2/keys/key-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('creditsPageUrl', () => {
  it("points at the organization's Add credits page", () => {
    expect(creditsPageUrl('org-1')).toBe('https://projects.test/add-credits/org-1');
  });
});
