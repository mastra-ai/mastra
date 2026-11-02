/**
 * One-click Mastra Gateway for Factory: the server creates a gateway key for
 * the signed-in user's Mastra organization on the platform API, as that user,
 * and stores it as the tenant's `mastra-gateway` credential. Models then run
 * as `mastra/<provider>/<model>` on the organization's gateway credits.
 */

import type { Context } from 'hono';

import type { RouteAuth } from './route.js';

/** Platform dashboard, where an organization buys gateway credits. */
const MASTRA_PROJECTS_URL = process.env.MASTRA_PROJECTS_URL || 'https://projects.mastra.ai';

/** The Starter plan's gateway credit pool, used when the customer names none. */
const STARTER_CREDIT_POOL = 'gateway_credits';

/** Label of the gateway keys Factory creates, as shown in the platform's key list. */
export const FACTORY_GATEWAY_KEY_LABEL = 'Factory';

export type MastraGatewayErrorCode =
  | 'mastra_sign_in_required'
  | 'mastra_org_write_required'
  | 'mastra_platform_unavailable';

export class MastraGatewayError extends Error {
  constructor(
    readonly code: MastraGatewayErrorCode,
    readonly status: 400 | 403 | 502,
    message: string,
  ) {
    super(message);
  }
}

async function platformFetch(auth: RouteAuth, c: Context, path: string, init?: RequestInit): Promise<Response> {
  let res: Response | null | undefined;
  try {
    res = await auth.fetchPlatformAsUser?.(c, path, init);
  } catch {
    throw new MastraGatewayError('mastra_platform_unavailable', 502, 'Could not reach Mastra. Try again.');
  }
  if (!res) {
    throw new MastraGatewayError(
      'mastra_sign_in_required',
      400,
      'The Mastra Gateway needs a Factory signed in with a Mastra account.',
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new MastraGatewayError(
      'mastra_org_write_required',
      403,
      'Your Mastra role cannot create gateway keys for this organization. Ask an admin to connect it.',
    );
  }
  if (!res.ok) {
    throw new MastraGatewayError(
      'mastra_platform_unavailable',
      502,
      'Could not create a Mastra Gateway key. Try again.',
    );
  }
  return res;
}

/** Create an organization gateway key (`msk_…`) as the signed-in user. */
export async function createGatewayKey(auth: RouteAuth, c: Context): Promise<string> {
  const res = await platformFetch(auth, c, '/gateway/organization/v2/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: FACTORY_GATEWAY_KEY_LABEL }),
  });
  const { apiKey } = (await res.json()) as { apiKey?: unknown };
  if (typeof apiKey !== 'string' || !apiKey) {
    throw new MastraGatewayError(
      'mastra_platform_unavailable',
      502,
      'Could not create a Mastra Gateway key. Try again.',
    );
  }
  return apiKey;
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

export interface MastraGatewayCredits {
  /** Remaining credits in dollars (1 credit = $1). */
  remaining: number;
  unlimited: boolean;
  /** The platform page where the organization adds credits. */
  addCreditsUrl: string;
}

/** The organization's gateway credit balance, read like the platform dashboard's `useCreditBalance`. */
export async function getGatewayCredits(auth: RouteAuth, c: Context, orgId: string): Promise<MastraGatewayCredits> {
  const res = await platformFetch(auth, c, '/billing/customer');
  const { customer } = (await res.json()) as { customer?: BillingCustomer | null };
  const featureId = customer?.creditPool?.featureId ?? STARTER_CREDIT_POOL;
  const balances = customer?.balances;
  const balance = balances
    ? (Object.values(balances).find(entry => entry?.featureId === featureId) ?? balances[featureId])
    : undefined;
  const remaining =
    balance?.remaining != null
      ? Math.max(0, balance.remaining)
      : balance?.granted != null
        ? Math.max(0, balance.granted - (balance.usage ?? 0))
        : 0;
  return {
    remaining,
    unlimited: balance?.unlimited === true,
    addCreditsUrl: `${MASTRA_PROJECTS_URL}/add-credits/${encodeURIComponent(orgId)}`,
  };
}
