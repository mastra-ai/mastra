import { describe, expect, it } from "vitest";
import {
  StripeClient,
  StripeHttpError,
} from "../../src/mastra/providers/stripe/client";
import {
  STRIPE_API_VERSION,
  type StripeSandboxConfig,
} from "../../src/mastra/providers/stripe/config";
import { subscriptionCreditFingerprint } from "../../src/mastra/lib/money";

const config: StripeSandboxConfig = {
  enabled: true,
  tenantId: "local-demo",
  accountId: "acct_test_123",
  restrictedApiKey: "rk_test_synthetic",
  webhookSecret: "whsec_synthetic",
  apiBaseUrl: "http://stripe.test",
};
const binding = {
  tenantId: "local-demo",
  providerKind: "stripe" as const,
  providerAccountId: "acct_test_123",
  externalConversationId: "case_1",
};

describe("Stripe fetch mapping", () => {
  it("keeps only allow-listed diagnostics from a hostile Stripe error body", async () => {
    const client = new StripeClient(config, async () =>
      Response.json(
        {
          error: {
            code: "rk_test_synthetic",
            type: "attacker-controlled-type",
            message: "SYNTHETIC-PRIVATE-STRIPE-BODY",
            payment_intent: "pi_private",
          },
        },
        { status: 400, headers: { "request-id": "rk_test_header" } },
      ),
    );
    await expect(
      (
        client as unknown as { request(path: string): Promise<unknown> }
      ).request("/v1/private"),
    ).rejects.toMatchObject<Partial<StripeHttpError>>({
      status: 400,
      diagnostic: {},
    });
  });

  it("creates one exact negative customer-balance transaction for a monthly subscription credit", async () => {
    const commandBase = {
      approvalCaseId: "case_credit",
      binding,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: { currency: "USD", minor: 4900 },
      reason: "Verified outage credit",
      idempotencyKey: "case_credit:turn_1:subscription-credit",
    };
    const command = {
      ...commandBase,
      fingerprint: subscriptionCreditFingerprint(commandBase),
    };
    let posted: URLSearchParams | undefined;
    const client = new StripeClient(config, async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({ id: config.accountId });
      if (url.pathname === "/v1/subscriptions/sub_1")
        return Response.json({
          id: "sub_1",
          customer: "cus_1",
          livemode: false,
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: {
                  currency: "usd",
                  unit_amount: 4900,
                  recurring: { interval: "month", interval_count: 1 },
                },
                quantity: 1,
              },
            ],
          },
        });
      if (url.pathname === "/v1/customers/cus_1" && request.method === "GET")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      if (url.pathname === "/v1/customers/cus_1/balance_transactions") {
        if (request.method === "GET")
          return Response.json({ data: [], has_more: false });
        posted = new URLSearchParams(await request.text());
        return Response.json({
          id: "cbtxn_1",
          customer: "cus_1",
          livemode: false,
          amount: -4900,
          currency: "usd",
          created: 1,
          metadata: {
            support_case_id: "case_credit",
            command_fingerprint: command.fingerprint,
            subscription_id: "sub_1",
          },
        });
      }
      throw new Error(`unexpected ${url.pathname}`);
    });
    await expect(
      client.createSubscriptionCredit(command, "alex@example.com"),
    ).resolves.toMatchObject({
      creditId: "cbtxn_1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: { currency: "USD", minor: 4900 },
      status: "succeeded",
    });
    expect(posted?.get("amount")).toBe("-4900");
    expect(posted?.get("currency")).toBe("usd");
  });

  it("fences the credit POST after the final blocked balance-ledger GET", async () => {
    const commandBase = {
      approvalCaseId: "case_credit_preflight",
      binding,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: { currency: "USD", minor: 4900 },
      reason: "Verified outage credit",
      idempotencyKey: "case_credit_preflight:turn_1:subscription-credit",
    };
    const command = {
      ...commandBase,
      fingerprint: subscriptionCreditFingerprint(commandBase),
    };
    let releaseLedger!: () => void;
    let ledgerStarted!: () => void;
    let policyReplaced = false;
    let posts = 0;
    const ledgerStartedPromise = new Promise<void>((resolve) => {
      ledgerStarted = resolve;
    });
    const ledgerRelease = new Promise<void>((resolve) => {
      releaseLedger = resolve;
    });
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/subscriptions/sub_1")
        return Response.json({
          id: "sub_1",
          customer: "cus_1",
          livemode: false,
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  currency: "usd",
                  unit_amount: 4900,
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        });
      if (path === "/v1/customers/cus_1")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      if (path === "/v1/customers/cus_1/balance_transactions") {
        if (request.method === "POST") posts += 1;
        if (request.method === "GET") {
          ledgerStarted();
          await ledgerRelease;
        }
        return Response.json({
          data: [],
          has_more: false,
        });
      }
      throw new Error(`unexpected ${request.method} ${path}`);
    });

    const create = client.createSubscriptionCredit(
      command,
      "alex@example.com",
      async () => {
        if (!policyReplaced)
          throw new Error("policy fence was evaluated before final ledger GET");
        throw new Error("policy evidence is no longer current");
      },
    );
    await ledgerStartedPromise;
    policyReplaced = true;
    releaseLedger();
    await expect(create).rejects.toThrow(
      "policy evidence is no longer current",
    );
    expect(posts).toBe(0);
  });

  it("blocks a prior subscription credit even when its amount differs", async () => {
    const commandBase = {
      approvalCaseId: "case_credit_prior_partial",
      binding,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: { currency: "USD", minor: 4900 },
      reason: "Verified outage credit",
      idempotencyKey: "case_credit_prior_partial:turn_1:subscription-credit",
    };
    const command = {
      ...commandBase,
      fingerprint: subscriptionCreditFingerprint(commandBase),
    };
    let posts = 0;
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/subscriptions/sub_1")
        return Response.json({
          id: "sub_1",
          customer: "cus_1",
          livemode: false,
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  currency: "usd",
                  unit_amount: 4900,
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        });
      if (path === "/v1/customers/cus_1")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      if (path === "/v1/customers/cus_1/balance_transactions") {
        if (request.method === "POST") posts += 1;
        return Response.json({
          data: [
            {
              id: "cbtxn_partial",
              customer: "cus_1",
              livemode: false,
              amount: -1200,
              currency: "eur",
              metadata: {
                subscription_id: "sub_1",
                command_fingerprint: "prior-different-amount",
              },
            },
          ],
          has_more: false,
        });
      }
      throw new Error(`unexpected ${request.method} ${path}`);
    });
    await expect(
      client.createSubscriptionCredit(command, "alex@example.com"),
    ).rejects.toThrow("prior Stripe subscription credit");
    expect(posts).toBe(0);
  });

  it("recovers a timeout-after-remote-credit from immutable balance metadata without posting again", async () => {
    const commandBase = {
      approvalCaseId: "case_credit_recovery",
      binding,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: { currency: "USD", minor: 4900 },
      reason: "Verified outage credit",
      idempotencyKey: "case_credit_recovery:turn_1:subscription-credit",
    };
    const command = {
      ...commandBase,
      fingerprint: subscriptionCreditFingerprint(commandBase),
    };
    let posts = 0;
    const transaction = {
      id: "cbtxn_recovered",
      customer: "cus_1",
      livemode: false,
      amount: -4900,
      currency: "usd",
      created: 1,
      metadata: {
        support_case_id: command.approvalCaseId,
        command_fingerprint: command.fingerprint,
        subscription_id: command.subscriptionId,
      },
    };
    const client = new StripeClient(config, async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({ id: config.accountId });
      if (url.pathname === "/v1/subscriptions/sub_1")
        return Response.json({
          id: "sub_1",
          customer: "cus_1",
          livemode: false,
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: {
                  currency: "usd",
                  unit_amount: 4900,
                  recurring: { interval: "month", interval_count: 1 },
                },
                quantity: 1,
              },
            ],
          },
        });
      if (url.pathname === "/v1/customers/cus_1")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      if (
        url.pathname === "/v1/customers/cus_1/balance_transactions" &&
        request.method === "POST"
      ) {
        posts += 1;
        throw new TypeError("timeout after remote success");
      }
      if (url.pathname === "/v1/customers/cus_1/balance_transactions")
        return Response.json({ data: [transaction], has_more: false });
      if (
        url.pathname ===
        "/v1/customers/cus_1/balance_transactions/cbtxn_recovered"
      )
        return Response.json(transaction);
      throw new Error(`unexpected ${request.method} ${url.pathname}`);
    });
    await expect(
      client.createSubscriptionCredit(command, "alex@example.com"),
    ).rejects.toMatchObject({ ambiguous: true });
    await expect(
      client.findSubscriptionCreditReceipt(command, "alex@example.com"),
    ).resolves.toMatchObject({ creditId: "cbtxn_recovered", replayed: true });
    expect(posts).toBe(1);
  });
  it("maps a verified Customer, Checkout Session, line items and PaymentIntent with exact minor units", async () => {
    const calls: Request[] = [];
    const client = new StripeClient(config, async (request) => {
      calls.push(request);
      const path = new URL(request.url).pathname;
      // Current Stripe Account objects identify the account but do not expose
      // a `livemode` field.  The adapter must not reject this documented
      // sandbox account shape before it can map downstream resources.
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "cs_1",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_1",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/payment_intents/pi_1")
        return Response.json({
          id: "pi_1",
          livemode: false,
          currency: "usd",
          amount_received: 4999,
          status: "succeeded",
        });
      if (path === "/v1/checkout/sessions/cs_1/line_items")
        return Response.json({
          data: [
            {
              description: "Synthetic plan",
              price: { product: "prod_synthetic" },
            },
          ],
          has_more: false,
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      client.findOrder(binding, "alex@example.com"),
    ).resolves.toMatchObject({
      orderId: "cs_1",
      customerEmail: "alex@example.com",
      amount: { currency: "USD", minor: 4999 },
      providerStatus: "succeeded",
      providerRefs: expect.arrayContaining([
        expect.objectContaining({ type: "checkout_session", livemode: false }),
        expect.objectContaining({ type: "payment_intent", id: "pi_1" }),
      ]),
    });
    expect(
      calls.every(
        (request) =>
          request.headers.get("stripe-version") === STRIPE_API_VERSION,
      ),
    ).toBe(true);
    expect(
      calls.every((request) => request.headers.has("stripe-account") === false),
    ).toBe(true);
  });

  it("finds one paid manual standalone invoice when Checkout is absent", async () => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/invoices")
        return Response.json({
          data: [
            {
              id: "in_standalone",
              customer: "cus_1",
              livemode: false,
              status: "paid",
              paid: true,
              billing_reason: "manual",
              parent: {},
            },
          ],
          has_more: false,
        });
      if (path === "/v1/invoices/in_standalone")
        return Response.json({
          id: "in_standalone",
          customer: "cus_1",
          livemode: false,
          status: "paid",
          paid: true,
          created: 1,
          description: "Northstar Toolkit",
        });
      if (path === "/v1/invoice_payments")
        return Response.json({
          data: [
            {
              id: "inpay_1",
              invoice: "in_standalone",
              livemode: false,
              status: "paid",
              payment: { type: "payment_intent", payment_intent: "pi_1" },
            },
          ],
          has_more: false,
        });
      if (path === "/v1/payment_intents/pi_1")
        return Response.json({
          id: "pi_1",
          livemode: false,
          status: "succeeded",
          currency: "usd",
          amount_received: 500,
        });
      if (path === "/v1/customers/cus_1")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      client.findOrder(binding, "alex@example.com"),
    ).resolves.toMatchObject({
      orderId: "in_standalone",
      amount: { currency: "USD", minor: 500 },
    });
  });

  it.each([
    { name: "has no paid standalone invoice", invoices: [] },
    {
      name: "only has a subscription invoice",
      invoices: [
        {
          id: "in_subscription",
          customer: "cus_1",
          livemode: false,
          status: "paid",
          billing_reason: "subscription_create",
          subscription: "sub_1",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      ],
    },
  ])("returns no email-only order when $name", async ({ invoices }) => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/invoices")
        return Response.json({ data: invoices, has_more: false });
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      client.findOrder(binding, "alex@example.com"),
    ).resolves.toBeUndefined();
  });

  it("fails closed when email-only standalone invoices are ambiguous", async () => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/invoices")
        return Response.json({
          data: ["in_one", "in_two"].map((id) => ({
            id,
            customer: "cus_1",
            livemode: false,
            status: "paid",
            billing_reason: "manual",
            parent: {},
          })),
          has_more: false,
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(client.findOrder(binding, "alex@example.com")).rejects.toThrow(
      "standalone invoice lookup is ambiguous",
    );
  });

  it("rejects a live resource returned by fake HTTP", async () => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId, livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: true }],
          has_more: false,
        });
      return Response.json({ data: [], has_more: false });
    });
    await expect(
      client.findOrder(binding, "alex@example.com"),
    ).resolves.toBeUndefined();
  });

  it("maps subscription Invoice Payments and enforces exact history, quote, create and retrieval contracts", async () => {
    const requests: Request[] = [];
    const client = new StripeClient(config, async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      const path = url.pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId, livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/subscriptions")
        return Response.json({
          data: [
            {
              id: "sub_1",
              customer: "cus_1",
              latest_invoice: "in_1",
              livemode: false,
              status: "active",
              items: {
                data: [
                  {
                    current_period_end: 2,
                    price: {
                      id: "price_1",
                      nickname: "Synthetic recurring",
                      currency: "usd",
                      unit_amount: 1299,
                      recurring: { interval: "month", interval_count: 1 },
                    },
                    quantity: 1,
                  },
                ],
              },
            },
          ],
          has_more: false,
        });
      if (path === "/v1/invoices/in_1")
        return Response.json({
          id: "in_1",
          customer: "cus_1",
          livemode: false,
          status: "paid",
          paid: true,
        });
      if (path === "/v1/invoice_payments")
        return Response.json({
          data: [
            {
              id: "inpay_1",
              invoice: "in_1",
              livemode: false,
              status: "paid",
              payment: { type: "payment_intent", payment_intent: "pi_1" },
            },
          ],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "cs_1",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_1",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/payment_intents/pi_1")
        return Response.json({
          id: "pi_1",
          livemode: false,
          currency: "usd",
          amount_received: 4999,
          status: "succeeded",
        });
      if (path === "/v1/checkout/sessions/cs_1/line_items")
        return Response.json({
          data: [
            { description: "Synthetic purchase", price: { product: "prod_1" } },
          ],
          has_more: false,
        });
      if (path === "/v1/refunds" && request.method === "GET")
        return Response.json({
          data: [
            {
              id: "re_old",
              currency: "usd",
              amount: 999,
              reason: "requested_by_customer",
              created: 3,
              status: "succeeded",
            },
          ],
          has_more: false,
        });
      if (path === "/v1/refunds" && request.method === "POST")
        return Response.json({
          id: "re_new",
          currency: "usd",
          amount: 2000,
          created: 4,
          status: "pending",
          metadata: {
            support_case_id: "case_1",
            command_fingerprint: "fingerprint_1",
          },
        });
      if (path === "/v1/refunds/re_new")
        return Response.json({
          id: "re_new",
          currency: "usd",
          amount: 2000,
          created: 4,
          status: "succeeded",
          metadata: {
            support_case_id: "case_1",
            command_fingerprint: "fingerprint_1",
          },
        });
      throw new Error(`unexpected ${request.method} ${path}`);
    });
    await expect(
      client.findSubscription(binding, "alex@example.com"),
    ).resolves.toMatchObject({
      subscriptionId: "sub_1",
      providerRefs: expect.arrayContaining([
        expect.objectContaining({ type: "invoice", id: "in_1" }),
        expect.objectContaining({ type: "invoice_payment", id: "inpay_1" }),
        expect.objectContaining({ type: "payment_intent", id: "pi_1" }),
      ]),
      amount: { currency: "USD", minor: 1299 },
      renewsAt: "1970-01-01T00:00:02.000Z",
    });
    const command = {
      binding,
      approvalCaseId: "case_1",
      orderId: "cs_1",
      amount: { currency: "USD", minor: 2000 },
      reason: "duplicate charge",
      idempotencyKey: "stable-key-1",
      fingerprint: "fingerprint_1",
    };
    await expect(
      client.refunds(binding, "cs_1", "alex@example.com"),
    ).resolves.toMatchObject([
      { refundId: "re_old", amount: { currency: "USD", minor: 999 } },
    ]);
    await expect(
      client.quoteRefund(command, "alex@example.com"),
    ).resolves.toMatchObject({
      approvedAmount: command.amount,
      remainingAmount: { currency: "USD", minor: 4000 },
    });
    await expect(
      client.createRefund(command, "alex@example.com"),
    ).resolves.toMatchObject({
      refundId: "re_new",
      status: "pending",
      idempotencyKey: "stable-key-1",
    });
    await expect(
      client.retrieveRefund(binding, "re_new", "cs_1", "stable-key-1", {
        caseId: "case_1",
        fingerprint: "fingerprint_1",
        amountMinor: 2000,
        currency: "USD",
      }),
    ).resolves.toMatchObject({
      refundId: "re_new",
      status: "succeeded",
      replayed: true,
    });
    const create = requests.find(
      (request) =>
        new URL(request.url).pathname === "/v1/refunds" &&
        request.method === "POST",
    );
    expect(create?.headers.get("idempotency-key")).toBe("stable-key-1");
    expect(await create?.text()).toContain("amount=2000");
  });

  it("refuses over-refunds before a Stripe POST", async () => {
    let posts = 0;
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (request.method === "POST") posts += 1;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId, livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "cs_1",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_1",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/payment_intents/pi_1")
        return Response.json({
          id: "pi_1",
          livemode: false,
          currency: "usd",
          amount_received: 1000,
          status: "succeeded",
        });
      if (path === "/v1/checkout/sessions/cs_1/line_items")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds")
        return Response.json({
          data: [
            {
              id: "re_old",
              livemode: false,
              currency: "usd",
              amount: 900,
              reason: "requested_by_customer",
              created: 1,
              status: "succeeded",
            },
          ],
          has_more: false,
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      client.quoteRefund(
        {
          binding,
          approvalCaseId: "case_1",
          orderId: "cs_1",
          amount: { currency: "USD", minor: 101 },
          reason: "duplicate",
          idempotencyKey: "key",
          fingerprint: "fp",
        },
        "alex@example.com",
      ),
    ).rejects.toThrow("remaining balance");
    expect(posts).toBe(0);
  });

  it("rejects incomplete Checkout and unpaid InvoicePayment targets before a refund can be quoted", async () => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "cs_unpaid",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_1",
              status: "open",
              payment_status: "unpaid",
              livemode: false,
            },
          ],
          has_more: false,
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(client.findOrder(binding, "alex@example.com")).rejects.toThrow(
      "complete and paid",
    );
  });

  it.each([
    {
      name: "an InvoicePayment belonging to a different Invoice",
      payment: {
        id: "inpay_wrong_invoice",
        invoice: "in_other",
        status: "paid",
        payment: { type: "payment_intent", payment_intent: "pi_1" },
        livemode: false,
      },
    },
    {
      name: "an unpaid InvoicePayment for the selected Invoice",
      payment: {
        id: "inpay_unpaid",
        invoice: "in_1",
        status: "open",
        paid: false,
        payment: { type: "payment_intent", payment_intent: "pi_1" },
        livemode: false,
      },
    },
  ])(
    "rejects $name before choosing a refund PaymentIntent",
    async ({ payment }) => {
      let posts = 0;
      const client = new StripeClient(config, async (request) => {
        const path = new URL(request.url).pathname;
        if (request.method === "POST") posts += 1;
        if (path === "/v1/account")
          return Response.json({ id: config.accountId, livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
            has_more: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({
            data: [
              {
                id: "sub_1",
                customer: "cus_1",
                latest_invoice: "in_1",
                status: "active",
                livemode: false,
                items: {
                  data: [
                    {
                      current_period_end: 2,
                      price: {
                        id: "price_1",
                        currency: "usd",
                        unit_amount: 1000,
                        recurring: { interval: "month", interval_count: 1 },
                      },
                      quantity: 1,
                    },
                  ],
                },
              },
            ],
            has_more: false,
          });
        if (path === "/v1/invoices/in_1")
          return Response.json({
            id: "in_1",
            customer: "cus_1",
            status: "paid",
            paid: true,
            livemode: false,
          });
        if (path === "/v1/invoice_payments")
          return Response.json({ data: [payment], has_more: false });
        throw new Error(`unexpected ${request.method} ${path}`);
      });
      await expect(
        client.findSubscription(binding, "alex@example.com"),
      ).rejects.toThrow("exactly one PaymentIntent");
      expect(posts).toBe(0);
    },
  );

  it("keeps an undocumented provider state recoverable instead of claiming a failed or issued refund", async () => {
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: config.accountId });
      if (path === "/v1/refunds/re_unknown")
        return Response.json({
          id: "re_unknown",
          livemode: false,
          currency: "usd",
          amount: 1000,
          created: 1,
          status: "requires_action",
          metadata: { support_case_id: "case_1", command_fingerprint: "fp" },
        });
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      client.retrieveRefund(binding, "re_unknown", "cs_1", "key", {
        caseId: "case_1",
        fingerprint: "fp",
        amountMinor: 1000,
        currency: "USD",
      }),
    ).resolves.toMatchObject({
      status: "unknown",
      providerStatus: "requires_action",
    });
  });

  it.each([true, "false", null])(
    "rejects an explicit non-test Refund livemode value of %j",
    async (livemode) => {
      const client = new StripeClient(config, async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: config.accountId });
        if (path === "/v1/refunds/re_live")
          return Response.json({
            id: "re_live",
            livemode,
            currency: "usd",
            amount: 1000,
            created: 1,
            status: "succeeded",
            metadata: { support_case_id: "case_1", command_fingerprint: "fp" },
          });
        throw new Error(`unexpected ${path}`);
      });
      await expect(
        client.retrieveRefund(binding, "re_live", "cs_1", "key", {
          caseId: "case_1",
          fingerprint: "fp",
          amountMinor: 1000,
          currency: "USD",
        }),
      ).rejects.toThrow();
    },
  );

  it("runs the last refund fence after account verification and before its first POST", async () => {
    const calls: string[] = [];
    const client = new StripeClient(config, async (request) => {
      const path = new URL(request.url).pathname;
      calls.push(`${request.method}:${path}`);
      if (path === "/v1/account")
        return Response.json({ id: config.accountId, livemode: false });
      if (path === "/v1/refunds") throw new Error("stale worker posted");
      throw new Error(`unexpected ${request.method} ${path}`);
    });
    await expect(
      client.createRefundForRequest(
        {
          binding,
          approvalCaseId: "case_1",
          orderId: "order_1",
          amount: { currency: "USD", minor: 2000 },
          reason: "requested_by_customer",
          idempotencyKey: "refund:case_1",
          fingerprint: "refund-fingerprint",
        },
        { paymentIntentId: "pi_1", providerRefs: [] },
        async () => {
          expect(calls).toEqual(["GET:/v1/account"]);
          throw new Error("stale dispatch lease");
        },
      ),
    ).rejects.toThrow("stale dispatch lease");
    expect(calls).toEqual(["GET:/v1/account"]);
  });

  it("runs the cancellation fence directly before its first POST", async () => {
    const calls: string[] = [];
    const client = new StripeClient(config, async (request) => {
      calls.push(`${request.method}:${new URL(request.url).pathname}`);
      throw new Error("stale worker posted");
    });
    await expect(
      client.createSubscriptionCancellation(
        {
          caseId: "case_1",
          turnId: "turn_1",
          ownerId: "customer-alex",
          binding,
          subscriptionId: "sub_1",
          cancellationMode: "period_end",
          sourceMessageId: "message_1",
          sourceMessageHash: "message-hash",
          idempotencyKey: "cancel:case_1",
          fingerprint: "cancel-fingerprint",
        },
        async () => {
          expect(calls).toEqual([]);
          throw new Error("stale dispatch lease");
        },
      ),
    ).rejects.toThrow("stale dispatch lease");
    expect(calls).toEqual([]);
  });
});
