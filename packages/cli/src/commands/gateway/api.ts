import { authHeaders, extractApiErrorDetail, MASTRA_PLATFORM_API_URL, platformFetch } from '../auth/client.js';

export const GATEWAY_API_KEY_ENV = 'MASTRA_GATEWAY_API_KEY';

/** Credits a new Gateway user is offered when their balance is empty. */
export const DEFAULT_CREDITS_PURCHASE = 25;

// Fallbacks for a customer the server hasn't resolved a credit pool for (Starter).
const STARTER_CREDIT_POOL = 'gateway_credits';
const STARTER_TOPUP_PLAN = 'gateway_credit_topup';

export class GatewayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayApiError';
  }
}

async function request<T>(token: string, orgId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token, orgId),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new GatewayApiError(extractApiErrorDetail(body) ?? `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * Create a Gateway API key in the organization. Uses the organization key service and falls back
 * to provisioning a Gateway project with a key where that service isn't available.
 */
export async function createGatewayApiKey(token: string, orgId: string, label: string): Promise<string> {
  try {
    const result = await request<{ apiKey: string }>(token, orgId, '/v1/gateway/organization/v2/keys', {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
    return result.apiKey;
  } catch (error) {
    if (!(error instanceof GatewayApiError) || ![404, 503].includes(error.status)) throw error;
  }

  const result = await request<{ apiKey: string }>(token, orgId, '/v1/gateway/projects/provision', {
    method: 'POST',
    body: JSON.stringify({ name: label, keyLabel: label }),
  });
  return result.apiKey;
}

interface CustomerBalance {
  remaining?: number | null;
  unlimited?: boolean;
}

interface BillingCustomer {
  balances?: Record<string, CustomerBalance | undefined>;
  creditPool?: { featureId?: string | null; topupPlanId?: string | null } | null;
}

export interface GatewayCredits {
  /** Remaining credits in dollars (1 credit = $1). */
  remaining: number;
  unlimited: boolean;
  featureId: string;
  topupPlanId: string;
}

export async function getGatewayCredits(token: string, orgId: string): Promise<GatewayCredits> {
  const { customer } = await request<{ customer: BillingCustomer | null }>(token, orgId, '/v1/billing/customer');
  const featureId = customer?.creditPool?.featureId ?? STARTER_CREDIT_POOL;
  const topupPlanId = customer?.creditPool?.topupPlanId ?? STARTER_TOPUP_PLAN;
  const balance = customer?.balances?.[featureId];
  return {
    remaining: Math.max(0, balance?.remaining ?? 0),
    unlimited: balance?.unlimited === true,
    featureId,
    topupPlanId,
  };
}

/** Start a credits purchase and return the checkout page to open in the browser. */
export async function startCreditsCheckout(
  token: string,
  orgId: string,
  credits: GatewayCredits,
  amount: number,
): Promise<string> {
  const attach = (successUrl?: string) =>
    request<{ paymentUrl: string | null }>(token, orgId, '/v1/billing/attach', {
      method: 'POST',
      body: JSON.stringify({
        planId: credits.topupPlanId,
        featureQuantities: [{ featureId: credits.featureId, quantity: amount }],
        redirectMode: 'always',
        ...(successUrl ? { successUrl } : {}),
      }),
    });

  let result: { paymentUrl: string | null };
  try {
    // Back to the Gateway dashboard after paying; checkout's own success page when that isn't allowed.
    result = await attach(`${MASTRA_PLATFORM_API_URL}/orgs/${orgId}/gateway`);
  } catch (error) {
    if (error instanceof GatewayApiError && error.status === 403) {
      throw new GatewayApiError('Only organization admins can buy credits', 403);
    }
    if (!(error instanceof GatewayApiError) || error.status !== 400) throw error;
    result = await attach();
  }
  if (!result.paymentUrl) throw new Error('Checkout did not return a payment page');
  return result.paymentUrl;
}
