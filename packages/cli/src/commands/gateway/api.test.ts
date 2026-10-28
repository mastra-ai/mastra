import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.test',
  MASTRA_PROJECTS_URL: 'https://projects.test',
  authHeaders: (token: string, orgId?: string) => ({ Authorization: `Bearer ${token}`, 'x-organization-id': orgId }),
  extractApiErrorDetail: (body: { detail?: string } | undefined) => body?.detail,
  platformFetch: vi.fn(),
}));

const { platformFetch } = await import('../auth/client.js');
const { createGatewayApiKey, creditsPageUrl, getGatewayCredits } = await import('./api');

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

    await expect(createGatewayApiKey('token', 'org-1', 'my-app', signal)).resolves.toBe('msk_org');

    expect(platformFetch).toHaveBeenCalledWith(
      'https://platform.test/v1/gateway/organization/v2/keys',
      expect.objectContaining({ method: 'POST', signal }),
    );
    expect(requestBody(0)).toEqual({ label: 'my-app' });
  });

  it.each([404, 503])('provisions a Gateway project key when the organization key service answers %s', async status => {
    vi.mocked(platformFetch)
      .mockResolvedValueOnce(respond(status, { error: 'Gateway v2 key service unavailable' }))
      .mockResolvedValueOnce(respond(201, { project: { id: 'p1', name: 'my-app' }, apiKey: 'msk_project' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app')).resolves.toBe('msk_project');

    expect(vi.mocked(platformFetch).mock.calls[1]![0]).toBe('https://platform.test/v1/gateway/projects/provision');
    expect(requestBody(1)).toEqual({ name: 'my-app', keyLabel: 'my-app' });
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

  it('treats a new customer as an empty Starter balance', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(200, { customer: null }));

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual({ remaining: 0, unlimited: false });
  });
});

describe('creditsPageUrl', () => {
  it("points at the organization's Add credits page", () => {
    expect(creditsPageUrl('org-1')).toBe('https://projects.test/add-credits/org-1');
  });
});
