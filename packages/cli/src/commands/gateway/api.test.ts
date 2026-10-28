import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.test',
  authHeaders: (token: string, orgId?: string) => ({ Authorization: `Bearer ${token}`, 'x-organization-id': orgId }),
  extractApiErrorDetail: (body: { detail?: string } | undefined) => body?.detail,
  platformFetch: vi.fn(),
}));

const { platformFetch } = await import('../auth/client.js');
const { createGatewayApiKey, getGatewayCredits, startCreditsCheckout } = await import('./api');

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function requestBody(call: number) {
  return JSON.parse(String(vi.mocked(platformFetch).mock.calls[call]![1]!.body));
}

const STARTER = { remaining: 0, unlimited: false, featureId: 'gateway_credits', topupPlanId: 'gateway_credit_topup' };

beforeEach(() => {
  vi.mocked(platformFetch).mockReset();
});

describe('createGatewayApiKey', () => {
  it('creates an organization key', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(201, { keyId: 'key-1', apiKey: 'msk_org' }));

    await expect(createGatewayApiKey('token', 'org-1', 'my-app')).resolves.toBe('msk_org');

    expect(platformFetch).toHaveBeenCalledWith(
      'https://platform.test/v1/gateway/organization/v2/keys',
      expect.objectContaining({ method: 'POST' }),
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
    vi.mocked(platformFetch).mockResolvedValueOnce(
      respond(200, {
        customer: {
          creditPool: { featureId: 'gateway_credits_teams', topupPlanId: 'gateway_credit_topup_teams' },
          balances: { gateway_credits: { remaining: 3 }, gateway_credits_teams: { remaining: 12.5 } },
        },
      }),
    );

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual({
      remaining: 12.5,
      unlimited: false,
      featureId: 'gateway_credits_teams',
      topupPlanId: 'gateway_credit_topup_teams',
    });
  });

  it('treats a new customer as an empty Starter balance', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(200, { customer: null }));

    await expect(getGatewayCredits('token', 'org-1')).resolves.toEqual(STARTER);
  });
});

describe('startCreditsCheckout', () => {
  it('starts checkout for the top-up plan and returns to the Gateway dashboard', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(200, { paymentUrl: 'https://checkout.test/s/1' }));

    await expect(startCreditsCheckout('token', 'org-1', STARTER, 25)).resolves.toBe('https://checkout.test/s/1');

    expect(requestBody(0)).toEqual({
      planId: 'gateway_credit_topup',
      featureQuantities: [{ featureId: 'gateway_credits', quantity: 25 }],
      redirectMode: 'always',
      successUrl: 'https://platform.test/orgs/org-1/gateway',
    });
  });

  it("falls back to checkout's own success page when the return URL is rejected", async () => {
    vi.mocked(platformFetch)
      .mockResolvedValueOnce(respond(400, { detail: 'successUrl is not allowed' }))
      .mockResolvedValueOnce(respond(200, { paymentUrl: 'https://checkout.test/s/2' }));

    await expect(startCreditsCheckout('token', 'org-1', STARTER, 25)).resolves.toBe('https://checkout.test/s/2');
    expect(requestBody(1)).not.toHaveProperty('successUrl');
  });

  it('explains when only admins can buy credits', async () => {
    vi.mocked(platformFetch).mockResolvedValueOnce(respond(403, { detail: 'Requires admin role' }));

    await expect(startCreditsCheckout('token', 'org-1', STARTER, 25)).rejects.toThrow(
      'Only organization admins can buy credits',
    );
  });
});
