import {
  authHeaders,
  extractApiErrorDetail,
  MASTRA_PLATFORM_API_URL,
  MASTRA_PROJECTS_URL,
  platformFetch,
} from '../auth/client.js';

export const GATEWAY_API_KEY_ENV = 'MASTRA_GATEWAY_API_KEY';

// Fallback for a customer the server hasn't resolved a credit pool for (Starter).
const STARTER_CREDIT_POOL = 'gateway_credits';

export class GatewayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayApiError';
  }
}

async function request<T>(
  token: string,
  orgId: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}${path}`, {
    ...init,
    signal,
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
export async function createGatewayApiKey(
  token: string,
  orgId: string,
  label: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const result = await request<{ apiKey: string }>(
      token,
      orgId,
      '/v1/gateway/organization/v2/keys',
      { method: 'POST', body: JSON.stringify({ label }) },
      signal,
    );
    return result.apiKey;
  } catch (error) {
    if (!(error instanceof GatewayApiError) || ![404, 503].includes(error.status)) throw error;
  }

  const result = await request<{ apiKey: string }>(
    token,
    orgId,
    '/v1/gateway/projects/provision',
    { method: 'POST', body: JSON.stringify({ name: label, keyLabel: label }) },
    signal,
  );
  return result.apiKey;
}

interface CustomerBalance {
  remaining?: number | null;
  unlimited?: boolean;
}

interface BillingCustomer {
  balances?: Record<string, CustomerBalance | undefined>;
  creditPool?: { featureId?: string | null } | null;
}

export interface GatewayCredits {
  /** Remaining credits in dollars (1 credit = $1). */
  remaining: number;
  unlimited: boolean;
}

export async function getGatewayCredits(token: string, orgId: string, signal?: AbortSignal): Promise<GatewayCredits> {
  const { customer } = await request<{ customer: BillingCustomer | null }>(
    token,
    orgId,
    '/v1/billing/customer',
    {},
    signal,
  );
  const featureId = customer?.creditPool?.featureId ?? STARTER_CREDIT_POOL;
  const balance = customer?.balances?.[featureId];
  return {
    remaining: Math.max(0, balance?.remaining ?? 0),
    unlimited: balance?.unlimited === true,
  };
}

/** The organization's credits in the dashboard (billing), where credits and auto top-up are managed. */
export function creditsPageUrl(orgId: string): string {
  return `${MASTRA_PROJECTS_URL}/orgs/${orgId}/settings/credits`;
}
