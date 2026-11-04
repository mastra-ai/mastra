import type { Context } from 'hono';
import { z } from 'zod';

import type { RouteAuth } from './route.js';

const MASTRA_PROJECTS_URL = process.env.MASTRA_PROJECTS_URL || 'https://projects.mastra.ai';

/** The Starter plan's gateway credit pool and its top-up plan, used when the customer names none. */
const STARTER_CREDIT_POOL = 'gateway_credits';
const STARTER_TOPUP_PLAN = 'gateway_credit_topup';

const GATEWAY_KEYS_PATH = '/gateway/organization/v2/keys';

const PLATFORM_TIMEOUT_MS = 15_000;

const PLATFORM_UNREACHABLE = 'Could not reach Mastra. Try again.';

export const MASTRA_SIGN_IN_REQUIRED = 'The Mastra Gateway needs a Factory signed in with a Mastra account.';

export class MastraGatewayError extends Error {
  constructor(
    readonly status: 400 | 403 | 409 | 502,
    message: string,
  ) {
    super(message);
  }
}

function platformUnavailable(message: string): MastraGatewayError {
  return new MastraGatewayError(502, message);
}

async function platformFetch(
  auth: RouteAuth,
  c: Context,
  path: string,
  init: RequestInit = {},
  unreachable = PLATFORM_UNREACHABLE,
): Promise<Response> {
  if (!auth.fetchPlatformAsUser) throw new MastraGatewayError(400, MASTRA_SIGN_IN_REQUIRED);
  let res: Response | null;
  try {
    res = await auth.fetchPlatformAsUser(c, path, { ...init, signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS) });
  } catch {
    throw platformUnavailable(unreachable);
  }
  if (!res || res.status === 401) throw new MastraGatewayError(400, 'Your Mastra sign-in expired. Sign in again.');
  return res;
}

async function readJson<T>(res: Response, schema: z.ZodType<T>, failure: string): Promise<T> {
  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) throw platformUnavailable(failure);
  return parsed.data;
}

const PlatformMe = z.object({
  organizationId: z.string().nullish(),
  role: z.string().nullish(),
  user: z.object({ email: z.string().nullish() }).nullish(),
});

/**
 * The signed-in user on Mastra, once their session is confirmed to be on this
 * Factory's organization. Platform keys and billing follow the session's
 * active organization, which differs from a Factory pinned to another one.
 */
async function platformMember(auth: RouteAuth, c: Context, orgId: string) {
  const res = await platformFetch(auth, c, '/auth/me');
  if (!res.ok) throw platformUnavailable(PLATFORM_UNREACHABLE);
  const me = await readJson(res, PlatformMe, PLATFORM_UNREACHABLE);
  if (me.organizationId !== orgId) {
    throw new MastraGatewayError(
      409,
      'Your Mastra sign-in is on a different organization than this Factory. Sign in again with this Factory’s organization.',
    );
  }
  return { email: me.user?.email ?? undefined, isAdmin: me.role === 'admin' };
}

const CreatedGatewayKey = z.object({ apiKey: z.string().min(1), keyId: z.string().nullish() });

export async function createGatewayKey(auth: RouteAuth, c: Context, orgId: string, scope: 'org' | 'user') {
  const { email } = await platformMember(auth, c, orgId);
  const res = await platformFetch(auth, c, GATEWAY_KEYS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: scope === 'org' ? 'Factory · Shared' : `Factory · ${email ?? 'Personal'}` }),
  });
  if (res.status === 403) {
    throw new MastraGatewayError(
      403,
      'Your Mastra role cannot create gateway keys for this organization. Ask an admin to connect it.',
    );
  }
  const failure = 'Could not create a Mastra Gateway key. Try again.';
  if (!res.ok) throw platformUnavailable(failure);
  const { apiKey, keyId } = await readJson(res, CreatedGatewayKey, failure);
  return { apiKey, keyId: keyId || undefined };
}

