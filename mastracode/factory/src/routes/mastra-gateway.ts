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

const GATEWAY_KEYS_PATH = '/gateway/organization/v2/keys';

const PLATFORM_TIMEOUT_MS = 15_000;

const PLATFORM_UNREACHABLE = 'Could not reach Mastra. Try again.';

export type MastraGatewayErrorCode =
  | 'mastra_sign_in_required'
  | 'mastra_organization_mismatch'
  | 'mastra_org_write_required'
  | 'mastra_platform_unavailable';

export class MastraGatewayError extends Error {
  constructor(
    readonly code: MastraGatewayErrorCode,
    readonly status: 400 | 403 | 409 | 502,
    message: string,
  ) {
    super(message);
  }
}

function platformUnavailable(message: string): MastraGatewayError {
  return new MastraGatewayError('mastra_platform_unavailable', 502, message);
}

async function platformFetch(auth: RouteAuth, c: Context, path: string, init: RequestInit = {}): Promise<Response> {
  if (!auth.fetchPlatformAsUser) {
    throw new MastraGatewayError(
      'mastra_sign_in_required',
      400,
      'The Mastra Gateway needs a Factory signed in with a Mastra account.',
    );
  }
  let res: Response | null;
  try {
    res = await auth.fetchPlatformAsUser(c, path, { ...init, signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS) });
  } catch {
    throw platformUnavailable(PLATFORM_UNREACHABLE);
  }
  if (!res || res.status === 401) {
    throw new MastraGatewayError('mastra_sign_in_required', 400, 'Your Mastra sign-in expired. Sign in again.');
  }
  return res;
}

async function readJson(res: Response, failure: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw platformUnavailable(failure);
  }
}

/**
 * The signed-in user's email, once their Mastra session is confirmed to be on
 * this Factory's organization. Platform keys and billing follow the session's
 * active organization, which differs from a Factory pinned to another one.
 */
async function platformMemberEmail(auth: RouteAuth, c: Context, orgId: string): Promise<string | undefined> {
  const res = await platformFetch(auth, c, '/auth/me');
  if (!res.ok) throw platformUnavailable(PLATFORM_UNREACHABLE);
  const me = (await readJson(res, PLATFORM_UNREACHABLE)) as {
    organizationId?: unknown;
    user?: { email?: unknown };
  } | null;
  if (me?.organizationId !== orgId) {
    throw new MastraGatewayError(
      'mastra_organization_mismatch',
      409,
      'Your Mastra sign-in is on a different organization than this Factory. Sign in again with this Factory’s organization.',
    );
  }
  return typeof me.user?.email === 'string' ? me.user.email : undefined;
}

export interface MastraGatewayKey {
  apiKey: string;
  /** Platform id of the key, to revoke it when Factory removes the credential. */
  keyId?: string;
}

/** Create an organization gateway key (`msk_…`) as the signed-in user, labelled by the scope it serves. */
export async function createGatewayKey(
  auth: RouteAuth,
  c: Context,
  orgId: string,
  scope: 'org' | 'user',
): Promise<MastraGatewayKey> {
  const email = await platformMemberEmail(auth, c, orgId);
  const res = await platformFetch(auth, c, GATEWAY_KEYS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: scope === 'org' ? 'Factory · Shared' : `Factory · ${email ?? 'Personal'}` }),
  });
  if (res.status === 403) {
    throw new MastraGatewayError(
      'mastra_org_write_required',
      403,
      'Your Mastra role cannot create gateway keys for this organization. Ask an admin to connect it.',
    );
  }
  const failure = 'Could not create a Mastra Gateway key. Try again.';
  if (!res.ok) throw platformUnavailable(failure);
  const body = (await readJson(res, failure)) as { keyId?: unknown; apiKey?: unknown } | null;
  if (typeof body?.apiKey !== 'string' || !body.apiKey) throw platformUnavailable(failure);
  return {
    apiKey: body.apiKey,
    ...(typeof body.keyId === 'string' && body.keyId ? { keyId: body.keyId } : {}),
  };
}

/** Revoke a gateway key Factory created. A key the platform no longer has counts as revoked. */
export async function revokeGatewayKey(auth: RouteAuth, c: Context, orgId: string, keyId: string): Promise<void> {
  await platformMemberEmail(auth, c, orgId);
  const res = await platformFetch(auth, c, `${GATEWAY_KEYS_PATH}/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw platformUnavailable(`Mastra answered ${res.status} when revoking gateway key ${keyId}.`);
  }
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
  /** Remaining credits in dollars (1 credit = $1); `null` when the platform reports no balance for the pool. */
  remaining: number | null;
  unlimited: boolean;
  /** The platform page where the organization adds credits. */
  addCreditsUrl: string;
}

function remainingCredits(balance: CustomerBalance | undefined): number | null {
  if (balance?.remaining != null) return Math.max(0, balance.remaining);
  if (balance?.granted != null) return Math.max(0, balance.granted - (balance.usage ?? 0));
  return null;
}

/** The organization's gateway credit balance, read like the platform dashboard's `useCreditBalance`. */
export async function getGatewayCredits(auth: RouteAuth, c: Context, orgId: string): Promise<MastraGatewayCredits> {
  await platformMemberEmail(auth, c, orgId);
  const res = await platformFetch(auth, c, '/billing/customer');
  const failure = 'Could not read Mastra Gateway credits. Try again.';
  if (!res.ok) throw platformUnavailable(failure);
  const body = (await readJson(res, failure)) as { customer?: BillingCustomer | null } | null;
  const customer = body?.customer;
  const featureId = customer?.creditPool?.featureId ?? STARTER_CREDIT_POOL;
  const balances = customer?.balances;
  const balance = balances
    ? (Object.values(balances).find(entry => entry?.featureId === featureId) ?? balances[featureId])
    : undefined;
  return {
    remaining: remainingCredits(balance),
    unlimited: balance?.unlimited === true,
    addCreditsUrl: `${MASTRA_PROJECTS_URL}/add-credits/${encodeURIComponent(orgId)}`,
  };
}
