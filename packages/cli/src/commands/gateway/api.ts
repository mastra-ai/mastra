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

export interface GatewayApiKey {
  apiKey: string;
  /** Set for organization keys, which can be revoked. */
  keyId?: string;
}

/**
 * Create a Gateway API key in the organization. Uses the organization key service and falls back
 * to provisioning a Gateway project with a key only where that service doesn't exist (404). A 503
 * means the service failed, so it surfaces instead of leaving a stray project behind.
 */
export async function createGatewayApiKey(
  token: string,
  orgId: string,
  label: string,
  signal?: AbortSignal,
): Promise<GatewayApiKey> {
  try {
    const result = await request<{ apiKey: string; keyId?: string }>(
      token,
      orgId,
      '/v1/gateway/organization/v2/keys',
      { method: 'POST', body: JSON.stringify({ label }) },
      signal,
    );
    return { apiKey: result.apiKey, keyId: result.keyId };
  } catch (error) {
    if (!(error instanceof GatewayApiError) || error.status !== 404) throw error;
  }

  const result = await request<{ apiKey: string }>(
    token,
    orgId,
    '/v1/gateway/projects/provision',
    { method: 'POST', body: JSON.stringify({ name: label, keyLabel: label }) },
    signal,
  );
  return { apiKey: result.apiKey };
}

/** Revoke an organization key, e.g. one created for a project that was never written. */
export async function revokeGatewayApiKey(token: string, orgId: string, keyId: string): Promise<void> {
  await request(token, orgId, `/v1/gateway/organization/v2/keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}

interface CustomerBalance {
  featureId?: string;
  remaining?: number | null;
  granted?: number | null;
  usage?: number | null;
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
  const balance = findBalance(customer?.balances, featureId);
  return { remaining: remainingCredits(balance), unlimited: balance?.unlimited === true };
}

// Both follow the dashboard (`useCreditBalance`): balances aren't guaranteed to be keyed by feature
// id, and `remaining` is optional.
function findBalance(balances: BillingCustomer['balances'], featureId: string): CustomerBalance | undefined {
  if (!balances) return undefined;
  return Object.values(balances).find(entry => entry?.featureId === featureId) ?? balances[featureId];
}

function remainingCredits(balance: CustomerBalance | undefined): number {
  if (balance?.remaining != null) return Math.max(0, balance.remaining);
  if (balance?.granted != null) return Math.max(0, balance.granted - (balance.usage ?? 0));
  return 0;
}

/** The dashboard's Add credits page for the organization, where credits and auto top-up are bought. */
export function creditsPageUrl(orgId: string): string {
  return `${MASTRA_PROJECTS_URL}/add-credits/${orgId}`;
}