/** A key the platform no longer has counts as revoked; it answers 404 for another organization's key too. */
export async function revokeGatewayKey(auth: RouteAuth, c: Context, orgId: string, keyId: string): Promise<void> {
  await platformMember(auth, c, orgId);
  const res = await platformFetch(auth, c, `${GATEWAY_KEYS_PATH}/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw platformUnavailable(`Mastra answered ${res.status} when revoking gateway key ${keyId}.`);
  }
}

const CustomerBalance = z.object({
  featureId: z.string().nullish(),
  remaining: z.number().nullish(),
  granted: z.number().nullish(),
  usage: z.number().nullish(),
  unlimited: z.boolean().nullish(),
});

const BillingCustomer = z.object({
  customer: z
    .object({
      balances: z.record(z.string(), CustomerBalance.nullish()).nullish(),
      creditPool: z.object({ featureId: z.string().nullish(), topupPlanId: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

async function billingCustomer(auth: RouteAuth, c: Context, failure: string) {
  const res = await platformFetch(auth, c, '/billing/customer');
  if (!res.ok) throw platformUnavailable(failure);
  return (await readJson(res, BillingCustomer, failure)).customer ?? undefined;
}

function addCreditsUrl(orgId: string): string {
  return `${MASTRA_PROJECTS_URL}/add-credits/${encodeURIComponent(orgId)}`;
}

export interface MastraGatewayCredits {
  /** Dollars (1 credit = $1); absent when the platform reports no balance for the pool. */
  remaining?: number;
  unlimited: boolean;
  /** Mastra lets only organization admins buy credits. */
  canAddCredits: boolean;
  addCreditsUrl: string;
}

function remainingCredits(balance: z.infer<typeof CustomerBalance> | null | undefined): number | undefined {
  if (balance?.remaining != null) return Math.max(0, balance.remaining);
  if (balance?.granted != null) return Math.max(0, balance.granted - (balance.usage ?? 0));
  return undefined;
}

/** Read like the platform dashboard's `useCreditBalance`. */
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

const PlatformProblem = z.object({
  detail: z.string().min(1).optional().catch(undefined),
  error: z.string().min(1).optional().catch(undefined),
});

const AttachResult = z.object({
  paymentUrl: z.string().nullish(),
  requiredAction: z.unknown().optional(),
  invoice: z.object({ hostedInvoiceUrl: z.string().nullish() }).nullish(),
});

/** A saved card settles at once; otherwise Mastra returns the page where the user pays. */
export async function purchaseGatewayCredits(
  auth: RouteAuth,
  c: Context,
  orgId: string,
  amount: number,
): Promise<GatewayCreditPurchase> {
  await platformMember(auth, c, orgId);
  const pool = (await billingCustomer(auth, c, 'Could not add Mastra Gateway credits. Try again.'))?.creditPool;
  const unconfirmed =
    'Mastra did not confirm the purchase, and the payment may have gone through. Check your balance before you try again.';
  const res = await platformFetch(
    auth,
    c,
    '/billing/attach',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: pool?.topupPlanId ?? STARTER_TOPUP_PLAN,
        featureQuantities: [{ featureId: pool?.featureId ?? STARTER_CREDIT_POOL, quantity: amount }],
        successUrl: `${addCreditsUrl(orgId)}?credits_added=1`,
        redirectMode: 'if_required',
      }),
    },
    unconfirmed,
  );
  if (res.status === 403) {
    throw new MastraGatewayError(
      403,
      'Only admins of your Mastra organization can add credits. Ask an admin to add them.',
    );
  }
  if (res.status >= 400 && res.status < 500) {
    const problem = PlatformProblem.safeParse(await res.json().catch(() => undefined)).data;
    throw new MastraGatewayError(409, problem?.detail ?? problem?.error ?? 'Mastra could not add the credits.');
  }
  if (!res.ok) throw platformUnavailable(unconfirmed);
  const result = await readJson(res, AttachResult, unconfirmed);
  if (result.paymentUrl) return { status: 'payment_required', paymentUrl: result.paymentUrl };
  if (result.requiredAction) {
    return { status: 'payment_required', paymentUrl: result.invoice?.hostedInvoiceUrl || addCreditsUrl(orgId) };
  }
  return { status: 'added' };
}
