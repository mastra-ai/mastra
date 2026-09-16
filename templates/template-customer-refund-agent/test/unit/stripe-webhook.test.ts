import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  stripeSandboxConfig,
  STRIPE_API_VERSION,
  type StripeSandboxConfig,
  withStripeCommerceBinding,
} from "../../src/mastra/providers/stripe/config";
import {
  MAX_STRIPE_WEBHOOK_BYTES,
  verifyStripeWebhook,
} from "../../src/mastra/providers/stripe/webhook";

const saved = { ...process.env };
const config: StripeSandboxConfig = {
  enabled: true,
  tenantId: "local-demo",
  accountId: "acct_test_123",
  restrictedApiKey: "rk_test_synthetic",
  webhookSecret: "whsec_synthetic",
  apiBaseUrl: "http://stripe.test",
};

function body(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_synthetic",
    type: "refund.updated",
    api_version: STRIPE_API_VERSION,
    livemode: false,
    created: Math.floor(Date.now() / 1_000),
    data: { object: { id: "re_synthetic", livemode: false } },
    ...overrides,
  });
}
function headers(value: string, timestamp = Math.floor(Date.now() / 1_000)) {
  const signature = createHmac("sha256", config.webhookSecret)
    .update(`${timestamp}.${value}`)
    .digest("hex");
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "stripe-signature": `t=${timestamp},v1=${signature}`,
  });
}

afterEach(() => {
  process.env = { ...saved };
});

describe("Stripe sandbox boundary", () => {
  it("requires an explicit sandbox selection and never falls back on partial configuration", () => {
    delete process.env.COMMERCE_SOURCE;
    expect(stripeSandboxConfig()).toBeUndefined();
    process.env.COMMERCE_SOURCE = "stripe";
    process.env.STRIPE_SANDBOX_ENABLED = "true";
    expect(() => stripeSandboxConfig()).toThrow("STRIPE_TENANT_ID");
  });

  it("persists Stripe commerce separately from local support and knowledge", () => {
    const bindings = withStripeCommerceBinding(
      {
        support: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "conversation_1",
        },
        commerce: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "conversation_1",
        },
        transactions: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "conversation_1",
        },
        knowledge: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "conversation_1",
        },
      },
      config,
      "conversation_1",
    );
    expect(bindings.support.providerKind).toBe("local");
    expect(bindings.knowledge.providerKind).toBe("local");
    expect(bindings.commerce).toMatchObject({
      providerKind: "stripe",
      providerAccountId: config.accountId,
    });
    expect(bindings.transactions).toEqual(bindings.commerce);
  });

  it("authenticates bounded raw test-mode, account- and version-matched events before parsing", () => {
    const value = body();
    expect(
      verifyStripeWebhook(Buffer.from(value), headers(value), config),
    ).toMatchObject({ id: "evt_synthetic", type: "refund.updated" });
    expect(() =>
      verifyStripeWebhook(
        Buffer.alloc(MAX_STRIPE_WEBHOOK_BYTES + 1),
        headers(value),
        config,
      ),
    ).toThrow("size");
    const live = body({ livemode: true });
    expect(() =>
      verifyStripeWebhook(Buffer.from(live), headers(live), config),
    ).toThrow();
    const staleAt = Math.floor((Date.now() - 301_000) / 1_000);
    expect(() =>
      verifyStripeWebhook(Buffer.from(value), headers(value, staleAt), config),
    ).toThrow("timestamp");
    const olderVersion = body({ api_version: "2020-08-27" });
    expect(() =>
      verifyStripeWebhook(
        Buffer.from(olderVersion),
        headers(olderVersion),
        config,
      ),
    ).toThrow("version");
    const otherAccount = body({ account: "acct_other" });
    expect(() =>
      verifyStripeWebhook(
        Buffer.from(otherAccount),
        headers(otherAccount),
        config,
      ),
    ).toThrow("account");
    const rotating = headers(value);
    rotating.set(
      "stripe-signature",
      `t=${Math.floor(Date.now() / 1_000)},v1=${"0".repeat(64)},${rotating.get("stripe-signature")!.split(",")[1]}`,
    );
    expect(
      verifyStripeWebhook(Buffer.from(value), rotating, config),
    ).toMatchObject({
      id: "evt_synthetic",
    });
  });
});
