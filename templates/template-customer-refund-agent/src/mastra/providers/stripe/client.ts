import { createHash } from "node:crypto";
import { z } from "zod";
import {
  money,
  refundFingerprint,
  subscriptionCreditFingerprint,
} from "../../lib/money";
import type {
  CommerceOrder,
  CommerceRefund,
  CommerceSubscription,
  ProviderBinding,
  ProviderRef,
  RefundCommand,
  RefundEffect,
  RefundQuote,
  SubscriptionCancellationCommand,
  SubscriptionCancellationEffect,
  SubscriptionCreditCommand,
  SubscriptionCreditEffect,
  SubscriptionCreditQuote,
} from "../contracts";
import { STRIPE_API_VERSION, type StripeSandboxConfig } from "./config";

const MAX_PAGES = 3;
const PAGE_SIZE = 25;
const TIMEOUT_MS = 8_000;
const stripeResource = z
  .object({ id: z.string(), livemode: z.literal(false) })
  .passthrough();
// The documented Refund object does not expose `livemode`, unlike the
// Customer, Checkout Session, PaymentIntent, Invoice, and Subscription reads
// that establish this restricted-key sandbox boundary. Accept only omitted or
// explicit false; explicit true and malformed values remain fail-closed.
const stripeRefundResource = z
  .object({ id: z.string(), livemode: z.literal(false).optional() })
  .passthrough();
const listSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  has_more: z.boolean().optional(),
});

export class StripeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly ambiguous = false,
    readonly diagnostic?: {
      code?: string;
      type?: string;
      requestId?: string;
    },
  ) {
    super(`Stripe request failed with HTTP ${status}.`);
  }
}

