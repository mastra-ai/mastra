import type {
  CommerceOrder,
  CommerceProvider,
  CommerceRefund,
  CommerceSubscription,
  DeliveryReceipt,
  KnowledgeEvidence,
  KnowledgeProvider,
  ProviderBinding,
  ProviderRegistry,
  RefundCommand,
  RefundEffect,
  RefundQuote,
  SubscriptionCreditCommand,
  SubscriptionCreditEffect,
  SubscriptionCreditQuote,
  SubscriptionCancellationCommand,
  SubscriptionCancellationEffect,
  SupportChannelProvider,
  TransactionalActionProvider,
} from "../contracts";
import type { NativeRefundExecutionAuthorization } from "../native-execution";
import { sameBinding } from "../contracts";
import { z } from "zod";

const bindingSchema = z
  .object({
    tenantId: z.string().min(1),
    providerKind: z.enum(["local", "intercom", "stripe"]),
    providerAccountId: z.string().min(1),
    externalConversationId: z.string().min(1),
  })
  .strict();
const moneySchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    minor: z.number().int().safe().nonnegative(),
  })
  .strict();
const receiptSchema = z
  .object({
    receiptId: z.string().min(1),
    deliveredAt: z.iso.datetime(),
    providerMessageId: z.string().min(1).optional(),
  })
  .strict();
const effectSchema = z
  .object({
    refundId: z.string().min(1),
    orderId: z.string().min(1),
    amount: moneySchema,
    idempotencyKey: z.string().min(1),
    executedAt: z.iso.datetime(),
    replayed: z.boolean(),
  })
  .strict();
const quoteSchema = z
  .object({
    approvedAmount: moneySchema,
    remainingAmount: moneySchema,
    commandFingerprint: z.string().min(1),
  })
  .strict();
const subscriptionCreditEffectSchema = z
  .object({
    creditId: z.string().min(1),
    customerId: z.string().min(1),
    subscriptionId: z.string().min(1),
    amount: moneySchema,
    idempotencyKey: z.string().min(1),
    executedAt: z.iso.datetime(),
    replayed: z.boolean(),
  })
  .strict();
const subscriptionCreditQuoteSchema = z
  .object({
    approvedAmount: moneySchema,
    commandFingerprint: z.string().min(1),
  })
  .strict();
const orderSchema = z
  .object({
    orderId: z.string().min(1),
    customerEmail: z.string().min(1),
    product: z.string().min(1),
    amount: moneySchema,
    status: z.enum([
      "fulfilled",
      "shipped",
      "processing",
      "cancelled",
      "refunded",
    ]),
    chargeCount: z.number().int().nonnegative(),
    placedAt: z.iso.datetime(),
  })
  .strict();
const subscriptionSchema = z
  .object({
    subscriptionId: z.string().min(1),
    customerId: z.string().min(1).optional(),
    customerEmail: z.string().min(1),
    plan: z.string().min(1),
    recurringInterval: z.enum(["month", "year"]),
    recurringIntervalCount: z.number().int().positive(),
    quantity: z.number().int().positive(),
    amount: moneySchema,
    status: z.enum(["active", "cancelled", "past_due"]),
    renewsAt: z.iso.datetime(),
    cancelAtPeriodEnd: z.literal(true).optional(),
    cancelsAt: z.iso.datetime().optional(),
  })
  .strict();
const refundSchema = z
  .object({
    refundId: z.string().min(1),
    orderId: z.string().min(1),
    amount: moneySchema,
    reason: z.string().min(1),
    issuedAt: z.iso.datetime(),
  })
  .strict();
