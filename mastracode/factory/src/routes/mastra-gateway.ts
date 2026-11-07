import type { Context } from 'hono';
import { z } from 'zod';

import type { RouteAuth } from './route.js';

const MASTRA_PROJECTS_URL = process.env.MASTRA_PROJECTS_URL || 'https://projects.mastra.ai';

/** The Starter plan's gateway credit pool, used when the customer names none. */
const STARTER_CREDIT_POOL = 'gateway_credits';

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
  return { email: me.user?.email ?? undefined, isAdmin: me.role === 'admin' || me.role === 'owner' };
}

const CreatedGatewayKey = z.object({ apiKey: z.string().min(1) });

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
  const { apiKey } = await readJson(res, CreatedGatewayKey, failure);
  return apiKey;
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
      creditPool: z.object({ featureId: z.string().nullish() }).nullish(),
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
