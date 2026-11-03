/**
 * One-click Mastra Gateway for Factory: the server creates a gateway key for
 * the signed-in user's Mastra organization on the platform API, as that user,
 * and stores it as the tenant's `mastra-gateway` credential. Models then run
 * as `mastra/<provider>/<model>` on the organization's gateway credits, which
 * Factory reads and tops up on the platform as the same user.
 */

import type { Context } from 'hono';

import type { RouteAuth } from './route.js';

/** Platform dashboard, where an organization buys gateway credits. */
const MASTRA_PROJECTS_URL = process.env.MASTRA_PROJECTS_URL || 'https://projects.mastra.ai';

/** The Starter plan's gateway credit pool and its top-up plan, used when the customer names none. */
const STARTER_CREDIT_POOL = 'gateway_credits';
const STARTER_TOPUP_PLAN = 'gateway_credit_topup';

const GATEWAY_KEYS_PATH = '/gateway/organization/v2/keys';

const PLATFORM_TIMEOUT_MS = 15_000;

const PLATFORM_UNREACHABLE = 'Could not reach Mastra. Try again.';

export type MastraGatewayErrorCode =
  | 'mastra_sign_in_required'
  | 'mastra_organization_mismatch'
  | 'mastra_org_write_required'
  | 'mastra_billing_admin_required'
  | 'mastra_billing_rejected'
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

interface PlatformMember {
  email: string | undefined;
  isAdmin: boolean;
}

/**
 * The signed-in user on Mastra, once their session is confirmed to be on this
 * Factory's organization. Platform keys and billing follow the session's
 * active organization, which differs from a Factory pinned to another one.
 */
async function platformMember(auth: RouteAuth, c: Context, orgId: string): Promise<PlatformMember> {
  const res = await platformFetch(auth, c, '/auth/me');
  if (!res.ok) throw platformUnavailable(PLATFORM_UNREACHABLE);
  const me = (await readJson(res, PLATFORM_UNREACHABLE)) as {
    organizationId?: unknown;
    role?: unknown;
    user?: { email?: unknown };
  } | null;
  if (me?.organizationId !== orgId) {
    throw new MastraGatewayError(
      'mastra_organization_mismatch',
      409,
      'Your Mastra sign-in is on a different organization than this Factory. Sign in again with this Factory’s organization.',
    );
  }
  return {
    email: typeof me.user?.email === 'string' ? me.user.email : undefined,
    isAdmin: me.role === 'admin',
  };
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
  const { email } = await platformMember(auth, c, orgId);
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
  await platformMember(auth, c, orgId);
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
  creditPool?: { featureId?: string | null; topupPlanId?: string | null } | null;
}

async function billingCustomer(auth: RouteAuth, c: Context, failure: string): Promise<BillingCustomer | undefined> {
  const res = await platformFetch(auth, c, '/billing/customer');
  if (!res.ok) throw platformUnavailable(failure);
  const body = (await readJson(res, failure)) as { customer?: BillingCustomer | null } | null;
  return body?.customer ?? undefined;
}

function addCreditsUrl(orgId: string): string {
  return `${MASTRA_PROJECTS_URL}/add-credits/${encodeURIComponent(orgId)}`;
}

export interface MastraGatewayCredits {
  /** Remaining credits in dollars (1 credit = $1); `null` when the platform reports no balance for the pool. */
  remaining: number | null;
  unlimited: boolean;
  /** Mastra lets only organization admins buy credits. */
  canAddCredits: boolean;
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
  const member = await platformMember(auth, c, orgId);
  const customer = await billingCustomer(auth, c, 'Could not read Mastra Gateway credits. Try again.');
  const featureId = customer?.creditPool?.featureId ?? STARTER_CREDIT_POOL;
  const balances = customer?.balances;
  const balance = balances
    ? (Object.values(balances).find(entry => entry?.featureId === featureId) ?? balances[featureId])
    : undefined;
  return {
    remaining: remainingCredits(balance),
    unlimited: balance?.unlimited === true,
    canAddCredits: member.isAdmin,
    addCreditsUrl: addCreditsUrl(orgId),
  };
}

export type GatewayCreditPurchase = { status: 'added' } | { status: 'payment_required'; paymentUrl: string };

/**
 * Buy `amount` dollars of gateway credits on the organization's credit pool,
 * as the signed-in user. A saved card settles at once; otherwise Mastra returns
 * the page where the user pays, which lands back on the platform credits page.
 */
export async function purchaseGatewayCredits(
  auth: RouteAuth,
  c: Context,
  orgId: string,
  amount: number,
): Promise<GatewayCreditPurchase> {
  await platformMember(auth, c, orgId);
  const failure = 'Could not add Mastra Gateway credits. Try again.';
  const pool = (await billingCustomer(auth, c, failure))?.creditPool;
  const res = await platformFetch(auth, c, '/billing/attach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: pool?.topupPlanId ?? STARTER_TOPUP_PLAN,
      featureQuantities: [{ featureId: pool?.featureId ?? STARTER_CREDIT_POOL, quantity: amount }],
      successUrl: `${addCreditsUrl(orgId)}?credits_added=1`,
      redirectMode: 'if_required',
    }),
  });
  if (res.status === 403) {
    throw new MastraGatewayError(
      'mastra_billing_admin_required',
      403,
      'Only admins of your Mastra organization can add credits. Ask an admin to add them.',
    );
  }
  if (res.status >= 400 && res.status < 500) {
    const problem = (await res.json().catch(() => null)) as { detail?: unknown; error?: unknown } | null;
    const detail = problem?.detail ?? problem?.error;
    throw new MastraGatewayError(
      'mastra_billing_rejected',
      409,
      typeof detail === 'string' && detail ? detail : 'Mastra could not add the credits.',
    );
  }
  if (!res.ok) throw platformUnavailable(failure);
  const result = (await readJson(res, failure)) as {
    paymentUrl?: unknown;
    requiredAction?: unknown;
    invoice?: { hostedInvoiceUrl?: unknown } | null;
  } | null;
  if (typeof result?.paymentUrl === 'string' && result.paymentUrl) {
    return { status: 'payment_required', paymentUrl: result.paymentUrl };
  }
  if (result?.requiredAction) {
    const invoiceUrl = result.invoice?.hostedInvoiceUrl;
    return {
      status: 'payment_required',
      paymentUrl: typeof invoiceUrl === 'string' && invoiceUrl ? invoiceUrl : addCreditsUrl(orgId),
    };
  }
  return { status: 'added' };
}
