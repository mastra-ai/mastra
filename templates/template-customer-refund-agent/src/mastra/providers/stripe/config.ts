import { z } from "zod";
import type { CaseProviderBindings, ProviderBinding } from "../contracts";

/** Pinned after checking Stripe's current API-version documentation. */
export const STRIPE_API_VERSION = "2026-08-26.dahlia";
const LOCAL_DEMO_TENANT = "local-demo";
const approvedOrigins = new Set(["https://api.stripe.com"]);

export interface StripeSandboxConfig {
  enabled: true;
  tenantId: string;
  accountId: string;
  restrictedApiKey: string;
  webhookSecret: string;
  apiBaseUrl: string;
}

function enabled() {
  return process.env.COMMERCE_SOURCE?.trim().toLowerCase() || "mock";
}
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required when COMMERCE_SOURCE=stripe.`);
  return value;
}

/** External commerce is independently selected from support. It is opt-in,
 * sandbox-only, and never silently replaces a persisted local binding. */
export function stripeSandboxConfig(): StripeSandboxConfig | undefined {
  const source = enabled();
  if (source === "mock") return undefined;
  if (source !== "stripe")
    throw new Error('COMMERCE_SOURCE must be either "mock" or "stripe".');
  if (process.env.STRIPE_SANDBOX_ENABLED?.trim().toLowerCase() !== "true")
    throw new Error(
      "COMMERCE_SOURCE=stripe requires STRIPE_SANDBOX_ENABLED=true.",
    );
  const tenantId = required("STRIPE_TENANT_ID");
  if (tenantId !== LOCAL_DEMO_TENANT)
    throw new Error(
      "STRIPE_TENANT_ID must be local-demo for this authenticated demo.",
    );
  const restrictedApiKey = required("STRIPE_RESTRICTED_API_KEY");
  if (!restrictedApiKey.startsWith("rk_test_"))
    throw new Error(
      "STRIPE_RESTRICTED_API_KEY must be a Stripe test restricted key.",
    );
  const apiBaseUrl =
    process.env.STRIPE_API_BASE_URL?.trim() || "https://api.stripe.com";
  const url = new URL(apiBaseUrl);
  if (
    process.env.NODE_ENV !== "test" &&
    (!approvedOrigins.has(url.origin) || url.pathname !== "/")
  )
    throw new Error(
      "STRIPE_API_BASE_URL must be the Stripe API origin outside tests.",
    );
  return {
    enabled: true,
    tenantId,
    accountId: required("STRIPE_ACCOUNT_ID"),
    restrictedApiKey,
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    apiBaseUrl: url.toString().replace(/\/$/, ""),
  };
}

export function stripeBinding(
  config: StripeSandboxConfig,
  resourceId: string,
): ProviderBinding {
  return {
    tenantId: config.tenantId,
    providerKind: "stripe",
    providerAccountId: config.accountId,
    externalConversationId: resourceId,
  };
}

/** Called at inbound acceptance so all four ports are independently durable. */
export function withStripeCommerceBinding(
  existing: CaseProviderBindings,
  config: StripeSandboxConfig | undefined,
  resourceId: string,
): CaseProviderBindings {
  if (!config) return existing;
  const stripe = stripeBinding(config, resourceId);
  return { ...existing, commerce: stripe, transactions: stripe };
}

export const stripeWebhookEnvelopeSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(200),
    api_version: z.string().min(1).max(100).nullable().optional(),
    account: z.string().min(1).max(200).optional(),
    data: z.object({ object: z.record(z.string(), z.unknown()) }),
    livemode: z.literal(false),
    created: z.number().int().nonnegative(),
  })
  .passthrough();