function ref(type: string, value: Record<string, unknown>): ProviderRef {
  const parsed =
    type === "refund"
      ? stripeRefundResource.parse(value)
      : stripeResource.parse(value);
  return {
    provider: "stripe",
    type,
    id: parsed.id,
    apiVersion: STRIPE_API_VERSION,
    livemode: false,
  };
}
function assertSandboxRefund(value: Record<string, unknown>) {
  if (value.livemode === true)
    throw new Error("Live Stripe refund response is forbidden.");
  stripeRefundResource.parse(value);
}
function asObject(value: unknown, name: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Stripe ${name} is malformed.`);
  return value as Record<string, unknown>;
}
function asId(value: unknown, name: string) {
  if (typeof value === "string" && value) return value;
  const object = asObject(value, name);
  if (typeof object.id !== "string" || !object.id)
    throw new Error(`Stripe ${name} has no id.`);
  return object.id;
}
function timestamp(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error("Stripe object timestamp is invalid.");
  return new Date(Number(value) * 1_000).toISOString();
}
function supportedMoney(currency: unknown, amount: unknown) {
  if (typeof currency !== "string" || !Number.isSafeInteger(amount))
    throw new Error("Stripe money fields are malformed.");
  return money(currency.toUpperCase(), Number(amount));
}
function status(value: unknown) {
  return typeof value === "string" ? value : "unknown";
}

/** A deliberately small fetch-only Stripe boundary. Responses are parsed but
 * never logged or stored raw, because they can contain payment metadata. */
export class StripeClient {
  private accountVerified?: Promise<void>;
  constructor(
    private readonly config: StripeSandboxConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    const method = (init.method ?? "GET").toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const target = new URL(path, `${this.config.apiBaseUrl}/`);
      if (
        target.origin !== this.config.apiBaseUrl ||
        !target.pathname.startsWith("/v1/")
      )
        throw new Error("Stripe request destination is invalid.");
      let response: Response;
      try {
        response = await this.fetchImpl(
          new Request(target, {
            ...init,
            redirect: "error",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${this.config.restrictedApiKey}`,
              "Stripe-Version": STRIPE_API_VERSION,
              ...(init.body
                ? { "Content-Type": "application/x-www-form-urlencoded" }
                : {}),
              ...init.headers,
            },
          }),
        );
      } catch {
        throw new StripeHttpError(0, method === "POST");
      }
      if (!response.ok) {
        // No provider body is propagated: it may contain customer/payment data.
        let body: Record<string, unknown> | undefined;
        try {
          const parsed = await response.clone().json();
          body =
            parsed && typeof parsed === "object"
              ? (parsed as Record<string, unknown>)
              : undefined;
        } catch {}
        const error = body?.error;
        const providerError =
          error && typeof error === "object"
            ? (error as Record<string, unknown>)
            : undefined;
        // These are deliberately allow-lists, not generic "safe string"
        // checks. Error bodies can contain arbitrary provider echoes.
        const code = (value: unknown) =>
          typeof value === "string" &&
          new Set([
            "amount_too_large",
            "charge_already_refunded",
            "charge_disputed",
            "charge_expired_for_capture",
            "charge_not_refundable",
            "idempotency_key_in_use",
            "parameter_invalid_empty",
            "parameter_invalid_integer",
            "parameter_invalid_string_blank",
            "resource_missing",
          ]).has(value)
            ? value
            : undefined;
        const type = (value: unknown) =>
          typeof value === "string" &&
          new Set([
            "api_error",
            "card_error",
            "idempotency_error",
            "invalid_request_error",
          ]).has(value)
            ? value
            : undefined;
        const requestId = (value: unknown) =>
          typeof value === "string" && /^req_[A-Za-z0-9]{1,64}$/.test(value)
            ? value
            : undefined;
        throw new StripeHttpError(
          response.status,
          method === "POST" &&
            (response.status === 408 || response.status >= 500),
          {
            code: code(providerError?.code),
            type: type(providerError?.type),
            requestId: requestId(response.headers.get("request-id")),
          },
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new StripeHttpError(response.status, method === "POST");
      }
      return asObject(body, "response");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async list(path: string, params: URLSearchParams) {
    const items: Record<string, unknown>[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams(params);
      query.set("limit", String(PAGE_SIZE));
      if (startingAfter) query.set("starting_after", startingAfter);
      const value = listSchema.parse(await this.request(`${path}?${query}`));
      items.push(...value.data);
      if (!value.has_more || value.data.length === 0) return items;
      startingAfter = asId(value.data.at(-1), "list item");
    }
    // A partial refund history can approve an over-refund. Never convert a
    // pagination safety bound into a silently incomplete financial answer.
    throw new Error("Stripe pagination exceeded the configured safety bound.");
  }

  private assertBinding(binding: ProviderBinding) {
    if (
      binding.providerKind !== "stripe" ||
      binding.tenantId !== this.config.tenantId ||
      binding.providerAccountId !== this.config.accountId
    )
      throw new Error(
        "Stripe binding is not configured for this tenant/account.",
      );
  }
  private async assertConfiguredAccount() {
    this.accountVerified ??= (async () => {
      const account = await this.request("/v1/account");
      // Account objects identify the credential account but, unlike ordinary
      // resources, do not reliably include livemode. Resource reads and the
      // test-only key configuration provide the sandbox proof here.
      if (account.id !== this.config.accountId || account.livemode === true)
        throw new Error(
          "Stripe credential account is not the configured test account.",
        );
    })();
    return this.accountVerified;
  }

  async findOrder(
    binding: ProviderBinding,
    email: string,
    orderId?: string,
  ): Promise<CommerceOrder | undefined> {
    this.assertBinding(binding);
    await this.assertConfiguredAccount();
    let customerId: string | undefined;
    if (email) {
      const customers = await this.list(
        "/v1/customers",
        new URLSearchParams({ email }),
      );
      const exact = customers.filter(
        (value) =>
          value.livemode === false &&
          String(value.email ?? "").toLowerCase() === email.toLowerCase(),
      );
      if (exact.length > 1)
        throw new Error(
          "Stripe customer lookup is ambiguous; an explicit resource id is required.",
        );
      customerId = exact[0] ? asId(exact[0], "Customer") : undefined;
      if (!customerId) return undefined;
    }
    const sessions = await this.list(
      "/v1/checkout/sessions",
      new URLSearchParams(customerId ? { customer: customerId } : {}),
    );
    const candidates = sessions.filter(
      (session) =>
        session.livemode === false &&
        (orderId
          ? session.id === orderId || session.payment_intent === orderId
          : true) &&
        (!customerId || asId(session.customer, "Customer") === customerId),
    );
    if (candidates.length > 1 && !orderId)
      throw new Error(
        "Stripe customer lookup is ambiguous; an explicit Checkout or PaymentIntent id is required.",
      );
    const session = candidates[0];
    if (!session) {
      if (orderId)
        return this.findInvoiceOrder(binding, email, customerId, orderId);
      return customerId
        ? this.findStandaloneInvoiceOrder(binding, email, customerId)
        : undefined;
    }
    if (session.status !== "complete" || session.payment_status !== "paid")
      throw new Error("Stripe Checkout Session is not complete and paid.");
    const customer = asObject(
      session.customer_details ?? {},
      "customer details",
    );
    if (
      email &&
      String(customer.email ?? "").toLowerCase() !== email.toLowerCase()
    )
      throw new Error(
        "Stripe Checkout Session does not belong to the verified customer.",
      );
    const paymentIntentId = asId(session.payment_intent, "PaymentIntent");
    const paymentIntent = await this.request(
      `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    );
    if (paymentIntent.livemode !== false || session.livemode !== false)
      throw new Error("Live Stripe resources are forbidden.");
    const lines = await this.list(
      `/v1/checkout/sessions/${encodeURIComponent(asId(session, "Checkout Session"))}/line_items`,
      new URLSearchParams(),
    );
    const product =
      lines
        .map((line) =>
          String(
            asObject(line.price ?? {}, "line price").product ??
              line.description ??
              "Stripe purchase",
          ),
        )
        .join(", ") || "Stripe purchase";
    return {
      orderId: asId(session, "Checkout Session"),
      customerEmail: String(customer.email ?? "").toLowerCase(),
      product,
      amount: supportedMoney(
        paymentIntent.currency,
        paymentIntent.amount_received ?? paymentIntent.amount,
      ),
      // Stripe payment settlement is not a fulfillment/shipping signal.
      status: "processing",
      chargeCount: 1,
      placedAt: timestamp(session.created),
      providerStatus: status(paymentIntent.status),
      providerRefs: [
        ref("checkout_session", session),
        ref("payment_intent", paymentIntent),
      ],
    };
  }

  /** Paid standalone invoices support API-created purchases. This path is
   * narrower than a checkout lookup: subscription invoices are never selected
   * from an email alone. */
  private async findStandaloneInvoiceOrder(
    binding: ProviderBinding,
    email: string,
    customerId: string,
  ): Promise<CommerceOrder | undefined> {
    const invoices = await this.list(
      "/v1/invoices",
      new URLSearchParams({ customer: customerId }),
    );
    const candidates = invoices.filter(
      (invoice) =>
        invoice.livemode === false &&
        asId(invoice.customer, "Invoice customer") === customerId &&
        (invoice.status === "paid" || invoice.paid === true) &&
        invoice.billing_reason === "manual" &&
        !invoice.subscription &&
        !asObject(invoice.parent ?? {}, "Invoice parent").subscription_details,
    );
    if (candidates.length === 0) return undefined;
    if (candidates.length > 1)
      throw new Error(
        "Stripe standalone invoice lookup is ambiguous; an explicit Invoice id is required.",
      );
    return this.findInvoiceOrder(
      binding,
      email,
      customerId,
      asId(candidates[0], "Invoice"),
    );
  }

  /** An InvoicePayment is the authoritative bridge from a subscription invoice
   * to the actual PaymentIntent that can be refunded. Checkout is not present
   * for ordinary subscription renewals. */
  private async findInvoiceOrder(
    binding: ProviderBinding,
    email: string,
    customerId: string | undefined,
    orderId: string,
  ): Promise<CommerceOrder | undefined> {
    const invoice = await this.request(
      `/v1/invoices/${encodeURIComponent(orderId)}`,
    ).catch((error: unknown) => {
      if (error instanceof StripeHttpError && error.status === 404)
        return undefined;
      throw error;
    });
    if (!invoice) return undefined;
    if (invoice.livemode !== false)
      throw new Error("Live Stripe resources are forbidden.");
    const invoiceCustomer = asId(invoice.customer, "Invoice customer");
    if (customerId && invoiceCustomer !== customerId)
      throw new Error(
        "Stripe Invoice does not belong to the verified customer.",
      );
    if (invoice.status !== "paid" && invoice.paid !== true)
      throw new Error("Stripe Invoice is not paid and cannot be refunded.");
    const payments = (
      await this.list(
        "/v1/invoice_payments",
        new URLSearchParams({ invoice: asId(invoice, "Invoice") }),
      )
    ).filter(
      (payment) =>
        payment.livemode === false &&
        asId(payment.invoice, "InvoicePayment invoice") ===
          asId(invoice, "Invoice") &&
        (payment.status === "paid" || payment.paid === true),
    );
    const intentIds = [
      ...new Set(
        payments.map((payment) => this.invoicePaymentIntentId(payment)),
      ),
    ];
    if (intentIds.length !== 1)
      throw new Error(
        "Stripe InvoicePayment mapping is ambiguous; exactly one PaymentIntent is required.",
      );
    const paymentIntent = await this.request(
      `/v1/payment_intents/${encodeURIComponent(intentIds[0])}`,
    );
    if (
      paymentIntent.livemode !== false ||
      paymentIntent.status !== "succeeded"
    )
      throw new Error(
        "Stripe InvoicePayment does not reference a paid test PaymentIntent.",
      );
    // History may start from an immutable invoice id rather than a Checkout
    // session. Resolve the invoice's customer and then verify the supplied
    // case email when one is available; never accept an unbound invoice just
    // because the history caller did not have a Checkout-shaped target.
    const customer = await this.request(
      `/v1/customers/${encodeURIComponent(customerId ?? invoiceCustomer)}`,
    );
    const customerEmail = String(customer?.email ?? email).toLowerCase();
    if (!customerEmail || (email && customerEmail !== email.toLowerCase()))
      throw new Error(
        "Stripe Invoice does not belong to the verified customer.",
      );
    return {
      orderId: asId(invoice, "Invoice"),
      customerEmail,
      product: String(invoice.description ?? "Stripe invoice"),
      amount: supportedMoney(
        paymentIntent.currency,
        paymentIntent.amount_received ?? paymentIntent.amount,
      ),
      status: "processing",
      chargeCount: 1,
      placedAt: timestamp(invoice.created),
      providerStatus: status(paymentIntent.status),
      providerRefs: [
        ref("invoice", invoice),
        ...payments.map((payment) => ref("invoice_payment", payment)),
        ref("payment_intent", paymentIntent),
      ],
    };
  }

  private invoicePaymentIntentId(invoicePayment: Record<string, unknown>) {
    const payment = invoicePayment.payment;
    if (typeof invoicePayment.payment_intent === "string")
      return invoicePayment.payment_intent;
    const paymentRecord = asObject(payment, "InvoicePayment payment");
    if (typeof paymentRecord.payment_intent === "string")
      return paymentRecord.payment_intent;
    if (
      typeof paymentRecord.id === "string" &&
      paymentRecord.type === "payment_intent"
    )
      return paymentRecord.id;
    throw new Error("Stripe InvoicePayment has no PaymentIntent.");
  }

  async findSubscription(
    binding: ProviderBinding,
    email: string,
  ): Promise<CommerceSubscription | undefined> {
    this.assertBinding(binding);
    await this.assertConfiguredAccount();
    const customers = await this.list(
      "/v1/customers",
      new URLSearchParams({ email }),
    );
    const customer = customers.filter(
      (value) =>
        value.livemode === false &&
        String(value.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (customer.length > 1)
      throw new Error(
        "Stripe customer lookup is ambiguous; use an explicit resource id.",
      );
    if (!customer[0]) return undefined;
    const subscriptions = await this.list(
      "/v1/subscriptions",
      new URLSearchParams({
        customer: asId(customer[0], "Customer"),
        status: "all",
      }),
    );
    const candidates = subscriptions.filter(
      (value) => value.livemode === false,
    );
    if (candidates.length > 1)
      throw new Error(
        "Stripe subscription lookup is ambiguous; an explicit resource id is required.",
      );
    const subscription = candidates[0];
    if (!subscription) return undefined;
    const invoiceId = asId(subscription.latest_invoice, "Invoice");
    const invoice = await this.request(
      `/v1/invoices/${encodeURIComponent(invoiceId)}`,
    );
    if (invoice.livemode !== false)
      throw new Error("Live Stripe resources are forbidden.");
    if (invoice.status !== "paid" && invoice.paid !== true)
      throw new Error("Stripe Invoice is not paid and cannot be refunded.");
    const invoicePayments = await this.list(
      "/v1/invoice_payments",
      new URLSearchParams({ invoice: invoiceId }),
    );
    const invoicePaymentRecords = invoicePayments.filter(
      (payment) =>
        payment.livemode === false &&
        asId(payment.invoice, "InvoicePayment invoice") === invoiceId &&
        (payment.status === "paid" || payment.paid === true),
    );
    const paymentIntentIds = [
      ...new Set(
        invoicePaymentRecords.map((payment) =>
          this.invoicePaymentIntentId(payment),
        ),
      ),
    ];
    if (paymentIntentIds.length !== 1)
      throw new Error(
        "Stripe InvoicePayment mapping is ambiguous; exactly one PaymentIntent is required.",
      );
    const paymentIntent = await this.request(
      `/v1/payment_intents/${encodeURIComponent(paymentIntentIds[0])}`,
    );
    if (
      paymentIntent.livemode !== false ||
      paymentIntent.status !== "succeeded"
    )
      throw new Error("Live Stripe resources are forbidden.");
    const items = asObject(subscription.items, "subscription items").data;
    if (!Array.isArray(items) || !items[0])
      throw new Error("Stripe subscription has no price item.");
    if (items.length !== 1)
      throw new Error("Stripe subscription price mapping is ambiguous.");
    const item = asObject(items[0], "subscription item");
    const price = asObject(item.price, "subscription price");
    const recurring = asObject(price.recurring, "subscription price recurring");
    if (
      (recurring.interval !== "month" && recurring.interval !== "year") ||
      !Number.isSafeInteger(recurring.interval_count ?? 1) ||
      Number(recurring.interval_count ?? 1) <= 0 ||
      !Number.isSafeInteger(item.quantity ?? 1) ||
      Number(item.quantity ?? 1) <= 0
    )
      throw new Error("Stripe subscription billing terms are malformed.");
    const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
    return {
      subscriptionId: asId(subscription, "Subscription"),
      customerId: asId(customer[0], "Customer"),
      customerEmail: String(customer[0].email).toLowerCase(),
      plan: String(price.nickname ?? price.id ?? "Stripe subscription"),
      recurringInterval: recurring.interval,
      recurringIntervalCount: Number(recurring.interval_count ?? 1),
      quantity: Number(item.quantity ?? 1),
      amount: supportedMoney(price.currency, price.unit_amount),
      status:
        status(subscription.status) === "active"
          ? "active"
          : status(subscription.status) === "past_due"
            ? "past_due"
            : "cancelled",
      renewsAt: timestamp(item.current_period_end),
      ...(cancelAtPeriodEnd
        ? {
            cancelAtPeriodEnd: true as const,
            cancelsAt: timestamp(item.current_period_end),
          }
        : {}),
      providerStatus: status(subscription.status),
      providerRefs: [
        ref("customer", customer[0]),
        ref("subscription", subscription),
        ref("invoice", invoice),
        ...invoicePaymentRecords.map((payment) =>
          ref("invoice_payment", payment),
        ),
        ref("payment_intent", paymentIntent),
      ],
    };
  }

  async refunds(
    binding: ProviderBinding,
    orderId: string,
    email = "",
  ): Promise<CommerceRefund[]> {
    this.assertBinding(binding);
    await this.assertConfiguredAccount();
    const order = await this.findOrder(binding, email, orderId);
    if (!order)
      throw new Error(
        "Stripe refund history requires a case-owned Checkout Session.",
      );
    const intent = order.providerRefs?.find(
      (item) => item.type === "payment_intent",
    );
    if (!intent)
      throw new Error("Stripe Checkout Session is missing its PaymentIntent.");
    const refunds = await this.list(
      "/v1/refunds",
      new URLSearchParams({ payment_intent: intent.id }),
    );
    return refunds.map((value) => {
      assertSandboxRefund(value);
      return {
        refundId: asId(value, "Refund"),
        orderId,
        amount: supportedMoney(value.currency, value.amount),
        reason: status(value.reason),
        issuedAt: timestamp(value.created),
        providerStatus: status(value.status),
      };
    });
  }

  async quoteRefund(command: RefundCommand, email = ""): Promise<RefundQuote> {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    const target = await this.resolveRefundTarget(command, email);
    return this.quoteRefundForTarget(command, target);
  }

  /** Verify the exact single monthly subscription before a credit is ever
   * proposed. A billing credit is owned by the customer, never the paid
   * invoice that happened to establish the subscription. */
  private async subscriptionCreditTarget(
    command: SubscriptionCreditCommand,
    email: string,
  ) {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    const subscription = await this.request(
      `/v1/subscriptions/${encodeURIComponent(command.subscriptionId)}`,
    );
    if (
      subscription.livemode !== false ||
      subscription.status !== "active" ||
      subscription.cancel_at_period_end === true
    )
      throw new Error(
        "Subscription credit requires an active Stripe test subscription.",
      );
    const customerId = asId(subscription.customer, "Subscription customer");
    if (customerId !== command.customerId)
      throw new Error(
        "Subscription credit customer does not match its immutable command.",
      );
    const customer = await this.subscriptionCreditCustomer(command, email);
    const items = asObject(subscription.items, "subscription items").data;
    if (!Array.isArray(items) || items.length !== 1)
      throw new Error(
        "Subscription credit requires exactly one subscription item.",
      );
    const item = asObject(items[0], "subscription item");
    const price = asObject(item.price, "subscription price");
    const recurring = asObject(price.recurring, "subscription price recurring");
    if (
      recurring.interval !== "month" ||
      (recurring.interval_count ?? 1) !== 1 ||
      (item.quantity ?? 1) !== 1 ||
      price.currency !== command.amount.currency.toLowerCase() ||
      price.unit_amount !== command.amount.minor
    )
      throw new Error(
        "Subscription credit must equal one monthly subscription charge.",
      );
    return { customerId, subscription, customer };
  }

  /** Recovery validates the durable customer and immutable balance receipt,
   * not a subscription's current lifecycle.  The subscription may be
   * cancelled or otherwise changed after a successful remote POST. */
  private async subscriptionCreditCustomer(
    command: SubscriptionCreditCommand,
    email: string,
  ) {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    const customer = await this.request(
      `/v1/customers/${encodeURIComponent(command.customerId)}`,
    );
    if (
      customer.livemode !== false ||
      asId(customer, "Customer") !== command.customerId ||
      String(customer.email ?? "").toLowerCase() !== email.toLowerCase()
    )
      throw new Error(
        "Stripe subscription credit does not belong to the verified customer.",
      );
    return customer;
  }

  private async assertNoPriorSubscriptionCredit(
    customerId: string,
    command: SubscriptionCreditCommand,
  ) {
    const transactions = await this.list(
      `/v1/customers/${encodeURIComponent(customerId)}/balance_transactions`,
      new URLSearchParams(),
    );
    const prior = transactions.some((value) => {
      const metadata = value.metadata;
      return (
        value.livemode === false &&
        metadata !== null &&
        typeof metadata === "object" &&
        !Array.isArray(metadata) &&
        (metadata as Record<string, unknown>).subscription_id ===
          command.subscriptionId &&
        (metadata as Record<string, unknown>).command_fingerprint !==
          command.fingerprint
      );
    });
    if (prior)
      throw new Error(
        "A prior Stripe subscription credit exists for this customer and subscription and requires specialist review.",
      );
  }

  async quoteSubscriptionCredit(
    command: SubscriptionCreditCommand,
    email: string,
  ): Promise<SubscriptionCreditQuote> {
    if (subscriptionCreditFingerprint(command) !== command.fingerprint)
      throw new Error(
        "Subscription credit command fingerprint was tampered with.",
      );
    const target = await this.subscriptionCreditTarget(command, email);
    await this.assertNoPriorSubscriptionCredit(target.customerId, command);
    return {
      approvedAmount: command.amount,
      commandFingerprint: command.fingerprint,
    };
  }

  async createSubscriptionCredit(
    command: SubscriptionCreditCommand,
    email: string,
    beforeDispatch?: () => Promise<void>,
    /** Marks the exact point where a Stripe POST can begin. It must remain
     * synchronous and directly adjacent to request so callers can distinguish
     * a proven preflight refusal from an ambiguous provider outcome. */
    onPostBoundary?: () => void,
  ): Promise<SubscriptionCreditEffect> {
    if (subscriptionCreditFingerprint(command) !== command.fingerprint)
      throw new Error(
        "Subscription credit command fingerprint was tampered with.",
      );
    const target = await this.subscriptionCreditTarget(command, email);
    // A separate case can be approved after its quote. Re-read the durable
    // ledger immediately before the provider mutation so it cannot issue a
    // second compensation for the same customer and subscription.
    await this.assertNoPriorSubscriptionCredit(target.customerId, command);
    // This is deliberately after every awaited preflight and immediately
    // before the POST. The durable authorization must still be current at the
    // financial boundary, not merely before a slow ledger lookup.
    await beforeDispatch?.();
    onPostBoundary?.();
    const response = await this.request(
      `/v1/customers/${encodeURIComponent(target.customerId)}/balance_transactions`,
      {
        method: "POST",
        body: new URLSearchParams({
          amount: String(-command.amount.minor),
          currency: command.amount.currency.toLowerCase(),
          description: command.reason,
          "metadata[support_case_id]": command.approvalCaseId,
          "metadata[command_fingerprint]": command.fingerprint,
          "metadata[subscription_id]": command.subscriptionId,
        }),
        headers: { "Idempotency-Key": command.idempotencyKey },
      },
    );
    if (
      response.livemode !== false ||
      asId(response, "Customer balance transaction") === "" ||
      asId(response.customer, "Customer balance transaction customer") !==
        target.customerId ||
      response.amount !== -command.amount.minor ||
      String(response.currency).toUpperCase() !== command.amount.currency
    )
      throw new Error(
        "Stripe customer balance transaction does not match the immutable credit command.",
      );
    const metadata = asObject(
      response.metadata ?? {},
      "customer balance transaction metadata",
    );
    if (
      metadata.support_case_id !== command.approvalCaseId ||
      metadata.command_fingerprint !== command.fingerprint ||
      metadata.subscription_id !== command.subscriptionId
    )
      throw new Error(
        "Stripe customer balance transaction metadata is not bound to the immutable command.",
      );
    return {
      creditId: asId(response, "Customer balance transaction"),
      customerId: target.customerId,
      subscriptionId: command.subscriptionId,
      amount: command.amount,
      idempotencyKey: command.idempotencyKey,
      executedAt: timestamp(response.created),
      replayed: false,
      status: "succeeded",
      providerStatus: "created",
      providerRefs: [
        ref("customer_balance_transaction", response),
        ref("customer", target.customer),
        ref("subscription", target.subscription),
      ],
    };
  }

  async retrieveSubscriptionCredit(
    command: SubscriptionCreditCommand,
    email: string,
    creditId: string,
  ): Promise<SubscriptionCreditEffect> {
    await this.subscriptionCreditCustomer(command, email);
    const response = await this.request(
      `/v1/customers/${encodeURIComponent(command.customerId)}/balance_transactions/${encodeURIComponent(creditId)}`,
    );
    const metadata = asObject(
      response.metadata ?? {},
      "customer balance transaction metadata",
    );
    if (
      response.livemode !== false ||
      asId(response, "Customer balance transaction") !== creditId ||
      asId(response.customer, "Customer balance transaction customer") !==
        command.customerId ||
      response.amount !== -command.amount.minor ||
      String(response.currency).toUpperCase() !== command.amount.currency ||
      metadata.support_case_id !== command.approvalCaseId ||
      metadata.command_fingerprint !== command.fingerprint ||
      metadata.subscription_id !== command.subscriptionId
    )
      throw new Error(
        "Stripe customer balance transaction does not match the immutable credit command.",
      );
    return {
      creditId,
      customerId: command.customerId,
      subscriptionId: command.subscriptionId,
      amount: command.amount,
      idempotencyKey: command.idempotencyKey,
      executedAt: timestamp(response.created),
      replayed: true,
      status: "succeeded",
      providerStatus: "created",
      providerRefs: [ref("customer_balance_transaction", response)],
    };
  }

  /** Recovery deliberately searches Stripe's durable customer-balance ledger
   * by all immutable metadata. It never retries a POST: a missing receipt is
   * an unresolved financial state, not evidence that no remote effect exists. */
  async findSubscriptionCreditReceipt(
    command: SubscriptionCreditCommand,
    email: string,
  ): Promise<SubscriptionCreditEffect | undefined> {
    await this.subscriptionCreditCustomer(command, email);
    const transactions = await this.list(
      `/v1/customers/${encodeURIComponent(command.customerId)}/balance_transactions`,
      new URLSearchParams(),
    );
    const matches = transactions.filter((value) => {
      const metadata = value.metadata;
      return (
        value.livemode === false &&
        asId(value.customer, "Customer balance transaction customer") ===
          command.customerId &&
        value.amount === -command.amount.minor &&
        String(value.currency).toUpperCase() === command.amount.currency &&
        metadata !== null &&
        typeof metadata === "object" &&
        !Array.isArray(metadata) &&
        (metadata as Record<string, unknown>).support_case_id ===
          command.approvalCaseId &&
        (metadata as Record<string, unknown>).command_fingerprint ===
          command.fingerprint &&
        (metadata as Record<string, unknown>).subscription_id ===
          command.subscriptionId
      );
    });
    if (matches.length > 1)
      throw new Error(
        "Stripe balance transaction recovery is ambiguous for this immutable command.",
      );
    if (!matches[0]) return undefined;
    return this.retrieveSubscriptionCredit(
      command,
      email,
      asId(matches[0], "Customer balance transaction"),
    );
  }

  /** Resolve one owned paid PaymentIntent and use it for every pre-POST
   * validation.  A changed InvoicePayment association cannot make quote,
   * history, and POST refer to three different charges. */
  private async resolveRefundTarget(command: RefundCommand, email: string) {
    const order = await this.findOrder(command.binding, email, command.orderId);
    if (!order)
      throw new Error(
        `Cannot quote refund: order ${command.orderId} not found.`,
      );
    const paymentIntent = order.providerRefs?.find(
      (item) => item.type === "payment_intent",
    );
    if (!paymentIntent)
      throw new Error("Stripe order is missing its PaymentIntent.");
    return { order, paymentIntentId: paymentIntent.id };
  }

  private async quoteRefundForTarget(
    command: RefundCommand,
    target: { order: CommerceOrder; paymentIntentId: string },
  ): Promise<RefundQuote> {
    const { order } = target;
    if (
      !Number.isSafeInteger(command.amount.minor) ||
      command.amount.minor <= 0
    )
      throw new Error(
        "Refund amount must be a positive safe minor-unit value.",
      );
    if (order.providerStatus !== "succeeded")
      throw new Error("Refund requires a paid Stripe PaymentIntent.");
    if (order.amount.currency !== command.amount.currency)
      throw new Error("Refund currency does not match the original charge.");
    const refunded = (
      await this.refundsForPaymentIntent(target.paymentIntentId)
    )
      .filter(
        (refund) =>
          refund.providerStatus !== "failed" &&
          refund.providerStatus !== "canceled",
      )
      .reduce((total, refund) => total + refund.amount.minor, 0);
    const remaining = order.amount.minor - refunded;
    if (remaining < 0 || command.amount.minor > remaining)
      throw new Error("Refund exceeds the remaining balance.");
    return {
      approvedAmount: command.amount,
      remainingAmount: money(order.amount.currency, remaining),
      commandFingerprint: refundFingerprint(command),
    };
  }

  private async refundsForPaymentIntent(paymentIntentId: string) {
    const refunds = await this.list(
      "/v1/refunds",
      new URLSearchParams({ payment_intent: paymentIntentId }),
    );
    return refunds.map((value) => {
      assertSandboxRefund(value);
      return {
        refundId: asId(value, "Refund"),
        amount: supportedMoney(value.currency, value.amount),
        providerStatus: status(value.status),
      };
    });
  }

  /** Resolve and validate the one payment target before persisting the intent.
   * Recovery must never repeat this lookup after a possible remote POST. */
  async prepareRefundRequest(command: RefundCommand, email = "") {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    // Re-quote immediately before the first effect. A quote made before human
    // approval is advisory; another refund can settle while the decision waits.
    const target = await this.resolveRefundTarget(command, email);
    await this.quoteRefundForTarget(command, target);
    return {
      paymentIntentId: target.paymentIntentId,
      providerRefs: target.order.providerRefs ?? [],
    };
  }

  async createRefund(
    command: RefundCommand,
    email = "",
  ): Promise<RefundEffect> {
    return this.createRefundForRequest(
      command,
      await this.prepareRefundRequest(command, email),
    );
  }

  /** All reads that prove an owned active target happen before the known
   * mutation boundary. Their failure cannot have applied a cancellation. */
  async prepareSubscriptionCancellationRequest(
    command: SubscriptionCancellationCommand,
    email: string,
  ) {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    const subscription = await this.request(
      `/v1/subscriptions/${encodeURIComponent(command.subscriptionId)}`,
    );
    if (subscription.livemode !== false || subscription.status !== "active")
      throw new Error(
        "Cancellation requires an active Stripe test subscription.",
      );
    const customerId = asId(subscription.customer, "Subscription customer");
    const customer = await this.request(
      `/v1/customers/${encodeURIComponent(customerId)}`,
    );
    if (
      customer.livemode !== false ||
      String(customer.email ?? "").toLowerCase() !== email.toLowerCase()
    )
      throw new Error(
        "Stripe subscription does not belong to the verified customer.",
      );
  }

  /** This method begins with the Stripe POST. Callers use that boundary with
   * StripeHttpError.ambiguous to decide whether recovery is necessary. */
  async createSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
    beforeDispatch?: () => Promise<void>,
  ): Promise<SubscriptionCancellationEffect> {
    // `prepareSubscriptionCancellationRequest` has completed every remote
    // read by the time this boundary is reached.  Keep the durable authority
    // fence directly adjacent to the first possible POST.
    await beforeDispatch?.();
    const updated = await this.request(
      `/v1/subscriptions/${encodeURIComponent(command.subscriptionId)}`,
      {
        method: "POST",
        body: new URLSearchParams({ cancel_at_period_end: "true" }),
        headers: { "Idempotency-Key": command.idempotencyKey },
      },
    );
    if (
      updated.livemode !== false ||
      updated.cancel_at_period_end !== true ||
      asId(updated, "Subscription") !== command.subscriptionId
    )
      throw new Error(
        "Stripe did not schedule the requested period-end cancellation.",
      );
    const items = asObject(updated.items, "subscription items").data;
    if (!Array.isArray(items) || items.length !== 1)
      throw new Error("Stripe subscription cancellation period is ambiguous.");
    return {
      subscriptionId: command.subscriptionId,
      cancelAtPeriodEnd: true,
      cancelsAt: timestamp(
        asObject(items[0], "subscription item").current_period_end,
      ),
      idempotencyKey: command.idempotencyKey,
      replayed: false,
    };
  }

  async scheduleSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
    email: string,
  ): Promise<SubscriptionCancellationEffect> {
    await this.prepareSubscriptionCancellationRequest(command, email);
    return this.createSubscriptionCancellation(command);
  }

  async retrieveSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
    email: string,
  ): Promise<SubscriptionCancellationEffect | undefined> {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    const subscription = await this.request(
      `/v1/subscriptions/${encodeURIComponent(command.subscriptionId)}`,
    );
    if (
      subscription.livemode !== false ||
      subscription.cancel_at_period_end !== true
    )
      return undefined;
    const customer = await this.request(
      `/v1/customers/${encodeURIComponent(asId(subscription.customer, "Subscription customer"))}`,
    );
    if (
      customer.livemode !== false ||
      String(customer.email ?? "").toLowerCase() !== email.toLowerCase()
    )
      throw new Error(
        "Stripe subscription does not belong to the verified customer.",
      );
    const items = asObject(subscription.items, "subscription items").data;
    if (!Array.isArray(items) || items.length !== 1)
      throw new Error("Stripe subscription cancellation period is ambiguous.");
    return {
      subscriptionId: command.subscriptionId,
      cancelAtPeriodEnd: true,
      cancelsAt: timestamp(
        asObject(items[0], "subscription item").current_period_end,
      ),
      idempotencyKey: command.idempotencyKey,
      replayed: true,
    };
  }

  async createRefundForRequest(
    command: RefundCommand,
    request: { paymentIntentId: string; providerRefs: ProviderRef[] },
    beforeDispatch?: () => Promise<void>,
  ): Promise<RefundEffect> {
    this.assertBinding(command.binding);
    await this.assertConfiguredAccount();
    // Account verification is deliberately above this hook.  Callers install
    // their last durable authorization check here, leaving no provider read
    // between the fence and the mutation.
    await beforeDispatch?.();
    const payload = new URLSearchParams({
      payment_intent: request.paymentIntentId,
      amount: String(command.amount.minor),
      reason: "requested_by_customer",
      "metadata[support_case_id]": command.approvalCaseId,
      "metadata[command_fingerprint]": command.fingerprint,
    });
    const response = await this.request("/v1/refunds", {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": command.idempotencyKey },
    });
    assertSandboxRefund(response);
    if (
      response.amount !== command.amount.minor ||
      String(response.currency).toUpperCase() !== command.amount.currency
    )
      throw new Error(
        "Stripe refund response does not match the immutable amount or currency.",
      );
    const metadata = asObject(response.metadata ?? {}, "refund metadata");
    if (
      metadata.support_case_id !== command.approvalCaseId ||
      metadata.command_fingerprint !== command.fingerprint
    )
      throw new Error(
        "Stripe refund response does not match the immutable command metadata.",
      );
    const providerStatus = status(response.status);
    return {
      refundId: asId(response, "Refund"),
      orderId: command.orderId,
      amount: supportedMoney(response.currency, response.amount),
      idempotencyKey: command.idempotencyKey,
      executedAt: timestamp(response.created),
      replayed: false,
      status: refundEffectStatus(providerStatus),
      providerStatus,
      providerRefs: [ref("refund", response), ...request.providerRefs],
    };
  }

  async retrieveRefund(
    binding: ProviderBinding,
    refundId: string,
    orderId: string,
    idempotencyKey: string,
    expected?: {
      caseId: string;
      fingerprint: string;
      amountMinor: number;
      currency: string;
    },
  ): Promise<RefundEffect> {
    this.assertBinding(binding);
    await this.assertConfiguredAccount();
    const response = await this.request(
      `/v1/refunds/${encodeURIComponent(refundId)}`,
    );
    assertSandboxRefund(response);
    if (expected) {
      const metadata = asObject(response.metadata ?? {}, "refund metadata");
      if (
        metadata.support_case_id !== expected.caseId ||
        metadata.command_fingerprint !== expected.fingerprint ||
        response.amount !== expected.amountMinor ||
        String(response.currency).toUpperCase() !== expected.currency
      )
        throw new Error(
          "Stripe refund retrieval does not match the immutable attempt.",
        );
    }
    const providerStatus = status(response.status);
    return {
      refundId: asId(response, "Refund"),
      orderId,
      amount: supportedMoney(response.currency, response.amount),
      idempotencyKey,
      executedAt: timestamp(response.created),
      replayed: true,
      status: refundEffectStatus(providerStatus),
      providerStatus,
      providerRefs: [ref("refund", response)],
    };
  }

  /** Stable key-derived handle is only an audit identifier; it contains no secret. */
  attemptId(command: RefundCommand) {
    return createHash("sha256")
      .update(`${command.binding.providerAccountId}:${command.idempotencyKey}`)
      .digest("hex");
  }
}

/** Unknown and requires_action are never customer-visible pending success.
 * The terminal reconciler escalates them until a documented provider state is
 * observed. */
function refundEffectStatus(
  value: string,
): "pending" | "succeeded" | "failed" | "unknown" {
  if (value === "succeeded") return "succeeded";
  if (value === "pending") return "pending";
  if (value === "failed" || value === "canceled") return "failed";
  return "unknown";
}