const evidenceSchema = z
  .object({
    title: z.string(),
    text: z.string(),
    source: z.string(),
    score: z.number().finite(),
    version: z.string(),
    // These belong to the source record.  The knowledge publication layer
    // deliberately refuses to invent an applicability window, so the
    // loopback contract must preserve them end-to-end.
    effectiveAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();
const knowledgeDocumentRefSchema = z
  .object({
    source: z.string().min(1),
    version: z.string().min(1),
    changedAt: z.iso.datetime(),
  })
  .strict();
const normalizedInboundSchema = z
  .object({
    binding: bindingSchema,
    externalId: z.string().min(1),
    source: z.enum(["mock-email", "chat", "intercom-conversation"]),
    customer: z
      .object({ email: z.string().min(1), name: z.string().optional() })
      .strict(),
    subject: z.string(),
    message: z
      .object({
        id: z.string().min(1),
        author: z.literal("customer"),
        authorName: z.string().optional(),
        body: z.string(),
        createdAt: z.iso.datetime(),
      })
      .strict(),
    rawPayload: z.record(z.string(), z.unknown()),
  })
  .strict();
const commandSchema = z
  .object({
    approvalCaseId: z.string().min(1),
    binding: bindingSchema,
    orderId: z.string().min(1),
    amount: moneySchema,
    reason: z.string().min(1),
    idempotencyKey: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();
const subscriptionCreditCommandSchema = z
  .object({
    approvalCaseId: z.string().min(1),
    binding: bindingSchema,
    customerId: z.string().min(1),
    subscriptionId: z.string().min(1),
    amount: moneySchema,
    reason: z.string().min(1),
    idempotencyKey: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();
const cancellationCommandSchema = z
  .object({
    caseId: z.string().min(1),
    turnId: z.string().min(1),
    ownerId: z.string().min(1),
    binding: bindingSchema,
    subscriptionId: z.string().min(1),
    cancellationMode: z.literal("period_end"),
    sourceMessageId: z.string().min(1),
    sourceMessageHash: z.string().min(1),
    idempotencyKey: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();
const nativeAuthorizationSchema = z
  .object({
    issuedAt: z.number().int(),
    nativeRunId: z.string().min(1),
    nativeToolCallId: z.string().min(1),
    commandFingerprint: z.string().min(1),
    caseId: z.string().min(1),
    turnId: z.string().min(1),
    dispatchId: z.string().min(1),
    leaseToken: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export type LoopbackFailure = "timeout" | "429" | "500" | "drop-after-commit";
export type LoopbackFetch = (request: Request) => Promise<Response>;
export type LoopbackFailureSelector = (
  request: Request,
) => LoopbackFailure | undefined;

/** Optional in-process HTTP boundary used to prove the local port contract. */
export function createLocalLoopbackFacade(
  provider: ProviderRegistry,
  failure?: LoopbackFailureSelector,
): LoopbackFetch {
  return async (request) => {
    try {
      const injected = failure?.(request);
      if (injected === "timeout") return new Promise(() => undefined);
      if (injected === "429")
        return Response.json({ error: "rate limited" }, { status: 429 });
      if (injected === "500")
        return Response.json({ error: "synthetic failure" }, { status: 500 });
      const parsedBody = z
        .object({ binding: bindingSchema })
        .passthrough()
        .safeParse(await request.json());
      if (!parsedBody.success)
        return Response.json(
          { error: "invalid provider binding" },
          { status: 400 },
        );
      const body = parsedBody.data;
      if (request.url.endsWith("/commerce/orders")) {
        const input = z
          .object({
            binding: bindingSchema,
            email: z.string(),
            orderId: z.string().optional(),
          })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid commerce order request" },
            { status: 400 },
          );
        const order = await provider
          .commerce(input.data.binding)
          .findOrder(input.data.binding, input.data.email, input.data.orderId);
        if (injected === "drop-after-commit")
          return new Promise(() => undefined);
        return Response.json(
          z.union([orderSchema, z.null()]).parse(order ?? null),
        );
      }
      if (request.url.endsWith("/commerce/subscriptions")) {
        const input = z
          .object({ binding: bindingSchema, email: z.string() })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid subscription request" },
            { status: 400 },
          );
        const subscription = await provider
          .commerce(input.data.binding)
          .findSubscription(input.data.binding, input.data.email);
        if (injected === "drop-after-commit")
          return new Promise(() => undefined);
        return Response.json(
          z.union([subscriptionSchema, z.null()]).parse(subscription ?? null),
        );
      }
      if (request.url.endsWith("/commerce/refunds")) {
        const input = z
          .object({ binding: bindingSchema, orderId: z.string().min(1) })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid refunds request" },
            { status: 400 },
          );
        const refunds = await provider
          .commerce(input.data.binding)
          .refunds(input.data.binding, input.data.orderId);
        if (injected === "drop-after-commit")
          return new Promise(() => undefined);
        return Response.json(z.array(refundSchema).parse(refunds));
      }
      if (request.url.endsWith("/support/normalize")) {
        const input = z
          .object({ binding: bindingSchema, payload: z.unknown() })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid normalize request" },
            { status: 400 },
          );
        return Response.json(
          normalizedInboundSchema.parse(
            await provider
              .support(input.data.binding)
              .normalizeInbound(input.data.payload),
          ),
        );
      }
      if (request.url.endsWith("/support/deliver")) {
        const input = z
          .object({
            binding: bindingSchema,
            body: z.string(),
            status: z.string().min(1),
            idempotencyKey: z.string().min(1).optional(),
          })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid delivery request" },
            { status: 400 },
          );
        return Response.json(
          receiptSchema.parse(
            await provider
              .support(input.data.binding)
              .deliver(
                input.data.binding,
                input.data.body,
                input.data.status,
                input.data.idempotencyKey,
              ),
          ),
        );
      }
      if (request.url.endsWith("/transactions/quote-refund")) {
        const checked = commandSchema.safeParse(body.command);
        if (!checked.success)
          return Response.json(
            { error: "invalid refund command" },
            { status: 400 },
          );
        const command = checked.data;
        if (!command?.binding || !sameBinding(body.binding, command.binding))
          return Response.json(
            {
              error:
                "transaction command binding does not match request binding",
            },
            { status: 400 },
          );
        return Response.json(
          quoteSchema.parse(
            await provider.transactions(body.binding).quoteRefund(command),
          ),
        );
      }
      if (request.url.endsWith("/transactions/issue-refund")) {
        const checked = commandSchema.safeParse(body.command);
        if (!checked.success)
          return Response.json(
            { error: "invalid refund command" },
            { status: 400 },
          );
        const command = checked.data;
        if (!command?.binding || !sameBinding(body.binding, command.binding))
          return Response.json(
            {
              error:
                "transaction command binding does not match request binding",
            },
            { status: 400 },
          );
        const authorization = nativeAuthorizationSchema.safeParse(
          body.authorization,
        );
        if (!authorization.success)
          return Response.json(
            { error: "missing or invalid native refund authorization" },
            { status: 403 },
          );
        const effect = await provider
          .transactions(body.binding)
          .issueRefund(command, authorization.data);
        if (injected === "drop-after-commit")
          return new Promise(() => undefined);
        return Response.json(effectSchema.parse(effect));
      }
      if (request.url.endsWith("/transactions/quote-subscription-credit")) {
        const checked = subscriptionCreditCommandSchema.safeParse(body.command);
        if (
          !checked.success ||
          !sameBinding(body.binding, checked.data.binding)
        )
          return Response.json(
            { error: "invalid subscription credit command" },
            { status: 400 },
          );
        return Response.json(
          subscriptionCreditQuoteSchema.parse(
            await provider
              .transactions(body.binding)
              .quoteSubscriptionCredit(checked.data),
          ),
        );
      }
      if (request.url.endsWith("/transactions/issue-subscription-credit")) {
        const checked = subscriptionCreditCommandSchema.safeParse(body.command);
        const authorization = nativeAuthorizationSchema.safeParse(
          body.authorization,
        );
        if (
          !checked.success ||
          !authorization.success ||
          !sameBinding(body.binding, checked.data.binding)
        )
          return Response.json(
            { error: "invalid subscription credit request" },
            { status: 400 },
          );
        const effect = await provider
          .transactions(body.binding)
          .issueSubscriptionCredit(checked.data, authorization.data);
        if (injected === "drop-after-commit")
          return new Promise(() => undefined);
        return Response.json(subscriptionCreditEffectSchema.parse(effect));
      }
      if (request.url.endsWith("/transactions/retrieve-subscription-credit")) {
        const checked = subscriptionCreditCommandSchema.safeParse(body.command);
        if (
          !checked.success ||
          !sameBinding(body.binding, checked.data.binding)
        )
          return Response.json(
            { error: "invalid subscription credit command" },
            { status: 400 },
          );
        return Response.json(
          subscriptionCreditEffectSchema
            .nullable()
            .parse(
              (await provider
                .transactions(body.binding)
                .retrieveSubscriptionCredit(checked.data)) ?? null,
            ),
        );
      }
      if (
        request.url.endsWith("/transactions/schedule-subscription-cancellation")
      ) {
        const checked = cancellationCommandSchema.safeParse(body.command);
        if (!checked.success)
          return Response.json(
            { error: "invalid subscription cancellation command" },
            { status: 400 },
          );
        const command = checked.data;
        if (!sameBinding(body.binding, command.binding))
          return Response.json(
            {
              error:
                "transaction command binding does not match request binding",
            },
            { status: 400 },
          );
        return Response.json(
          z
            .object({
              subscriptionId: z.string(),
              cancelAtPeriodEnd: z.literal(true),
              cancelsAt: z.iso.datetime(),
              idempotencyKey: z.string(),
              replayed: z.boolean(),
            })
            .parse(
              await provider
                .transactions(body.binding)
                .scheduleSubscriptionCancellation(command),
            ),
        );
      }
      if (
        request.url.endsWith("/transactions/retrieve-subscription-cancellation")
      ) {
        const checked = cancellationCommandSchema.safeParse(body.command);
        if (!checked.success)
          return Response.json(
            { error: "invalid subscription cancellation command" },
            { status: 400 },
          );
        const command = checked.data;
        if (!sameBinding(body.binding, command.binding))
          return Response.json(
            {
              error:
                "transaction command binding does not match request binding",
            },
            { status: 400 },
          );
        const effect = await provider
          .transactions(body.binding)
          .retrieveSubscriptionCancellation(command);
        return Response.json(
          z
            .object({
              subscriptionId: z.string(),
              cancelAtPeriodEnd: z.literal(true),
              cancelsAt: z.iso.datetime(),
              idempotencyKey: z.string(),
              replayed: z.boolean(),
            })
            .nullable()
            .parse(effect ?? null),
        );
      }
      if (request.url.endsWith("/knowledge/search")) {
        const input = z
          .object({
            binding: bindingSchema,
            query: z.string(),
            topK: z.number().int().positive(),
          })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid knowledge search request" },
            { status: 400 },
          );
        return Response.json(
          z
            .array(evidenceSchema)
            .parse(
              await provider
                .knowledge(input.data.binding)
                .search(input.data.binding, input.data.query, input.data.topK),
            ),
        );
      }
      if (request.url.endsWith("/knowledge/list-changed")) {
        const input = z
          .object({ binding: bindingSchema, since: z.string().optional() })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid knowledge list request" },
            { status: 400 },
          );
        return Response.json(
          z
            .array(knowledgeDocumentRefSchema)
            .parse(
              await provider
                .knowledge(input.data.binding)
                .listChanged(input.data.binding, input.data.since),
            ),
        );
      }
      if (request.url.endsWith("/knowledge/fetch-document")) {
        const input = z
          .object({ binding: bindingSchema, source: z.string().min(1) })
          .strict()
          .safeParse(body);
        if (!input.success)
          return Response.json(
            { error: "invalid document request" },
            { status: 400 },
          );
        return Response.json(
          z
            .union([evidenceSchema, z.null()])
            .parse(
              (await provider
                .knowledge(input.data.binding)
                .fetchDocument(input.data.binding, input.data.source)) ?? null,
            ),
        );
      }
      return Response.json({ error: "not found" }, { status: 404 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  };
}

/** HTTP adapters for all four local ports, kept opt-in for contract conformance. */
export class LoopbackHttpProviderRegistry implements ProviderRegistry {
  readonly kind = "local" as const;
  constructor(
    private readonly fetcher: LoopbackFetch,
    private readonly timeoutMs = 100,
  ) {}
  support(_binding: ProviderBinding): SupportChannelProvider {
    return new LoopbackHttpSupportProvider(this.fetcher, this.timeoutMs);
  }
  commerce(_binding: ProviderBinding): CommerceProvider {
    return new LoopbackHttpCommerceProvider(this.fetcher, this.timeoutMs);
  }
  transactions(_binding: ProviderBinding): TransactionalActionProvider {
    return new LoopbackHttpTransactionalProvider(this.fetcher, this.timeoutMs);
  }
  knowledge(_binding: ProviderBinding): KnowledgeProvider {
    return new LoopbackHttpKnowledgeProvider(this.fetcher, this.timeoutMs);
  }
}

export class LoopbackHttpCommerceProvider implements CommerceProvider {
  readonly kind = "local" as const;
  constructor(
    private readonly fetcher: LoopbackFetch,
    private readonly timeoutMs = 100,
  ) {}
  async call<T>(
    path: string,
    body: unknown,
    schema?: z.ZodType<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = new Request(`http://loopback${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const response = await Promise.race([
        this.fetcher(request),
        new Promise<Response>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Loopback commerce timeout."));
          }, this.timeoutMs);
        }),
      ]);
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          `Loopback commerce HTTP ${response.status}: ${error.error ?? "request failed"}`,
        );
      }
      const payload = await response.json();
      return schema ? schema.parse(payload) : (payload as T);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  findOrder(binding: ProviderBinding, email: string, orderId?: string) {
    return this.call<CommerceOrder | undefined>(
      "/commerce/orders",
      {
        binding,
        email,
        orderId,
      },
      z.union([orderSchema, z.null()]).transform((value) => value ?? undefined),
    );
  }
  findSubscription(binding: ProviderBinding, email: string) {
    return this.call<CommerceSubscription | undefined>(
      "/commerce/subscriptions",
      { binding, email },
      z
        .union([subscriptionSchema, z.null()])
        .transform((value) => value ?? undefined),
    );
  }
  refunds(binding: ProviderBinding, orderId: string) {
    return this.call<CommerceRefund[]>(
      "/commerce/refunds",
      {
        binding,
        orderId,
      },
      z.array(refundSchema),
    );
  }
}

class LoopbackHttpSupportProvider implements SupportChannelProvider {
  readonly kind = "local" as const;
  private readonly http: LoopbackHttpCommerceProvider;
  constructor(fetcher: LoopbackFetch, timeoutMs: number) {
    this.http = new LoopbackHttpCommerceProvider(fetcher, timeoutMs);
  }
  normalizeInbound(payload: unknown) {
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: "loopback",
    };
    return this.http.call<
      Awaited<ReturnType<SupportChannelProvider["normalizeInbound"]>>
    >("/support/normalize", { binding, payload }, normalizedInboundSchema);
  }
  deliver(
    binding: ProviderBinding,
    body: string,
    status: string,
    idempotencyKey?: string,
  ) {
    return this.http.call<DeliveryReceipt>(
      "/support/deliver",
      {
        binding,
        body,
        status,
        idempotencyKey,
      },
      receiptSchema,
    );
  }
  addInternalNote(
    binding: ProviderBinding,
    body: string,
    idempotencyKey: string,
  ) {
    return this.deliver(binding, body, "note", idempotencyKey);
  }
  updateStatus(
    binding: ProviderBinding,
    status: string,
    idempotencyKey: string,
  ) {
    return this.deliver(binding, "", status, idempotencyKey);
  }
}

class LoopbackHttpTransactionalProvider implements TransactionalActionProvider {
  readonly kind = "local" as const;
  private readonly http: LoopbackHttpCommerceProvider;
  constructor(fetcher: LoopbackFetch, timeoutMs: number) {
    this.http = new LoopbackHttpCommerceProvider(fetcher, timeoutMs);
  }
  quoteRefund(command: RefundCommand) {
    return this.http.call<RefundQuote>(
      "/transactions/quote-refund",
      {
        binding: command.binding,
        command,
      },
      quoteSchema,
    );
  }
  issueRefund(
    command: RefundCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ) {
    return this.http.call<RefundEffect>(
      "/transactions/issue-refund",
      {
        binding: command.binding,
        command,
        authorization,
      },
      effectSchema,
    );
  }
  quoteSubscriptionCredit(command: SubscriptionCreditCommand) {
    return this.http.call<SubscriptionCreditQuote>(
      "/transactions/quote-subscription-credit",
      { binding: command.binding, command },
      subscriptionCreditQuoteSchema,
    );
  }
  issueSubscriptionCredit(
    command: SubscriptionCreditCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ) {
    return this.http.call<SubscriptionCreditEffect>(
      "/transactions/issue-subscription-credit",
      { binding: command.binding, command, authorization },
      subscriptionCreditEffectSchema,
    );
  }
  retrieveSubscriptionCredit(command: SubscriptionCreditCommand) {
    return this.http.call<SubscriptionCreditEffect | undefined>(
      "/transactions/retrieve-subscription-credit",
      { binding: command.binding, command },
      subscriptionCreditEffectSchema
        .nullable()
        .transform((value) => value ?? undefined),
    );
  }
  scheduleSubscriptionCancellation(command: SubscriptionCancellationCommand) {
    return this.http.call<SubscriptionCancellationEffect>(
      "/transactions/schedule-subscription-cancellation",
      { binding: command.binding, command },
      z.object({
        subscriptionId: z.string(),
        cancelAtPeriodEnd: z.literal(true),
        cancelsAt: z.string(),
        idempotencyKey: z.string(),
        replayed: z.boolean(),
      }),
    );
  }
  retrieveSubscriptionCancellation(command: SubscriptionCancellationCommand) {
    return this.http.call<SubscriptionCancellationEffect | undefined>(
      "/transactions/retrieve-subscription-cancellation",
      { binding: command.binding, command },
      z
        .object({
          subscriptionId: z.string(),
          cancelAtPeriodEnd: z.literal(true),
          cancelsAt: z.string(),
          idempotencyKey: z.string(),
          replayed: z.boolean(),
        })
        .nullable()
        .transform((value) => value ?? undefined),
    );
  }
}

class LoopbackHttpKnowledgeProvider implements KnowledgeProvider {
  readonly kind = "local" as const;
  private readonly http: LoopbackHttpCommerceProvider;
  constructor(fetcher: LoopbackFetch, timeoutMs: number) {
    this.http = new LoopbackHttpCommerceProvider(fetcher, timeoutMs);
  }
  search(binding: ProviderBinding, query: string, topK: number) {
    return this.http.call<KnowledgeEvidence[]>(
      "/knowledge/search",
      {
        binding,
        query,
        topK,
      },
      z.array(evidenceSchema),
    );
  }
  listChanged(binding: ProviderBinding, since?: string) {
    return this.http.call<
      Awaited<ReturnType<KnowledgeProvider["listChanged"]>>
    >(
      "/knowledge/list-changed",
      { binding, since },
      z.array(knowledgeDocumentRefSchema),
    );
  }
  fetchDocument(binding: ProviderBinding, source: string) {
    return this.http.call<KnowledgeEvidence | undefined>(
      "/knowledge/fetch-document",
      { binding, source },
      z
        .union([evidenceSchema, z.null()])
        .transform((value) => value ?? undefined),
    );
  }
}
