import type { LanguageModelV2, LanguageModelV2Prompt } from "@ai-sdk/provider";
import { RequestContext } from "@mastra/core/request-context";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { issueLocalSession } from "../../src/mastra/server/auth";
import { safeEscalationResponse } from "../../src/mastra/domain/customer-response";
import { knowledgeAccountKey } from "../../src/mastra/lib/knowledge-publications";
import type { CaseProviderBindings } from "../../src/mastra/providers/contracts";
import { temporaryDatabasePath } from "../support/temp-path";

const files: string[] = [];
const runtimes: Array<{ shutdown(): Promise<void> }> = [];
const execFileAsync = promisify(execFile);
// The project setup gives ordinary local tests a deliberately different raw
// external profile. Individual recovery runs can exercise a configured
// external adapter, so retain that baseline for the next test after replacing
// it with the run's own database.
const baselineAppMode = process.env.APP_MODE;
const baselineOriginalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL;
const baselineOriginalDemoDatabaseUrl = process.env.ORIGINAL_DEMO_DATABASE_URL;

function jsonModel(
  value: Record<string, unknown>,
  beforeGenerate?: () => Promise<void>,
): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "phase003-test",
    modelId: "deterministic-json",
    supportedUrls: {},
    async doGenerate() {
      await beforeGenerate?.();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error(
        "This deterministic integration model only supports generate.",
      );
    },
  };
}

function refundModel(
  input: Record<string, unknown>,
  beforeGenerate?: () => Promise<void>,
  toolName = "issue_refund",
): LanguageModelV2 {
  let called = false;
  return {
    specificationVersion: "v2",
    provider: "phase003-test",
    modelId: "deterministic-refund",
    supportedUrls: {},
    async doGenerate(options) {
      await beforeGenerate?.();
      if (!called && options.tools?.some((tool) => tool.type === "function")) {
        called = true;
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "native-tool-call",
              toolName,
              input: JSON.stringify(input),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      }
      return {
        content: [{ type: "text" as const, text: "done" }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error(
        "This deterministic integration model only supports generate.",
      );
    },
  };
}

function responseLookupModel(
  input: {
    customerEmail?: string;
    orderId?: string;
    binding?: {
      tenantId: string;
      providerKind: "local";
      providerAccountId: string;
      externalConversationId: string;
    };
  } = { customerEmail: "alex@example.com", orderId: "ORD-1001" },
  prompts: LanguageModelV2Prompt[] = [],
): LanguageModelV2 {
  let called = false;
  return {
    specificationVersion: "v2",
    provider: "phase003-test",
    modelId: "deterministic-response-lookup",
    supportedUrls: {},
    async doGenerate(options) {
      prompts.push(options.prompt);
      if (
        !called &&
        options.tools?.some(
          (tool) => tool.type === "function" && tool.name === "lookup_order",
        )
      ) {
        called = true;
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "response-lookup",
              toolName: "lookup_order",
              input: JSON.stringify(input),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              draftResponse: "Verified lookup response.",
              citedSources: ["duplicate-charge-policy"],
              selectedPolicyExcerpts: [
                {
                  source: "duplicate-charge-policy",
                  excerpt:
                    "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
                },
              ],
              recommendRefund: false,
              requiresEscalation: false,
            }),
          },
        ],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error(
        "This deterministic integration model only supports generate.",
      );
    },
  };
}

function responseLookupToolResult(prompts: LanguageModelV2Prompt[]) {
  const result = prompts
    .flatMap((prompt) =>
      prompt.flatMap((message) =>
        message.role === "tool" ? message.content : [],
      ),
    )
    .find(
      (part) =>
        part.type === "tool-result" &&
        part.toolCallId === "response-lookup" &&
        part.toolName === "lookup_order",
    );
  expect(result).toBeDefined();
  return result!;
}

async function setup(
  caseId: string,
  configuredBinding?: {
    tenantId: string;
    providerKind: "local";
    providerAccountId: string;
    externalConversationId: string;
  },
  loopbackFailure?: (
    request: Request,
  ) => "timeout" | "429" | "500" | "drop-after-commit" | undefined,
  refund?: { amount: number; currency: string },
  options?: {
    deferInitialWorkflow?: boolean;
    responseBeforeGenerate?: () => Promise<void>;
    responseModel?: LanguageModelV2;
    executionBeforeGenerate?: () => Promise<void>;
    quoteDelayMs?: number;
    quoteFailure?: boolean;
    allowInitialWorkflowFailure?: boolean;
    providerBindings?: CaseProviderBindings;
    /** An inbound support adapter establishes this immutable owner binding. */
    ownerId?: string;
    source?: "mock-email" | "intercom-conversation";
    supportSource?: "mock" | "intercom";
    knowledgeExpiresAt?: string;
    triage?: Record<string, unknown>;
    message?: string;
    /** Reopen the same isolated SQLite database without accepting a second
     * inbound event or running its workflow. */
    databasePath?: string;
    existingCase?: boolean;
    credit?: boolean;
    appMode?: "staging";
  },
) {
  const path =
    options?.databasePath ?? temporaryDatabasePath("phase003-native-workflow");
  if (!files.includes(path)) files.push(path, `${path}-shm`, `${path}-wal`);
  process.env.SUPPORT_SOURCE = options?.supportSource ?? "mock";
  const hasExternalAdapter =
    process.env.SUPPORT_SOURCE === "intercom" ||
    process.env.COMMERCE_SOURCE === "stripe";
  process.env.DATABASE_URL = `file:${path}`;
  if (hasExternalAdapter) {
    // Legacy provider opt-in remains external when APP_MODE is omitted. The
    // composition root reads ORIGINAL_* after the database preload, so make
    // it point to this test's private database rather than the shared setup
    // sentinel.
    if (options?.appMode) process.env.APP_MODE = options.appMode;
    else delete process.env.APP_MODE;
    process.env.ORIGINAL_DATABASE_URL = `file:${path}`;
    process.env.ORIGINAL_DEMO_DATABASE_URL = `file:${path}.client`;
  } else {
    process.env.APP_MODE = "local";
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    process.env.ORIGINAL_DATABASE_URL = `file:${path}.external`;
  }
  vi.resetModules();
  // Evaluators are not the subject of this recovery test.  Remove their
  // registered scorer boundary before constructing the real agents so a
  // workflow run cannot invoke the production judge model.
  vi.doMock("../../src/mastra/evals", () => ({
    responseAgentScorers: {},
    triageAgentScorers: {},
    liveSupportScorerRegistry: {},
    liveResponseAgentScorers: {},
    liveTriageAgentScorers: {},
  }));

  const { mastra } = await import("../../src/mastra/index");
  runtimes.push(mastra);
  const { caseStore } = await import("../../src/mastra/lib/case-store");
  const {
    defaultLocalBinding,
    localRuntime,
    purgeExpiredWorkflowSnapshots,
    recoverApprovedNativeDecisions,
  } = await import("../../src/mastra/runtime/local-runtime");
  const { triageAgent } = await import("../../src/mastra/agents/triage-agent");
  const { responseAgent } =
    await import("../../src/mastra/agents/response-agent");
  const { refundExecutionAgent } =
    await import("../../src/mastra/agents/refund-execution-agent");
  const {
    supportCaseApproveRoute,
    supportCaseRejectRoute,
    supportCaseFeedbackRoute,
    supportCaseFollowUpRoute,
    supportInboundRoute,
    stripeWebhookRoute,
  } = await import("../../src/mastra/server/routes");

  if (options?.quoteDelayMs || options?.quoteFailure) {
    const quoteRefund = localRuntime.quoteRefund.bind(localRuntime);
    vi.spyOn(localRuntime, "quoteRefund").mockImplementation(
      async (...args) => {
        if (options.quoteDelayMs)
          await new Promise<void>((resolve) =>
            setTimeout(resolve, options.quoteDelayMs),
          );
        if (options.quoteFailure)
          throw new Error("injected quote provider failure");
        return quoteRefund(...args);
      },
    );
  }

  // These spies replace only the provider transport. The registered Agents,
  // native approval snapshot, tool execution, workflow suspension and resume
  // all run through installed Mastra code.
  triageAgent.__updateModel({
    model: jsonModel(
      options?.triage ?? {
        intent: "duplicate_charge",
        urgency: "normal",
        sentiment: "negative",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "Deterministic duplicate-charge triage.",
      },
    ) as never,
  });
  const refundAmount = refund?.amount ?? 20;
  const refundCurrency = refund?.currency ?? "USD";
  responseAgent.__updateModel({
    model:
      options?.responseModel ??
      (jsonModel(
        {
          draftResponse: "We will process the duplicate-charge refund.",
          citedSources: ["duplicate-charge-policy"],
          selectedPolicyExcerpts: [
            {
              source: "duplicate-charge-policy",
              excerpt:
                "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
            },
          ],
          recommendRefund: true,
          refundAmount,
          refundCurrency,
          refundReason: "duplicate charge",
          requiresEscalation: false,
        },
        options?.responseBeforeGenerate,
      ) as never),
  });

  const configured =
    configuredBinding ?? defaultLocalBinding(`conversation-${caseId}`);
  const bindings: CaseProviderBindings = options?.providerBindings ?? {
    support: configured,
    commerce: configured,
    transactions: configured,
    knowledge: configured,
  };
  const binding = bindings.support;
  const configuredBindings = [
    ...new Map(
      Object.values(bindings).map((candidate) => [
        `${candidate.tenantId}\u0000${candidate.providerKind}\u0000${candidate.providerAccountId}`,
        candidate,
      ]),
    ).values(),
  ];
  await Promise.all(
    configuredBindings
      .filter((candidate) => candidate.providerKind === "local")
      .map((candidate) => localRuntime.seed(candidate)),
  );
  if (options?.knowledgeExpiresAt)
    await caseStore.getClient().execute({
      sql: "UPDATE local_knowledge SET expires_at = ? WHERE tenant_id = ? AND provider_account_id = ?",
      args: [
        options.knowledgeExpiresAt,
        bindings.knowledge.tenantId,
        bindings.knowledge.providerAccountId,
      ],
    });
  const { legacyAmountToMoney } = await import("../../src/mastra/lib/money");
  if (bindings.transactions.providerKind === "local")
    await caseStore.getClient().execute({
      sql: "UPDATE local_orders SET currency = ?, amount_minor = ? WHERE tenant_id = ? AND provider_account_id = ? AND order_id = ?",
      args: [
        refundCurrency,
        legacyAmountToMoney(refundAmount + 1_000, refundCurrency).minor,
        bindings.transactions.tenantId,
        bindings.transactions.providerAccountId,
        "ORD-1001",
      ],
    });
  // A Stripe binding is registered by the real composition root from the
  // opt-in environment.  Do not replace it with the local loopback façade in
  // this harness: phase-006 tests must exercise the actual Stripe registry.
  if (
    (configuredBinding || options?.providerBindings) &&
    configuredBindings.every((candidate) => candidate.providerKind === "local")
  ) {
    const { registerProviderRegistry } =
      await import("../../src/mastra/providers/registry");
    const { createLocalLoopbackFacade, LoopbackHttpProviderRegistry } =
      await import("../../src/mastra/providers/advanced/loopback-http");
    registerProviderRegistry(
      new LoopbackHttpProviderRegistry(
        createLocalLoopbackFacade(localRuntime, loopbackFailure),
      ),
      configuredBindings,
    );
  }
  if (!options?.existingCase) {
    const createdAt = new Date().toISOString();
    await caseStore.acceptInbound(
      {
        id: caseId,
        externalId: `event-${caseId}`,
        source: options?.source ?? "mock-email",
        customer: { email: "alex@example.com" },
        subject: "I was charged twice",
        messages: [
          {
            id: `message-${caseId}`,
            author: "customer",
            body: options?.message ?? "Please refund the duplicate charge.",
            createdAt,
          },
        ],
        status: "new",
        createdAt,
        updatedAt: createdAt,
        metadata: {
          providerBinding: binding,
          providerBindings: bindings,
          ownerId: options?.ownerId ?? "customer-alex",
        },
      },
      `event-${caseId}`,
      `workflow-${caseId}`,
    );
  }
  let executionCaseId = caseId;
  const selectExecutionCase = (id: string) => {
    executionCaseId = id;
  };
  const executionModel = async () => {
    const executionCase = await caseStore.get(executionCaseId);
    if (!executionCase)
      throw new Error(`Execution case ${executionCaseId} is missing.`);
    const activeTurnId = (executionCase.metadata as Record<string, unknown>)
      .activeTurnId;
    if (typeof activeTurnId !== "string" || !activeTurnId)
      throw new Error(
        `Execution case ${executionCaseId} has no active workflow turn.`,
      );
    const actionKind = options?.credit
      ? "subscription-credit-command"
      : "refund-command";
    const action = await caseStore.getClient().execute({
      sql: "SELECT action.data FROM support_actions AS action JOIN support_turns AS turn ON turn.case_id = action.case_id AND turn.command_fingerprint = action.fingerprint WHERE action.case_id = ? AND action.kind = ? AND turn.id = ? LIMIT 1",
      args: [executionCaseId, actionKind, activeTurnId],
    });
    const command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as {
      approvalCaseId?: string;
      orderId?: string;
      customerId?: string;
      subscriptionId?: string;
      amount?: { minor?: number; currency?: string };
      reason?: string;
      idempotencyKey?: string;
      fingerprint?: string;
    };
    const input = options?.credit
      ? {
          caseId: command.approvalCaseId ?? executionCaseId,
          customerId: command.customerId,
          subscriptionId: command.subscriptionId,
          amount: command.amount?.minor ? command.amount.minor / 100 : 49,
          currency: command.amount?.currency ?? "USD",
          reason: command.reason,
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
        }
      : {
          caseId: command.approvalCaseId ?? executionCaseId,
          // Native approval must execute the immutable target selected by the
          // workflow (including a subscription renewal Invoice), never a fixture
          // alias for the initial Checkout.
          orderId: command.orderId ?? "ORD-1001",
          amount: refundAmount,
          currency: refundCurrency,
          reason: "duplicate charge",
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
        };
    return refundModel(
      input,
      options?.executionBeforeGenerate,
      options?.credit ? "issue_subscription_credit" : "issue_refund",
    ) as never;
  };
  refundExecutionAgent.__updateModel({ model: executionModel });
  // Workflows obtain this restricted agent through the Mastra registry.
  mastra.getAgent("refundExecutionAgent").__updateModel({
    model: executionModel,
  });

  const app = new Hono();
  app.use("/support/*", async (c, next) => {
    const requestContext = new RequestContext();
    requestContext.setRaw("correlationId", c.req.header("x-correlation-id"));
    c.set("mastra", mastra as never);
    c.set("requestContext", requestContext);
    await next();
  });
  app.post(
    "/support/cases/:caseId/follow-ups",
    supportCaseFollowUpRoute.handler,
  );
  app.post("/support/cases/:caseId/approve", supportCaseApproveRoute.handler);
  app.post("/support/cases/:caseId/reject", supportCaseRejectRoute.handler);
  app.post("/support/cases/:caseId/feedback", supportCaseFeedbackRoute.handler);
  app.post("/support/inbound", supportInboundRoute.handler);
  app.post("/support/webhooks/stripe", stripeWebhookRoute.handler);

  if (options?.deferInitialWorkflow || options?.existingCase)
    return {
      binding,
      bindings,
      caseStore,
      mastra,
      app,
      selectExecutionCase,
      purgeExpiredWorkflowSnapshots,
      recoverApprovedNativeDecisions,
    };

  const dispatch = await caseStore.claimDispatchForStart(
    caseId,
    `workflow-${caseId}`,
  );
  if (!dispatch) throw new Error("Expected the initial workflow dispatch.");
  await caseStore.markDispatchStarted(dispatch.id, dispatch.leaseToken);
  await caseStore.update(caseId, {
    workflowRunId: `workflow-${caseId}`,
    metadata: {
      ...((await caseStore.get(caseId))!.metadata as Record<string, unknown>),
      activeTurnId: dispatch.turnId,
    },
  });
  const initialRun = await mastra
    .getWorkflow("resolveSupportCaseWorkflow")
    .createRun({ runId: `workflow-${caseId}`, disableScorers: true });
  const { withDispatchLeaseScope } =
    await import("../../src/mastra/lib/dispatch-lease-scope");
  const initial = await withDispatchLeaseScope(
    {
      dispatchId: dispatch.id,
      caseId,
      turnId: dispatch.turnId,
      leaseToken: dispatch.leaseToken!,
    },
    () => initialRun.start({ inputData: { caseId, turnId: dispatch.turnId } }),
  );
  await caseStore.completeDispatch(
    dispatch.id,
    initial.status === "suspended" ? "suspended" : "completed",
    undefined,
    dispatch.leaseToken,
  );
  const supportCase = await caseStore.get(caseId);
  if (options?.allowInitialWorkflowFailure)
    return {
      binding,
      bindings,
      caseStore,
      mastra,
      app,
      selectExecutionCase,
      purgeExpiredWorkflowSnapshots,
      recoverApprovedNativeDecisions,
      initialWorkflowStatus: initial.status,
      databasePath: path,
    };
  if (refund && refund.amount > 1000)
    return {
      binding,
      caseStore,
      mastra,
      app,
      selectExecutionCase,
      purgeExpiredWorkflowSnapshots,
      recoverApprovedNativeDecisions,
    };
  expect(supportCase).toMatchObject({ status: "waiting_approval" });
  const native = (supportCase!.metadata as Record<string, unknown>)
    .nativeApproval as {
    runId: string;
    toolCallId: string;
    fingerprint: string;
    turnId: string;
  };
  expect(native).toMatchObject({
    runId: expect.any(String),
    toolCallId: expect.any(String),
    fingerprint: expect.any(String),
    turnId: expect.any(String),
  });
  return {
    binding,
    bindings,
    caseStore,
    mastra,
    app,
    native,
    selectExecutionCase,
    purgeExpiredWorkflowSnapshots,
    recoverApprovedNativeDecisions,
    databasePath: path,
  };
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  vi.doUnmock("../../src/mastra/evals");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  process.env.COMMERCE_SOURCE = "mock";
  for (const name of [
    "STRIPE_SANDBOX_ENABLED",
    "STRIPE_TENANT_ID",
    "STRIPE_ACCOUNT_ID",
    "STRIPE_RESTRICTED_API_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_API_BASE_URL",
  ])
    delete process.env[name];
  for (const name of [
    "INTERCOM_DEVELOPMENT_ENABLED",
    "INTERCOM_TENANT_ID",
    "INTERCOM_APP_ID",
    "INTERCOM_ACCESS_TOKEN",
    "INTERCOM_CLIENT_SECRET",
    "INTERCOM_ADMIN_ID",
    "INTERCOM_API_BASE_URL",
    "INTERCOM_KNOWLEDGE_ENABLED",
    "INTERCOM_TICKET_TYPE_ID",
    "INTERCOM_TICKET_STATE_ID",
  ])
    delete process.env[name];
  delete process.env.SUPPORT_TEST_DISPATCH_LEASE_MS;
  delete process.env.SUPPORT_TEST_DISPATCH_HEARTBEAT_MS;
  if (baselineAppMode === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = baselineAppMode;
  if (baselineOriginalDatabaseUrl === undefined)
    delete process.env.ORIGINAL_DATABASE_URL;
  else process.env.ORIGINAL_DATABASE_URL = baselineOriginalDatabaseUrl;
  if (baselineOriginalDemoDatabaseUrl === undefined)
    delete process.env.ORIGINAL_DEMO_DATABASE_URL;
  else process.env.ORIGINAL_DEMO_DATABASE_URL = baselineOriginalDemoDatabaseUrl;
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

function independentCaseBindings(caseId: string): CaseProviderBindings {
  const binding = (providerAccountId: string) => ({
    tenantId: "local-demo",
    providerKind: "local" as const,
    providerAccountId,
    externalConversationId: `conversation-${caseId}`,
  });
  return {
    support: binding(`support-${caseId}`),
    commerce: binding(`commerce-${caseId}`),
    transactions: binding(`transactions-${caseId}`),
    knowledge: binding(`knowledge-${caseId}`),
  };
}

function prepareKnowledgeExpiry() {
  const initial = new Date();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(initial);
  return {
    expiresAt: new Date(initial.getTime() + 1_000).toISOString(),
    afterExpiry: new Date(initial.getTime() + 1_001),
  };
}

async function approveNativeRefund(
  app: Hono,
  caseId: string,
  commandFingerprint: string,
  serviceProblemConfirmed?: true,
) {
  return app.request(`http://support.test/support/cases/${caseId}/approve`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      commandFingerprint,
      ...(serviceProblemConfirmed ? { serviceProblemConfirmed } : {}),
    }),
  });
}

function enableSyntheticStripe() {
  process.env.COMMERCE_SOURCE = "stripe";
  process.env.STRIPE_SANDBOX_ENABLED = "true";
  process.env.STRIPE_TENANT_ID = "local-demo";
  process.env.STRIPE_ACCOUNT_ID = "acct_test_123";
  process.env.STRIPE_RESTRICTED_API_KEY = "rk_test_synthetic";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
  process.env.STRIPE_API_BASE_URL = "http://stripe.test";
}

function syntheticStripeBindings(caseId: string): CaseProviderBindings {
  const local = {
    tenantId: "local-demo",
    providerKind: "local" as const,
    providerAccountId: "local-demo",
    externalConversationId: `conversation-${caseId}`,
  };
  const stripe = {
    tenantId: "local-demo",
    providerKind: "stripe" as const,
    providerAccountId: "acct_test_123",
    externalConversationId: `conversation-${caseId}`,
  };
  return {
    support: local,
    commerce: stripe,
    transactions: stripe,
    knowledge: local,
  };
}

function enableSyntheticIntercom() {
  process.env.INTERCOM_DEVELOPMENT_ENABLED = "true";
  process.env.INTERCOM_TENANT_ID = "local-demo";
  process.env.INTERCOM_APP_ID = "intercom-test-app";
  process.env.INTERCOM_ACCESS_TOKEN = "synthetic-token";
  process.env.INTERCOM_CLIENT_SECRET = "synthetic-secret";
  process.env.INTERCOM_ADMIN_ID = "intercom-test-admin";
  process.env.INTERCOM_API_BASE_URL = "http://intercom.test";
  process.env.INTERCOM_KNOWLEDGE_ENABLED = "false";
}

function syntheticIntercomStripeBindings(caseId: string): CaseProviderBindings {
  const stripe = syntheticStripeBindings(caseId);
  const support = {
    tenantId: "local-demo",
    providerKind: "intercom" as const,
    providerAccountId: "intercom-test-app",
    externalConversationId: `intercom-conversation-${caseId}`,
  };
  return { ...stripe, support };
}

/** The credit fixture includes the full subscription payment chain used by
 * lookup. Its first balance POST is committed into the synthetic remote ledger
 * and then loses the response, so a restarted runtime must recover that one
 * receipt instead of issuing a second credit. */
function creditResponseLossStripeTransport(input: {
  caseId: string;
  fingerprint: () => string;
  postStatus?: number;
  observed: {
    posts: number;
    idempotencyKeys: string[];
    remoteCommitted: boolean;
    /** Mutated after the initial quote so approval re-runs the Stripe
     * preflight against changed provider state. */
    preflightFailure?: "subscription" | "prior-credit";
    preflightBarrier?: { started: () => void; release: Promise<void> };
  };
}) {
  const transaction = () => ({
    id: "cbtxn_credit_restart",
    customer: "cus_credit_restart",
    livemode: false,
    amount: -4900,
    currency: "usd",
    created: 2,
    metadata: {
      support_case_id: input.caseId,
      command_fingerprint: input.fingerprint(),
      subscription_id: "sub_credit_restart",
    },
  });
  const subscription = () => ({
    id: "sub_credit_restart",
    customer: "cus_credit_restart",
    latest_invoice: "in_credit_restart",
    livemode: false,
    // Once the provider has committed the credit, model a lifecycle change to
    // ensure receipt recovery does not require an active subscription.
    status:
      input.observed.remoteCommitted ||
      input.observed.preflightFailure === "subscription"
        ? "canceled"
        : "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_end: 2,
          quantity: 1,
          price: {
            id: "price_credit_restart",
            nickname: "Pro",
            currency: "usd",
            unit_amount: 4900,
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  });
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === "/v1/account")
      return Response.json({ id: "acct_test_123", livemode: false });
    if (path === "/v1/customers")
      return Response.json({
        data: [
          {
            id: "cus_credit_restart",
            email: "alex@example.com",
            livemode: false,
          },
        ],
        has_more: false,
      });
    if (path === "/v1/customers/cus_credit_restart")
      return Response.json({
        id: "cus_credit_restart",
        email: "alex@example.com",
        livemode: false,
      });
    if (path === "/v1/checkout/sessions")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/invoices")
      return Response.json({
        data: [
          {
            id: "in_credit_restart",
            customer: "cus_credit_restart",
            livemode: false,
            status: "paid",
            paid: true,
            billing_reason: "subscription_cycle",
            subscription: "sub_credit_restart",
            parent: {
              subscription_details: { subscription: "sub_credit_restart" },
            },
          },
        ],
        has_more: false,
      });
    if (path === "/v1/subscriptions")
      return Response.json({ data: [subscription()], has_more: false });
    if (path === "/v1/subscriptions/sub_credit_restart")
      return Response.json(subscription());
    if (path === "/v1/invoices/in_credit_restart")
      return Response.json({
        id: "in_credit_restart",
        customer: "cus_credit_restart",
        status: "paid",
        paid: true,
        created: 1,
        livemode: false,
      });
    if (path === "/v1/invoice_payments")
      return Response.json({
        data: [
          {
            id: "inpay_credit_restart",
            invoice: "in_credit_restart",
            status: "paid",
            paid: true,
            livemode: false,
            payment: {
              type: "payment_intent",
              payment_intent: "pi_credit_restart",
            },
          },
        ],
        has_more: false,
      });
    if (path === "/v1/payment_intents/pi_credit_restart")
      return Response.json({
        id: "pi_credit_restart",
        amount_received: 4900,
        currency: "usd",
        status: "succeeded",
        livemode: false,
      });
    if (path === "/v1/refunds" && request.method === "GET")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/customers/cus_credit_restart/balance_transactions") {
      if (request.method === "GET") {
        const barrier = input.observed.preflightBarrier;
        if (barrier) {
          input.observed.preflightBarrier = undefined;
          barrier.started();
          await barrier.release;
        }
        return Response.json({
          data: input.observed.remoteCommitted
            ? [transaction()]
            : input.observed.preflightFailure === "prior-credit"
              ? [
                  {
                    ...transaction(),
                    id: "cbtxn_prior_credit",
                    metadata: {
                      ...transaction().metadata,
                      command_fingerprint: "prior-credit-fingerprint",
                    },
                  },
                ]
              : [],
          has_more: false,
        });
      }
      input.observed.posts += 1;
      input.observed.idempotencyKeys.push(
        request.headers.get("idempotency-key") ?? "",
      );
      if (input.postStatus)
        return Response.json(
          { error: "synthetic" },
          { status: input.postStatus },
        );
      input.observed.remoteCommitted = true;
      throw new TypeError(
        "synthetic response loss after committed credit POST",
      );
    }
    if (
      path ===
      "/v1/customers/cus_credit_restart/balance_transactions/cbtxn_credit_restart"
    )
      return Response.json(transaction());
    throw new Error(
      `Unexpected credit restart Stripe request ${request.method} ${path}`,
    );
  };
}

function signedStripeEvent(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = createHmac("sha256", "whsec_synthetic")
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
  };
}

/** A narrow Stripe fixture for the registered cancellation path.  The first
 * POST is deliberately committed remotely and then loses its response; every
 * recovery read must use this same persisted subscription id. */
function cancellationStripeTransport(
  observed: {
    posts: number;
    refundPosts?: number;
    gets: string[];
    keys: string[];
    scheduled: boolean;
    loseFirstPost: boolean;
    preflightFailure?: boolean;
    post4xx?: boolean;
    invalidPostResponse?: "missing-schedule" | "malformed-items";
  },
  barrier?: (
    path: string,
  ) => { started: () => void; release: Promise<void> } | undefined,
) {
  const subscription = () => ({
    id: "sub_cancel",
    customer: "cus_1",
    latest_invoice: "in_1",
    livemode: false,
    status: "active",
    cancel_at_period_end: observed.scheduled,
    items: {
      data: [
        {
          current_period_end: 200,
          price: {
            currency: "usd",
            unit_amount: 4900,
            nickname: "Pro",
            recurring: { interval: "month", interval_count: 1 },
          },
          quantity: 1,
        },
      ],
    },
  });
  return async (request: Request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "GET") {
      observed.gets.push(path);
      const held = barrier?.(path);
      if (held) {
        held.started();
        await held.release;
      }
    }
    if (path === "/v1/account")
      return Response.json({ id: "acct_test_123", livemode: false });
    if (path === "/v1/customers")
      return Response.json({
        data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
        has_more: false,
      });
    if (path === "/v1/checkout/sessions")
      return Response.json({
        data: [
          {
            id: "cs_purchase",
            customer: "cus_1",
            customer_details: { email: "alex@example.com" },
            payment_intent: "pi_purchase",
            status: "complete",
            payment_status: "paid",
            livemode: false,
            created: 1,
          },
        ],
        has_more: false,
      });
    if (path === "/v1/customers/cus_1")
      return Response.json({
        id: "cus_1",
        email: "alex@example.com",
        livemode: false,
      });
    if (path === "/v1/checkout/sessions")
      return Response.json({
        data: [
          {
            id: "ORD-1001",
            customer: "cus_1",
            customer_details: { email: "alex@example.com" },
            payment_intent: "pi_order",
            status: "complete",
            payment_status: "paid",
            livemode: false,
            created: 1,
          },
        ],
        has_more: false,
      });
    if (path === "/v1/checkout/sessions/ORD-1001/line_items")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/payment_intents/pi_order")
      return Response.json({
        id: "pi_order",
        livemode: false,
        status: "succeeded",
        amount_received: 4900,
        currency: "usd",
      });
    if (path === "/v1/refunds")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/checkout/sessions/cs_purchase/line_items")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/payment_intents/pi_purchase")
      return Response.json({
        id: "pi_purchase",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        livemode: false,
      });
    if (path === "/v1/payment_intents/pi_sub")
      return Response.json({
        id: "pi_sub",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        livemode: false,
      });
    if (path === "/v1/subscriptions" && request.method === "GET")
      return Response.json({ data: [subscription()], has_more: false });
    if (path === "/v1/invoices/in_1")
      return Response.json({
        id: "in_1",
        customer: "cus_1",
        status: "paid",
        paid: true,
        livemode: false,
        created: 1,
      });
    if (path === "/v1/invoice_payments")
      return Response.json({
        data: [
          {
            id: "ip_1",
            invoice: "in_1",
            status: "paid",
            livemode: false,
            payment: {
              type: "payment_intent",
              payment_intent: "pi_sub",
            },
          },
        ],
        has_more: false,
      });
    if (path === "/v1/refunds" && request.method === "GET")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/refunds" && request.method === "POST") {
      observed.refundPosts = (observed.refundPosts ?? 0) + 1;
      throw new Error("refund must not execute");
    }
    if (path === "/v1/subscriptions/sub_cancel" && request.method === "GET")
      if (observed.preflightFailure)
        return Response.json({ error: "synthetic" }, { status: 400 });
      else return Response.json(subscription());
    if (path === "/v1/subscriptions/sub_cancel" && request.method === "POST") {
      observed.posts += 1;
      observed.keys.push(request.headers.get("idempotency-key") ?? "");
      if (observed.post4xx)
        return Response.json({ error: "synthetic" }, { status: 400 });
      expect(await request.text()).toBe("cancel_at_period_end=true");
      observed.scheduled = true;
      if (observed.loseFirstPost) {
        observed.loseFirstPost = false;
        throw new Error("lost cancellation POST response after commit");
      }
      if (observed.invalidPostResponse === "missing-schedule") {
        return Response.json({
          ...subscription(),
          cancel_at_period_end: undefined,
        });
      }
      if (observed.invalidPostResponse === "malformed-items")
        return Response.json({ ...subscription(), items: { data: [] } });
      return Response.json(subscription());
    }
    throw new Error(
      `Unexpected cancellation Stripe request ${request.method} ${path}`,
    );
  };
}

/** The native refund path needs the complete Checkout fixture: the workflow
 * resolves ORD-1001 through Stripe before it suspends for approval, then the
 * approved registered tool performs its final account GET directly before the
 * store's first-effect fence.  Tests can hold precisely that final GET. */
function nativeRefundStripeTransport(input: {
  caseId: string;
  fingerprint: () => string;
  observed: {
    posts: number;
    accountGets: number;
    gets: string[];
    keys: string[];
    failRefundHistory?: boolean;
  };
  firstPostThrows?: boolean;
  barrier?: (
    path: string,
  ) => { started: () => void; release: Promise<void> } | undefined;
}) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "GET") {
      input.observed.gets.push(path);
      const barrier = input.barrier?.(path);
      if (barrier) {
        barrier.started();
        await barrier.release;
      }
    }
    if (path === "/v1/account") {
      input.observed.accountGets += 1;
      return Response.json({ id: "acct_test_123", livemode: false });
    }
    if (path === "/v1/customers")
      return Response.json({
        data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
        has_more: false,
      });
    if (path === "/v1/checkout/sessions")
      return Response.json({
        data: [
          {
            id: "ORD-1001",
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
    if (path === "/v1/checkout/sessions/ORD-1001/line_items")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/payment_intents/pi_1")
      return Response.json({
        id: "pi_1",
        amount_received: 102000,
        currency: "usd",
        status: "succeeded",
        livemode: false,
      });
    if (path === "/v1/subscriptions")
      return Response.json({ data: [], has_more: false });
    if (path === "/v1/refunds" && request.method === "GET")
      if (input.observed.failRefundHistory)
        return Response.json(
          {
            error: { code: "resource_missing", type: "invalid_request_error" },
          },
          { status: 400, headers: { "request-id": "req_NoIdTerminal123" } },
        );
      else return Response.json({ data: [], has_more: false });
    if (path === "/v1/refunds" && request.method === "POST") {
      input.observed.posts += 1;
      input.observed.keys.push(request.headers.get("idempotency-key") ?? "");
      if (input.firstPostThrows && input.observed.posts === 1)
        throw new Error("synthetic response loss after refund POST");
      return Response.json({
        id: "re_native_fence",
        amount: 2000,
        currency: "usd",
        status: "succeeded",
        created: 2,
        livemode: false,
        metadata: {
          support_case_id: input.caseId,
          command_fingerprint: input.fingerprint(),
        },
      });
    }
    throw new Error(
      `Unexpected native-fence Stripe request ${request.method} ${path}`,
    );
  };
}

describe("native approval workflow recovery", () => {
  it("keeps the active approval dispatch through a paused refund preflight so reconciliation cannot steal its prepared attempt", async () => {
    const caseId = `native-refund-preflight-reconcile-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    let releasePreflight!: () => void;
    let preflightStarted!: () => void;
    const release = new Promise<void>((resolve) => {
      releasePreflight = resolve;
    });
    const started = new Promise<void>((resolve) => {
      preflightStarted = resolve;
    });
    let holdRefundHistory = false;
    const observed = {
      posts: 0,
      accountGets: 0,
      gets: [] as string[],
      keys: [] as string[],
    };
    vi.stubGlobal(
      "fetch",
      nativeRefundStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
        barrier: (path) =>
          holdRefundHistory && path === "/v1/refunds"
            ? { started: preflightStarted, release }
            : undefined,
      }),
    );
    const initial = await setup(caseId, undefined, undefined, undefined, {
      providerBindings: syntheticStripeBindings(caseId),
    });
    const native = initial.native!;
    fingerprint = native.fingerprint;
    const command = (await initial.caseStore.getAction(
      caseId,
      "refund-command",
      fingerprint,
    )) as { idempotencyKey: string };
    holdRefundHistory = true;
    const approval = approveNativeRefund(initial.app, caseId, fingerprint);
    await started;
    expect(
      await initial.caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "prepared" });
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    expect(await reconcileStripeRefundAttempts(initial.caseStore)).toBe(0);
    releasePreflight();
    expect((await approval).status).toBe(200);
    expect(observed.posts).toBe(1);
    expect(await initial.caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { status: "executed" },
    });
  });

  it("recognizes a no-id terminal refund failure on restart before resuming its consumed native snapshot", async () => {
    const caseId = `native-refund-no-id-restart-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    const observed = {
      posts: 0,
      accountGets: 0,
      gets: [] as string[],
      keys: [] as string[],
      failRefundHistory: false,
    };
    vi.stubGlobal(
      "fetch",
      nativeRefundStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
      }),
    );
    const initial = await setup(caseId, undefined, undefined, undefined, {
      providerBindings: syntheticStripeBindings(caseId),
    });
    const native = initial.native!;
    fingerprint = native.fingerprint;
    const command = (await initial.caseStore.getAction(
      caseId,
      "refund-command",
      fingerprint,
    )) as { idempotencyKey: string };
    observed.failRefundHistory = true;
    expect(
      (await approveNativeRefund(initial.app, caseId, fingerprint)).status,
    ).toBe(200);
    expect(
      await initial.caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "failed", refundId: undefined });
    const workflowRunId = (await initial.caseStore.get(caseId))!.workflowRunId!;
    expect(
      await initial.mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .getWorkflowRunById(workflowRunId),
    ).toMatchObject({ status: "canceled" });
    const action = await initial.caseStore.getAction(
      caseId,
      "refund-failure",
      fingerprint,
    );
    expect(action).toMatchObject({
      classification: "confirmed-no-effect",
      diagnostic: {
        stage: "preflight",
        status: 400,
        code: "resource_missing",
        type: "invalid_request_error",
        requestId: "req_NoIdTerminal123",
      },
    });
    // Model a process crash after durable finalization but before the worker
    // records its terminal dispatch state. Recovery must not resume the tool.
    await initial.caseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'suspended', lease_until = NULL, lease_token = NULL WHERE case_id = ?",
      args: [caseId],
    });
    const resumeSpy = vi.spyOn(
      await import("../../src/mastra/providers/native-execution"),
      "resumeApprovedNativeTool",
    );
    await initial.recoverApprovedNativeDecisions(
      initial.mastra,
      initial.caseStore,
      {
        disableScorers: true,
      },
    );
    expect(resumeSpy).not.toHaveBeenCalled();
    expect(observed.posts).toBe(0);
    expect(
      await initial.mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .getWorkflowRunById(workflowRunId),
    ).toMatchObject({ status: "canceled" });
    expect(
      await initial.caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ? AND status = 'escalated'",
        args: [caseId],
      }),
    ).toMatchObject({ rows: [{ total: 1 }] });
  });

  it("suspends the real native CREDIT tool, executes one approved monthly credit, and declines without an effect", async () => {
    const policyExcerpt =
      "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.";
    const creditResponse = jsonModel({
      draftResponse:
        "We can propose a future billing credit after an approver confirms the reported service problem.",
      citedSources: ["service-problem-credit-policy"],
      selectedPolicyExcerpts: [
        { source: "service-problem-credit-policy", excerpt: policyExcerpt },
      ],
      recommendRefund: false,
      resolutionAction: "subscription_credit",
      subscriptionCreditAmount: 49,
      subscriptionCreditCurrency: "USD",
      subscriptionCreditReason:
        "Reported service problem pending human confirmation",
      requiresEscalation: false,
    }) as never;
    const approvedCaseId = `native-credit-approved-${crypto.randomUUID()}`;
    const approved = await setup(
      approvedCaseId,
      undefined,
      undefined,
      undefined,
      {
        credit: true,
        triage: {
          intent: "service_problem",
          urgency: "normal",
          sentiment: "negative",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Customer-reported service problem.",
        },
        message:
          "O serviço ficou indisponível e não consegui usar minha assinatura.",
        responseModel: creditResponse,
      },
    );
    const approvedNative = approved.native!;
    expect(
      await approved.caseStore.getAction(
        approvedCaseId,
        "subscription-credit-command",
        approvedNative.fingerprint,
      ),
    ).toMatchObject({
      subscriptionId: "SUB-1001",
      customerId: expect.any(String),
    });
    expect(
      (
        await approveNativeRefund(
          approved.app,
          approvedCaseId,
          approvedNative.fingerprint,
        )
      ).status,
    ).toBe(409);
    expect((await approved.caseStore.get(approvedCaseId))?.status).toBe(
      "waiting_approval",
    );
    expect(
      (await approved.caseStore.get(approvedCaseId))?.subscriptionCreditResult,
    ).toBeUndefined();
    expect(
      (
        await approveNativeRefund(
          approved.app,
          approvedCaseId,
          approvedNative.fingerprint,
          true,
        )
      ).status,
    ).toBe(200);
    expect(await approved.caseStore.get(approvedCaseId)).toMatchObject({
      status: "resolved",
      approval: { serviceProblemConfirmed: true },
      subscriptionCreditResult: {
        subscriptionId: "SUB-1001",
        amount: 49,
        status: "executed",
      },
    });

    const rejectedCaseId = `native-credit-rejected-${crypto.randomUUID()}`;
    const rejected = await setup(
      rejectedCaseId,
      undefined,
      undefined,
      undefined,
      {
        credit: true,
        triage: {
          intent: "service_problem",
          urgency: "normal",
          sentiment: "negative",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Verified service outage.",
        },
        responseModel: creditResponse,
      },
    );
    const rejectedNative = rejected.native!;
    expect(
      (
        await rejected.app.request(
          `http://support.test/support/cases/${rejectedCaseId}/reject`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              commandFingerprint: rejectedNative.fingerprint,
            }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (await rejected.caseStore.get(rejectedCaseId))?.subscriptionCreditResult,
    ).toBeUndefined();
    const rejectedCommand = await rejected.caseStore.getAction(
      rejectedCaseId,
      "subscription-credit-command",
      rejectedNative.fingerprint,
    );
    const { issueSubscriptionCreditTool } =
      await import("../../src/mastra/tools/issue-subscription-credit");
    await expect(
      issueSubscriptionCreditTool.execute!(
        {
          caseId: rejectedCaseId,
          customerId: String(rejectedCommand!.customerId),
          subscriptionId: String(rejectedCommand!.subscriptionId),
          amount: Number(rejectedCommand!.amount.minor) / 100,
          currency: String(rejectedCommand!.amount.currency),
          reason: String(rejectedCommand!.reason),
          idempotencyKey: String(rejectedCommand!.idempotencyKey),
          fingerprint: rejectedNative.fingerprint,
        },
        {} as never,
      ),
    ).rejects.toThrow("current authorized decision");
    const directEffects = await rejected.caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM local_subscription_credits WHERE tenant_id = ? AND provider_account_id = ?",
      args: ["local-demo", "local-demo"],
    });
    expect(Number(directEffects.rows[0]?.total)).toBe(0);
  });

  it("recovers one approved native Stripe credit after its committed POST loses the response and the SQLite runtime restarts", async () => {
    const caseId = `native-credit-restart-${crypto.randomUUID()}`;
    const ownerId = `intercom:local-demo:contact:contact-${caseId}`;
    enableSyntheticIntercom();
    enableSyntheticStripe();
    let fingerprint = "";
    const observed = {
      posts: 0,
      idempotencyKeys: [] as string[],
      remoteCommitted: false,
    };
    vi.stubGlobal(
      "fetch",
      creditResponseLossStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
      }),
    );
    const creditResponse = jsonModel({
      draftResponse: "After approval, we can add a credit to your next bill.",
      citedSources: ["service-problem-credit-policy"],
      selectedPolicyExcerpts: [
        {
          source: "service-problem-credit-policy",
          excerpt:
            "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
        },
      ],
      recommendRefund: false,
      resolutionAction: "subscription_credit",
      subscriptionCreditAmount: 49,
      subscriptionCreditCurrency: "USD",
      subscriptionCreditReason: "Verified service outage",
      requiresEscalation: false,
    }) as never;
    const initial = await setup(caseId, undefined, undefined, undefined, {
      credit: true,
      ownerId,
      source: "intercom-conversation",
      supportSource: "intercom",
      providerBindings: syntheticIntercomStripeBindings(caseId),
      message: "Our service outage prevented me from using my subscription.",
      triage: {
        intent: "service_problem",
        urgency: "normal",
        sentiment: "negative",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "Verified service outage.",
      },
      responseModel: creditResponse,
    });
    const native = initial.native!;
    fingerprint = native.fingerprint;
    const command = await initial.caseStore.getAction(
      caseId,
      "subscription-credit-command",
      fingerprint,
    );
    expect(command).toMatchObject({
      customerId: "cus_credit_restart",
      subscriptionId: "sub_credit_restart",
      amount: { currency: "USD", minor: 4900 },
    });
    // Exercise the registered HTTP route. The native tool reaches Stripe once,
    // records an unknown attempt after response loss, and the route must leave
    // its dispatch suspended instead of completing the enclosing workflow.
    const approval = await initial.app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          commandFingerprint: fingerprint,
          serviceProblemConfirmed: true,
        }),
      },
    );
    expect(approval.status).toBe(200);
    expect(observed).toMatchObject({ posts: 1, remoteCommitted: true });
    expect(
      await initial.caseStore.stripeSubscriptionCreditAttempt(
        String(command!.idempotencyKey),
      ),
    ).toMatchObject({ status: "unknown" });
    expect(
      (await initial.caseStore.get(caseId))?.subscriptionCreditResult,
    ).toBeUndefined();
    await expect(
      initial.caseStore.customerFinancialRequests([caseId]),
    ).resolves.toMatchObject([
      { type: "subscription_credit", status: "unknown" },
    ]);
    const initialDispatch = await initial.caseStore.getClient().execute({
      sql: "SELECT state, lease_until FROM support_dispatch WHERE case_id = ?",
      args: [caseId],
    });
    expect(initialDispatch.rows).toEqual([
      expect.objectContaining({ state: "suspended" }),
    ]);
    const databasePath = initial.databasePath!;
    await initial.mastra.shutdown();
    runtimes.splice(runtimes.indexOf(initial.mastra), 1);

    // Recreate Mastra and reopen the same durable SQLite DB. The provider now
    // exposes its committed receipt while the subscription is cancelled.
    const restarted = await setup(caseId, undefined, undefined, undefined, {
      credit: true,
      databasePath,
      existingCase: true,
      supportSource: "intercom",
      providerBindings: syntheticIntercomStripeBindings(caseId),
      responseModel: creditResponse,
    });
    const project = vi.spyOn(
      restarted.caseStore,
      "projectSubscriptionCreditToolExecution",
    );
    expect(
      await restarted.recoverApprovedNativeDecisions(
        restarted.mastra,
        restarted.caseStore,
        { disableScorers: true },
      ),
    ).toBe(1);
    expect(observed.posts).toBe(1);
    expect(observed.idempotencyKeys).toEqual([command!.idempotencyKey]);
    expect(project).toHaveBeenCalledTimes(1);
    expect(
      await restarted.caseStore.stripeSubscriptionCreditAttempt(
        String(command!.idempotencyKey),
      ),
    ).toMatchObject({
      status: "succeeded",
      creditId: "cbtxn_credit_restart",
    });
    expect(
      await restarted.caseStore.idempotency(String(command!.idempotencyKey)),
    ).toMatchObject({
      fingerprint,
      effect: { creditId: "cbtxn_credit_restart", status: "succeeded" },
    });
    expect(await restarted.caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      subscriptionCreditResult: {
        creditId: "cbtxn_credit_restart",
        status: "skipped",
      },
      finalResponse: expect.stringMatching(/future invoice/i),
    });
    const followUp = await restarted.caseStore.appendFollowUp({
      caseId,
      eventId: `credit-follow-up-${crypto.randomUUID()}`,
      runId: `credit-follow-up-run-${crypto.randomUUID()}`,
      message: {
        id: `credit-follow-up-message-${crypto.randomUUID()}`,
        author: "customer",
        body: "When will my next invoice reflect the credit?",
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp.appended).toBe(true);
    const [followUpDispatch] = await restarted.caseStore.claimDispatch();
    expect(followUpDispatch?.turnId).toBe(followUp.turnId);
    expect(await restarted.caseStore.activateDispatch(followUpDispatch!)).toBe(
      true,
    );
    const recoveredCase = await restarted.caseStore.get(caseId);
    expect(recoveredCase).toBeDefined();
    expect(recoveredCase?.subscriptionCreditResult).toBeUndefined();
    expect((await restarted.caseStore.turns(caseId))[0]?.outcome).toMatchObject(
      {
        subscriptionCreditResult: {
          creditId: "cbtxn_credit_restart",
          status: "skipped",
        },
      },
    );
    const { computeSubscriptionCreditMetrics } =
      await import("../../src/mastra/lib/monitoring");
    await expect(
      computeSubscriptionCreditMetrics([recoveredCase!]),
    ).resolves.toMatchObject({
      executed: 1,
      executedTotals: [{ currency: "USD", minor: 4900 }],
    });
    expect(
      await restarted.recoverApprovedNativeDecisions(
        restarted.mastra,
        restarted.caseStore,
        { disableScorers: true },
      ),
    ).toBe(0);
    expect(observed.posts).toBe(1);
  });

  it.each([
    {
      label: "subscription drift",
      preflightFailure: "subscription" as const,
    },
    {
      label: "a prior credit observed after quote",
      preflightFailure: "prior-credit" as const,
    },
    { label: "a final authorization-fence loss", preflightFailure: undefined },
  ])(
    "terminalizes a proven pre-POST Stripe credit failure from HTTP approval and does not recover it after restart: $label",
    async ({ preflightFailure }) => {
      const caseId = `native-credit-prepost-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let fingerprint = "";
      const observed: {
        posts: number;
        idempotencyKeys: string[];
        remoteCommitted: boolean;
        preflightFailure?: "subscription" | "prior-credit";
      } = {
        posts: 0,
        idempotencyKeys: [],
        remoteCommitted: false,
      };
      vi.stubGlobal(
        "fetch",
        creditResponseLossStripeTransport({
          caseId,
          fingerprint: () => fingerprint,
          observed,
        }),
      );
      const creditResponse = jsonModel({
        draftResponse: "After approval, we can add a credit to your next bill.",
        citedSources: ["service-problem-credit-policy"],
        selectedPolicyExcerpts: [
          {
            source: "service-problem-credit-policy",
            excerpt:
              "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
          },
        ],
        recommendRefund: false,
        resolutionAction: "subscription_credit",
        subscriptionCreditAmount: 49,
        subscriptionCreditCurrency: "USD",
        subscriptionCreditReason: "Verified service outage",
        requiresEscalation: false,
      }) as never;
      const initial = await setup(caseId, undefined, undefined, undefined, {
        credit: true,
        providerBindings: syntheticStripeBindings(caseId),
        message: "Our service outage prevented me from using my subscription.",
        triage: {
          intent: "service_problem",
          urgency: "normal",
          sentiment: "negative",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Verified service outage.",
        },
        responseModel: creditResponse,
      });
      const native = initial.native!;
      fingerprint = native.fingerprint;
      const command = await initial.caseStore.getAction(
        caseId,
        "subscription-credit-command",
        fingerprint,
      );
      observed.preflightFailure = preflightFailure;
      if (!preflightFailure)
        vi.spyOn(
          initial.caseStore,
          "authorizeStripeSubscriptionCreditFirstEffect",
        ).mockResolvedValue(false);

      expect(
        (await approveNativeRefund(initial.app, caseId, fingerprint, true))
          .status,
      ).toBe(200);
      expect(observed).toMatchObject({ posts: 0, remoteCommitted: false });
      expect(observed.idempotencyKeys).toEqual([]);
      expect(
        await initial.caseStore.stripeSubscriptionCreditAttempt(
          String(command!.idempotencyKey),
        ),
      ).toMatchObject({
        status: "failed",
        providerStatus: "confirmed-no-effect",
        terminalAt: expect.any(String),
      });
      expect(
        await initial.caseStore.getAction(
          caseId,
          "subscription-credit-failure",
          fingerprint,
        ),
      ).toMatchObject({ classification: "confirmed-no-effect" });
      expect(await initial.caseStore.get(caseId)).toMatchObject({
        status: "escalated",
        finalResponse: expect.stringMatching(/additional review/i),
      });
      const outbox = await initial.caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ? AND originating_turn_id = ? AND status = 'escalated'",
        args: [caseId, native.turnId],
      });
      expect(Number(outbox.rows[0]?.total)).toBe(1);

      const databasePath = initial.databasePath!;
      await initial.mastra.shutdown();
      runtimes.splice(runtimes.indexOf(initial.mastra), 1);
      const restarted = await setup(caseId, undefined, undefined, undefined, {
        credit: true,
        databasePath,
        existingCase: true,
        providerBindings: syntheticStripeBindings(caseId),
        responseModel: creditResponse,
      });
      expect(
        await restarted.recoverApprovedNativeDecisions(
          restarted.mastra,
          restarted.caseStore,
          { disableScorers: true },
        ),
      ).toBe(0);
      expect(observed.posts).toBe(0);
      const postRestartOutbox = await restarted.caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ? AND originating_turn_id = ? AND status = 'escalated'",
        args: [caseId, native.turnId],
      });
      expect(Number(postRestartOutbox.rows[0]?.total)).toBe(1);
    },
  );

  it("hands a proven pre-POST refusal to a reclaimed native lease without allowing the stale worker to overwrite it", async () => {
    const caseId = `native-credit-reclaimed-prepost-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    let releasePreflight!: () => void;
    let preflightStarted!: () => void;
    const observed: {
      posts: number;
      idempotencyKeys: string[];
      remoteCommitted: boolean;
      preflightBarrier?: { started: () => void; release: Promise<void> };
    } = { posts: 0, idempotencyKeys: [], remoteCommitted: false };
    vi.stubGlobal(
      "fetch",
      creditResponseLossStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
      }),
    );
    const creditResponse = jsonModel({
      draftResponse: "After approval, we can add a credit to your next bill.",
      citedSources: ["service-problem-credit-policy"],
      selectedPolicyExcerpts: [
        {
          source: "service-problem-credit-policy",
          excerpt:
            "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
        },
      ],
      recommendRefund: false,
      resolutionAction: "subscription_credit",
      subscriptionCreditAmount: 49,
      subscriptionCreditCurrency: "USD",
      subscriptionCreditReason: "Verified service outage",
      requiresEscalation: false,
    }) as never;
    const initial = await setup(caseId, undefined, undefined, undefined, {
      credit: true,
      providerBindings: syntheticStripeBindings(caseId),
      message: "Our service outage prevented me from using my subscription.",
      triage: {
        intent: "service_problem",
        urgency: "normal",
        sentiment: "negative",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "Verified service outage.",
      },
      responseModel: creditResponse,
    });
    const native = initial.native!;
    fingerprint = native.fingerprint;
    const command = await initial.caseStore.getAction(
      caseId,
      "subscription-credit-command",
      fingerprint,
    );
    const preflightRelease = new Promise<void>((resolve) => {
      releasePreflight = resolve;
    });
    const preflightStartedPromise = new Promise<void>((resolve) => {
      preflightStarted = resolve;
    });
    observed.preflightBarrier = {
      started: preflightStarted,
      release: preflightRelease,
    };

    const approval = approveNativeRefund(
      initial.app,
      caseId,
      fingerprint,
      true,
    );
    await preflightStartedPromise;
    const original = await initial.caseStore.getClient().execute({
      sql: "SELECT id, lease_token FROM support_dispatch WHERE case_id = ?",
      args: [caseId],
    });
    const dispatchId = String(original.rows[0]?.id);
    const originalLeaseToken = String(original.rows[0]?.lease_token);
    await initial.caseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ? AND lease_token = ?",
      args: [
        new Date(Date.now() - 1_000).toISOString(),
        dispatchId,
        originalLeaseToken,
      ],
    });
    const [reclaimed] = await initial.caseStore.claimDispatch();
    expect(reclaimed).toMatchObject({
      id: dispatchId,
      caseId,
      turnId: native.turnId,
    });
    expect(reclaimed.leaseToken).not.toBe(originalLeaseToken);

    releasePreflight();
    // The route reports its stale completion as a conflict; it must not turn
    // that into a second approval outcome under the reclaimed lease.
    expect((await approval).status).toBe(409);
    expect(observed.posts).toBe(0);
    expect(
      await initial.caseStore.stripeSubscriptionCreditAttempt(
        String(command!.idempotencyKey),
      ),
    ).toMatchObject({
      status: "prepared",
      providerStatus: "prepost-no-effect",
    });
    const retainedLease = await initial.caseStore.getClient().execute({
      sql: "SELECT state, lease_token FROM support_dispatch WHERE id = ?",
      args: [dispatchId],
    });
    expect(retainedLease.rows).toEqual([
      expect.objectContaining({
        state: "claimed",
        lease_token: reclaimed!.leaseToken,
      }),
    ]);

    // The stale HTTP worker cannot close the case. After this reclaim expires,
    // the next native recovery owns the proof and closes the one prepared
    // attempt without searching forever or issuing a replacement POST.
    await initial.caseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ? AND lease_token = ?",
      args: [
        new Date(Date.now() - 1_000).toISOString(),
        dispatchId,
        reclaimed!.leaseToken!,
      ],
    });
    expect(
      await initial.recoverApprovedNativeDecisions(
        initial.mastra,
        initial.caseStore,
        { disableScorers: true },
      ),
    ).toBe(1);
    expect(observed.posts).toBe(0);
    expect(
      await initial.caseStore.stripeSubscriptionCreditAttempt(
        String(command!.idempotencyKey),
      ),
    ).toMatchObject({
      status: "failed",
      providerStatus: "confirmed-no-effect",
    });
    expect(await initial.caseStore.get(caseId)).toMatchObject({
      status: "escalated",
    });
    const failures = await initial.caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_actions WHERE case_id = ? AND kind = 'subscription-credit-failure' AND fingerprint = ?",
      args: [caseId, fingerprint],
    });
    expect(Number(failures.rows[0]?.total)).toBe(1);
  });

  it.each([400, 401, 403, 404, 422])(
    "terminalizes a definite Stripe credit refusal HTTP %i once without entering receipt recovery",
    async (postStatus) => {
      const caseId = `native-credit-refusal-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let fingerprint = "";
      const observed = {
        posts: 0,
        idempotencyKeys: [] as string[],
        remoteCommitted: false,
      };
      vi.stubGlobal(
        "fetch",
        creditResponseLossStripeTransport({
          caseId,
          fingerprint: () => fingerprint,
          postStatus,
          observed,
        }),
      );
      const initial = await setup(caseId, undefined, undefined, undefined, {
        credit: true,
        providerBindings: syntheticStripeBindings(caseId),
        message: "Our service outage prevented me from using my subscription.",
        triage: {
          intent: "service_problem",
          urgency: "normal",
          sentiment: "negative",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Verified service outage.",
        },
        responseModel: jsonModel({
          draftResponse:
            "After approval, we can add a credit to your next bill.",
          citedSources: ["service-problem-credit-policy"],
          selectedPolicyExcerpts: [
            {
              source: "service-problem-credit-policy",
              excerpt:
                "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
            },
          ],
          recommendRefund: false,
          resolutionAction: "subscription_credit",
          subscriptionCreditAmount: 49,
          subscriptionCreditCurrency: "USD",
          subscriptionCreditReason: "Verified service outage",
          requiresEscalation: false,
        }) as never,
      });
      const native = initial.native!;
      fingerprint = native.fingerprint;
      const command = (await initial.caseStore.getAction(
        caseId,
        "subscription-credit-command",
        fingerprint,
      )) as { idempotencyKey: string };
      await initial.caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: fingerprint,
        principalId: "approver-demo",
        approved: true,
        serviceProblemConfirmed: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      expect(
        await initial.recoverApprovedNativeDecisions(
          initial.mastra,
          initial.caseStore,
          { disableScorers: true },
        ),
      ).toBe(1);
      expect(observed).toMatchObject({ posts: 1, remoteCommitted: false });
      expect(
        await initial.caseStore.stripeSubscriptionCreditAttempt(
          command.idempotencyKey,
        ),
      ).toMatchObject({
        status: "failed",
        providerStatus: "confirmed-no-effect",
        terminalAt: expect.any(String),
      });
      expect(
        await initial.caseStore.getAction(
          caseId,
          "subscription-credit-failure",
          fingerprint,
        ),
      ).toMatchObject({ classification: "confirmed-no-effect" });
      const failedCase = await initial.caseStore.get(caseId);
      expect(failedCase).toMatchObject({
        status: "escalated",
        finalResponse: expect.stringMatching(/additional review/i),
      });
      await expect(
        initial.caseStore.customerFinancialRequests([caseId]),
      ).resolves.toMatchObject([
        { type: "subscription_credit", status: "failed" },
      ]);
      const { computeSubscriptionCreditMetrics } =
        await import("../../src/mastra/lib/monitoring");
      await expect(
        computeSubscriptionCreditMetrics([failedCase!]),
      ).resolves.toMatchObject({ failed: 1 });
      expect(
        await initial.recoverApprovedNativeDecisions(
          initial.mastra,
          initial.caseStore,
          { disableScorers: true },
        ),
      ).toBe(0);
    },
  );

  it("escalates expired or replaced policy before a native Stripe credit can POST", async () => {
    for (const scenario of ["expired", "replaced"] as const) {
      const caseId = `native-credit-policy-${scenario}-${crypto.randomUUID()}`;
      const expiry =
        scenario === "expired" ? prepareKnowledgeExpiry() : undefined;
      enableSyntheticStripe();
      let fingerprint = "";
      const observed = {
        posts: 0,
        idempotencyKeys: [] as string[],
        remoteCommitted: false,
      };
      vi.stubGlobal(
        "fetch",
        creditResponseLossStripeTransport({
          caseId,
          fingerprint: () => fingerprint,
          observed,
        }),
      );
      const initial = await setup(caseId, undefined, undefined, undefined, {
        credit: true,
        ...(expiry ? { knowledgeExpiresAt: expiry.expiresAt } : {}),
        providerBindings: syntheticStripeBindings(caseId),
        message: "Our service outage prevented me from using my subscription.",
        triage: {
          intent: "service_problem",
          urgency: "normal",
          sentiment: "negative",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Verified service outage.",
        },
        responseModel: jsonModel({
          draftResponse:
            "After approval, we can add a credit to your next bill.",
          citedSources: ["service-problem-credit-policy"],
          selectedPolicyExcerpts: [
            {
              source: "service-problem-credit-policy",
              excerpt:
                "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
            },
          ],
          recommendRefund: false,
          resolutionAction: "subscription_credit",
          subscriptionCreditAmount: 49,
          subscriptionCreditCurrency: "USD",
          subscriptionCreditReason: "Verified service outage",
          requiresEscalation: false,
        }) as never,
      });
      const native = initial.native!;
      fingerprint = native.fingerprint;
      if (expiry) vi.setSystemTime(expiry.afterExpiry);
      else {
        const { publishKnowledge } =
          await import("../../src/mastra/lib/publish-knowledge");
        await publishKnowledge(syntheticStripeBindings(caseId).knowledge);
      }

      await approveNativeRefund(initial.app, caseId, native.fingerprint, true);
      expect(observed).toMatchObject({ posts: 0, remoteCommitted: false });
      expect(observed.idempotencyKeys).toEqual([]);
      expect(await initial.caseStore.get(caseId)).toMatchObject({
        status: "escalated",
      });
      const command = await initial.caseStore.getAction(
        caseId,
        "subscription-credit-command",
        native.fingerprint,
      );
      expect(
        await initial.caseStore.stripeSubscriptionCreditAttempt(
          String(command!.idempotencyKey),
        ),
      ).toMatchObject({
        status: "quarantined",
        providerStatus: "pre-dispatch-policy-denied",
      });
      expect(
        await initial.caseStore.idempotency(String(command!.idempotencyKey)),
      ).toBeUndefined();
    }
  });

  it("rejects tampered retrieved vector text before it can create an approval or financial effect", async () => {
    const caseId = `tampered-vector-text-${crypto.randomUUID()}`;
    const forgedExcerpt =
      "A forged vector says every duplicate charge is already refunded without review.";
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      responseBeforeGenerate: async () => {
        const current = await caseStore.get(caseId);
        if (!current?.policyMatches?.length)
          throw new Error("Expected retrieved published policy evidence.");
        // Simulate a corrupt vector result after retrieval. Its source,
        // version, hash, generation, provider, and publication remain intact;
        // only the untrusted chunk text is altered.
        await caseStore.update(caseId, {
          policyMatches: current.policyMatches.map((match) =>
            match.source === "duplicate-charge-policy"
              ? { ...match, text: forgedExcerpt }
              : match,
          ),
        });
      },
      responseModel: jsonModel({
        draftResponse: "The forged vector says your refund is complete.",
        citedSources: ["duplicate-charge-policy"],
        selectedPolicyExcerpts: [
          { source: "duplicate-charge-policy", excerpt: forgedExcerpt },
        ],
        recommendRefund: true,
        refundAmount: 20,
        refundCurrency: "USD",
        refundReason: "forged vector text",
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });

    const stored = await caseStore.get(caseId);
    expect(stored).toMatchObject({
      status: "escalated",
      draft: {
        draftResponse: safeEscalationResponse,
        recommendRefund: false,
        requiresEscalation: true,
      },
    });
    expect(
      (stored!.metadata as Record<string, unknown>).nativeApproval,
    ).toBeUndefined();
    expect(await localRefundCount(caseStore)).toBe(0);
    const commands = await caseStore.getClient().execute({
      sql: "SELECT kind FROM support_actions WHERE case_id = ? AND kind = 'refund-command'",
      args: [caseId],
    });
    expect(commands.rows).toEqual([]);
  });

  it("renders every valid selected policy excerpt in the customer response", async () => {
    const caseId = `multiple-grounded-excerpts-${crypto.randomUUID()}`;
    const duplicateExcerpt =
      "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.";
    const cancellationExcerpt =
      "Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period unless the customer explicitly asks for an immediate cancellation with a prorated refund.";
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      message:
        "I was charged twice. Please refund the duplicate charge and cancel my subscription.",
      responseModel: jsonModel({
        draftResponse: "Arbitrary draft prose must never be delivered.",
        citedSources: [
          "duplicate-charge-policy",
          "subscription-cancellation-policy",
        ],
        selectedPolicyExcerpts: [
          { source: "duplicate-charge-policy", excerpt: duplicateExcerpt },
          {
            source: "subscription-cancellation-policy",
            excerpt: cancellationExcerpt,
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });

    const outbox = await caseStore.getClient().execute({
      sql: "SELECT body FROM support_outbox WHERE case_id = ? ORDER BY id",
      args: [caseId],
    });
    const body = String(outbox.rows[0]?.body ?? "");
    expect(await caseStore.get(caseId)).toMatchObject({ status: "resolved" });
    expect(body).toContain(duplicateExcerpt);
    expect(body).toContain(cancellationExcerpt);
    expect(body).not.toContain("Arbitrary draft prose");
  });

  it("hands account issues to a specialist without claiming an account action", async () => {
    const caseId = `account-handoff-${crypto.randomUUID()}`;
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      triage: {
        intent: "account_issue",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "The customer needs account help.",
      },
      responseModel: jsonModel({
        draftResponse: "Your account has been updated.",
        citedSources: ["duplicate-charge-policy"],
        selectedPolicyExcerpts: [
          {
            source: "duplicate-charge-policy",
            excerpt:
              "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.",
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });

    const stored = await caseStore.get(caseId);
    expect(stored).toMatchObject({
      status: "escalated",
      draft: {
        draftResponse: safeEscalationResponse,
        requiresEscalation: true,
        escalationReason:
          "Account requests require a support specialist with verified account-service access.",
      },
    });
    expect(
      (stored!.metadata as Record<string, unknown>).nativeApproval,
    ).toBeUndefined();
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("keeps mandatory triage rationale ahead of the account handoff reason", async () => {
    const caseId = `account-triage-precedence-${crypto.randomUUID()}`;
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      triage: {
        intent: "account_issue",
        urgency: "high",
        sentiment: "negative",
        requiresHumanReview: true,
        confidence: 0.9,
        rationale: "The identity evidence needs a specialist review.",
      },
      responseModel: jsonModel({
        draftResponse: "Your account issue is resolved.",
        citedSources: ["duplicate-charge-policy"],
        selectedPolicyExcerpts: [
          {
            source: "duplicate-charge-policy",
            excerpt:
              "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.",
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });

    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      draft: {
        escalationReason:
          "Triage requires human review: The identity evidence needs a specialist review.",
      },
    });
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("lets the registered response Agent read only the durable current customer commerce scope", async () => {
    const caseId = `response-agent-lookup-${crypto.randomUUID()}`;
    const observedPrompts: LanguageModelV2Prompt[] = [];
    const { caseStore } = await setup(
      caseId,
      undefined,
      undefined,
      { amount: 1001, currency: "USD" },
      { responseModel: responseLookupModel(undefined, observedPrompts) },
    );
    // The second real Agent turn must carry this actual registered tool
    // result. Initial workflow context contains these fields, so it cannot
    // establish that the response Agent was able to call lookup_order.
    expect(responseLookupToolResult(observedPrompts).output).toMatchObject({
      type: "json",
      value: {
        found: true,
        order: {
          orderId: "ORD-1001",
          customerEmail: "alex@example.com",
          product: "Pro Plan - Monthly",
        },
      },
    });
    expect((await caseStore.get(caseId))?.draft).toMatchObject({
      draftResponse: "Verified lookup response.",
    });
  });

  it.each([
    {
      name: "a foreign owner with the durable provider binding",
      input: { customerEmail: "jordan@example.com", orderId: "ORD-1002" },
      error: "Commerce lookup scope does not match the verified case owner.",
    },
    {
      name: "a foreign provider account with the durable owner",
      input: {
        customerEmail: "alex@example.com",
        orderId: "ORD-1001",
        binding: {
          tenantId: "local-demo",
          providerKind: "local" as const,
          providerAccountId: "foreign-account",
          externalConversationId: "foreign-conversation",
        },
      },
      error: "Commerce lookup binding does not match the durable case.",
    },
  ])("denies response-agent lookup for $name", async ({ input, error }) => {
    const caseId = `response-agent-foreign-lookup-${crypto.randomUUID()}`;
    const observedPrompts: LanguageModelV2Prompt[] = [];
    const { caseStore } = await setup(
      caseId,
      undefined,
      undefined,
      { amount: 1001, currency: "USD" },
      { responseModel: responseLookupModel(input, observedPrompts) },
    );
    expect(responseLookupToolResult(observedPrompts).output).toMatchObject({
      type: "error-text",
      value: error,
    });
    expect((await caseStore.get(caseId))?.draft).toMatchObject({
      draftResponse: "Verified lookup response.",
    });
  });

  it("uses the authenticated server acceptance time for future and past inbound retention in runtime and CLI", async () => {
    const caseId = `acceptance-clock-${crypto.randomUUID()}`;
    const { app, caseStore } = await setup(caseId);
    const client = caseStore.getClient();
    const before = new Date();
    const accepted: Array<{ caseId: string; receivedAt: string }> = [];
    for (const receivedAt of [
      "2099-01-01T00:00:00.000Z",
      "2001-01-01T00:00:00.000Z",
    ]) {
      const response = await app.request(
        "http://support.test/support/inbound",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            externalId: `acceptance-event-${crypto.randomUUID()}`,
            conversationId: `acceptance-conversation-${crypto.randomUUID()}`,
            from: "alex@example.com",
            subject: "Acceptance-time retention",
            body: `synthetic body from ${receivedAt}`,
            receivedAt,
          }),
        },
      );
      expect(response.status).toBe(200);
      accepted.push({
        caseId: ((await response.json()) as { caseId: string }).caseId,
        receivedAt,
      });
      // Ingress starts resolution after accepting the case. The detached run
      // ends by either suspending for its native approval or returning its
      // dispatch to the retry queue after a recorded failure. Both durable
      // states occur after its final write; claimed/started would still own
      // the database as an active writer.
      await vi.waitFor(async () => {
        const dispatch = await client.execute({
          sql: "SELECT state FROM support_dispatch WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
          args: [accepted.at(-1)!.caseId],
        });
        expect(["suspended", "pending"]).toContain(
          String(dispatch.rows[0]?.state),
        );
      });
    }
    const after = new Date();
    // Retention must not use the untrusted occurrence timestamp to purge a
    // newly accepted case, regardless of the asynchronous resolution result.
    await vi.waitFor(async () => {
      for (const item of accepted)
        expect(await caseStore.get(item.caseId)).toMatchObject({
          id: item.caseId,
          customer: { email: "alex@example.com" },
        });
    });
    const stored = await Promise.all(
      accepted.map(async (item) => ({
        ...item,
        row: (
          await client.execute({
            sql: "SELECT accepted_at, data FROM support_cases WHERE id = ?",
            args: [item.caseId],
          })
        ).rows[0] as { accepted_at: string; data: string },
      })),
    );
    for (const item of stored) {
      const acceptedAt = new Date(item.row.accepted_at);
      expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(acceptedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(item.row.accepted_at).not.toBe(item.receivedAt);
      expect(JSON.parse(item.row.data).metadata.sourceOccurredAt).toBe(
        item.receivedAt,
      );
    }
    const latestAcceptedAt = Math.max(
      ...stored.map((item) => new Date(item.row.accepted_at).getTime()),
    );
    await caseStore.enforceRetention(
      () => new Date(latestAcceptedAt + 6 * 24 * 60 * 60 * 1_000),
    );
    for (const item of accepted)
      expect((await caseStore.get(item.caseId))?.metadata).toHaveProperty(
        "rawPayload",
      );
    await caseStore.enforceRetention(
      () => new Date(latestAcceptedAt + 8 * 24 * 60 * 60 * 1_000),
    );
    for (const item of accepted)
      expect((await caseStore.get(item.caseId))?.metadata).not.toHaveProperty(
        "rawPayload",
      );

    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/retention.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "test",
          SUPPORT_TEST_RETENTION_NOW: new Date(
            latestAcceptedAt + 91 * 24 * 60 * 60 * 1_000,
          ).toISOString(),
        },
      },
    );
    // setup also contains its own registered fixture case, which has the
    // same server-time window. Both authenticated ingress cases must be in
    // this durable CLI sweep regardless of that fixture.
    expect(JSON.parse(stdout).cases.casesRedacted).toBeGreaterThanOrEqual(2);
    for (const item of accepted) {
      const tombstone = await caseStore.get(item.caseId);
      expect(tombstone).toMatchObject({
        customer: { email: "redacted@invalid.local" },
        messages: [],
      });
      expect(tombstone?.metadata).toHaveProperty("retentionRedactedAt");
    }
  });

  it("durably retries a real portal follow-up when its registered response agent transport fails", async () => {
    const caseId = `portal-agent-failure-${crypto.randomUUID()}`;
    let responseCalls = 0;
    const { app, caseStore } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        responseBeforeGenerate: async () => {
          responseCalls += 1;
          if (responseCalls === 2)
            throw new Error("injected deterministic follow-up model failure");
        },
      },
    );
    const response = await app.request(
      `http://support.test/support/cases/${caseId}/follow-ups`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: "Please retry with the added detail." }),
      },
    );

    expect(response.status).toBe(500);
    expect(await caseStore.get(caseId)).toMatchObject({ status: "processing" });
    expect(await caseStore.turns(caseId)).toHaveLength(2);
    const dispatch = await caseStore.getClient().execute({
      sql: "SELECT state FROM support_dispatch WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [caseId],
    });
    expect(dispatch.rows[0]).toMatchObject({ state: "pending" });
  });

  it("renews a portal follow-up lease while the registered response agent transport is slow", async () => {
    const caseId = `portal-agent-slow-${crypto.randomUUID()}`;
    let responseCalls = 0;
    let entered!: () => void;
    const enteredSlowTransport = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const slowTransport = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app, caseStore } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        responseBeforeGenerate: async () => {
          responseCalls += 1;
          if (responseCalls === 2) {
            entered();
            await slowTransport;
          }
        },
      },
    );
    process.env.SUPPORT_TEST_DISPATCH_LEASE_MS = "30";
    process.env.SUPPORT_TEST_DISPATCH_HEARTBEAT_MS = "5";
    const renewDispatchLease = caseStore.renewDispatchLease.bind(caseStore);
    let observeControlledRenewal = false;
    let expectedDispatchId: string | undefined;
    let expectedLeaseToken: string | undefined;
    let controlledRenewalArgs: readonly [string, string] | undefined;
    let completeControlledRenewal!: () => void;
    const controlledRenewal = new Promise<void>((resolve) => {
      completeControlledRenewal = resolve;
    });
    const renew = vi
      .spyOn(caseStore, "renewDispatchLease")
      .mockImplementation(async (...args) => {
        const renewed = await renewDispatchLease(...args);
        if (
          observeControlledRenewal &&
          renewed &&
          args[0] === expectedDispatchId &&
          args[1] === expectedLeaseToken
        ) {
          controlledRenewalArgs = args;
          completeControlledRenewal();
        }
        return renewed;
      });
    const heartbeat = vi.spyOn(globalThis, "setInterval");

    let released = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    try {
      const request = app.request(
        `http://support.test/support/cases/${caseId}/follow-ups`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ body: "Please include this new detail." }),
        },
      );
      await enteredSlowTransport;
      const beforeRenewal = await caseStore.getClient().execute({
        sql: "SELECT id, turn_id, state, lease_token, lease_until FROM support_dispatch WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [caseId],
      });
      const initialLease = beforeRenewal.rows[0] as Record<string, unknown>;
      expect(["claimed", "started"]).toContain(initialLease.state);
      expect(heartbeat).toHaveBeenCalledWith(expect.any(Function), 5);
      const controlledHeartbeat = heartbeat.mock.calls.find(
        ([, interval]) => interval === 5,
      )?.[0] as (() => void) | undefined;
      expect(controlledHeartbeat).toEqual(expect.any(Function));
      expectedDispatchId = String(initialLease.id);
      expectedLeaseToken = String(initialLease.lease_token);
      // The exact production callback renews against a real CaseStore while
      // Date stays ten milliseconds before expiry. Advancing only Date then
      // proves the same owned lease survives its original deadline.
      vi.setSystemTime(
        new Date(Date.parse(String(initialLease.lease_until)) - 10),
      );
      observeControlledRenewal = true;
      controlledHeartbeat!();
      await controlledRenewal;
      expect(controlledRenewalArgs).toEqual([
        expectedDispatchId,
        expectedLeaseToken,
      ]);
      expect(renew.mock.calls.length).toBeGreaterThan(1);
      const afterRenewal = await caseStore.getClient().execute({
        sql: "SELECT state, lease_token, lease_until FROM support_dispatch WHERE id = ?",
        args: [String(initialLease.id)],
      });
      const renewedLease = afterRenewal.rows[0] as Record<string, unknown>;
      expect(renewedLease).toMatchObject({
        state: initialLease.state,
        lease_token: initialLease.lease_token,
      });
      vi.setSystemTime(
        new Date(Date.parse(String(initialLease.lease_until)) + 1),
      );
      expect(Date.now()).toBeGreaterThan(
        Date.parse(String(initialLease.lease_until)),
      );
      expect(Date.parse(String(renewedLease.lease_until))).toBeGreaterThan(
        Date.now(),
      );
      release();
      released = true;
      expect((await request).status).toBe(200);
    } finally {
      if (!released) release();
      vi.useRealTimers();
    }
  });

  it("renews a native recovery lease beyond its duration while the registered Agent is slow", async () => {
    const caseId = `native-agent-slow-${crypto.randomUUID()}`;
    let entered!: () => void;
    const enteredSlowTransport = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const slowTransport = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    process.env.SUPPORT_TEST_DISPATCH_LEASE_MS = "30";
    process.env.SUPPORT_TEST_DISPATCH_HEARTBEAT_MS = "5";
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const issueRefund = localRuntime.issueRefund.bind(localRuntime);
    const slowProvider = vi
      .spyOn(localRuntime, "issueRefund")
      .mockImplementation(async (command, authorization) => {
        entered();
        await slowTransport;
        return issueRefund(command, authorization);
      });
    const renewDispatchLease = caseStore.renewDispatchLease.bind(caseStore);
    let observeControlledRenewal = false;
    let expectedDispatchId: string | undefined;
    let expectedLeaseToken: string | undefined;
    let controlledRenewalArgs: readonly [string, string] | undefined;
    let completeControlledRenewal!: () => void;
    const controlledRenewal = new Promise<void>((resolve) => {
      completeControlledRenewal = resolve;
    });
    const renew = vi
      .spyOn(caseStore, "renewDispatchLease")
      .mockImplementation(async (...args) => {
        const renewed = await renewDispatchLease(...args);
        if (
          observeControlledRenewal &&
          renewed &&
          args[0] === expectedDispatchId &&
          args[1] === expectedLeaseToken
        ) {
          controlledRenewalArgs = args;
          completeControlledRenewal();
        }
        return renewed;
      });
    const heartbeat = vi.spyOn(globalThis, "setInterval");

    let released = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    try {
      const recovery = recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      });
      await enteredSlowTransport;
      const beforeRenewal = await caseStore.getClient().execute({
        sql: "SELECT id, state, lease_token, lease_until FROM support_dispatch WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [caseId],
      });
      const initialLease = beforeRenewal.rows[0] as Record<string, unknown>;
      expect(["claimed", "started"]).toContain(initialLease.state);
      expect(heartbeat).toHaveBeenCalledWith(expect.any(Function), 5);
      const controlledHeartbeat = heartbeat.mock.calls.find(
        ([, interval]) => interval === 5,
      )?.[0] as (() => void) | undefined;
      expect(controlledHeartbeat).toEqual(expect.any(Function));
      expectedDispatchId = String(initialLease.id);
      expectedLeaseToken = String(initialLease.lease_token);
      // Exercise the registered callback against the real fenced store before
      // expiry, then finish the native Agent after the original deadline.
      vi.setSystemTime(
        new Date(Date.parse(String(initialLease.lease_until)) - 10),
      );
      observeControlledRenewal = true;
      controlledHeartbeat!();
      await controlledRenewal;
      expect(controlledRenewalArgs).toEqual([
        expectedDispatchId,
        expectedLeaseToken,
      ]);
      expect(renew.mock.calls.length).toBeGreaterThan(1);
      const afterRenewal = await caseStore.getClient().execute({
        sql: "SELECT state, lease_token, lease_until FROM support_dispatch WHERE id = ?",
        args: [String(initialLease.id)],
      });
      const renewedLease = afterRenewal.rows[0] as Record<string, unknown>;
      expect(renewedLease).toMatchObject({
        state: initialLease.state,
        lease_token: initialLease.lease_token,
      });
      vi.setSystemTime(
        new Date(Date.parse(String(initialLease.lease_until)) + 1),
      );
      expect(Date.now()).toBeGreaterThan(
        Date.parse(String(initialLease.lease_until)),
      );
      expect(Date.parse(String(renewedLease.lease_until))).toBeGreaterThan(
        Date.now(),
      );
      release();
      released = true;
      expect(await recovery).toBe(1);
      expect(await localRefundCount(caseStore)).toBe(1);
      expect((await caseStore.get(caseId))?.status).toBe("resolved");
    } finally {
      if (!released) release();
      vi.useRealTimers();
      slowProvider.mockRestore();
    }
  });

  it("does not project a native recovery after its heartbeat loses the replacement token", async () => {
    const caseId = `native-agent-lost-lease-${crypto.randomUUID()}`;
    let entered!: () => void;
    const enteredSlowTransport = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const slowTransport = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    process.env.SUPPORT_TEST_DISPATCH_LEASE_MS = "30";
    process.env.SUPPORT_TEST_DISPATCH_HEARTBEAT_MS = "5";
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const issueRefund = localRuntime.issueRefund.bind(localRuntime);
    const slowProvider = vi
      .spyOn(localRuntime, "issueRefund")
      .mockImplementation(async (command, authorization) => {
        entered();
        await slowTransport;
        return issueRefund(command, authorization);
      });
    const renewDispatchLease = caseStore.renewDispatchLease.bind(caseStore);
    let heartbeatCallback: (() => void) | undefined;
    let lostHeartbeat!: () => void;
    const lostHeartbeatObserved = new Promise<void>((resolve) => {
      lostHeartbeat = resolve;
    });
    const renew = vi
      .spyOn(caseStore, "renewDispatchLease")
      .mockImplementation(async (...args) => {
        const renewed = await renewDispatchLease(...args);
        if (!renewed) lostHeartbeat();
        return renewed;
      });
    const originalSetInterval = globalThis.setInterval.bind(globalThis);
    const heartbeat = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation((callback, interval) => {
        if (interval === 5) {
          heartbeatCallback = callback as () => void;
          // Keep the test in control of the callback so it proves the exact
          // replacement-token transition without scheduler timing.
          return originalSetInterval(() => undefined, 60_000);
        }
        return originalSetInterval(callback, interval);
      });

    let released = false;
    // Keep the short test-only lease valid until the captured heartbeat is
    // invoked. The real timer is replaced below; only Date is controlled.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    try {
      const recovery = recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      });
      await enteredSlowTransport;
      expect(heartbeatCallback).toEqual(expect.any(Function));
      await caseStore.getClient().execute({
        sql: "UPDATE support_dispatch SET lease_token = ? WHERE case_id = ?",
        args: ["replacement-owner", caseId],
      });
      heartbeatCallback!();
      await lostHeartbeatObserved;
      release();
      released = true;
      expect(await recovery).toBe(0);
    } finally {
      if (!released) release();
      heartbeat.mockRestore();
      renew.mockRestore();
      slowProvider.mockRestore();
      vi.useRealTimers();
    }
    expect(await localRefundCount(caseStore)).toBe(0);
    // The winning decision has already moved the case into its durable
    // processing projection. The stale worker must not advance it to a
    // refund/final outcome after another lease owner takes over.
    expect((await caseStore.get(caseId))?.status).toBe("processing");
    const dispatch = await caseStore.getClient().execute({
      sql: "SELECT state, lease_token FROM support_dispatch WHERE case_id = ?",
      args: [caseId],
    });
    expect(dispatch.rows[0]).toMatchObject({
      state: "claimed",
      lease_token: "replacement-owner",
    });
  });

  it("removes an expired real native snapshot while preserving another active native approval", async () => {
    const caseId = "retention-real-native";
    const {
      binding,
      caseStore,
      mastra,
      purgeExpiredWorkflowSnapshots,
      selectExecutionCase,
    } = await setup(caseId);
    const supportCase = await caseStore.get(caseId);
    const native = (supportCase!.metadata as Record<string, unknown>)
      .nativeApproval as { runId: string };
    const activeCaseId = "retention-active-native";
    const activeRunId = `workflow-${activeCaseId}`;
    const createdAt = new Date().toISOString();
    await caseStore.acceptInbound(
      {
        id: activeCaseId,
        externalId: `event-${activeCaseId}`,
        source: "mock-email",
        customer: { email: "alex@example.com" },
        subject: "I was charged twice again",
        messages: [
          {
            id: `message-${activeCaseId}`,
            author: "customer",
            body: "Please review another duplicate charge.",
            createdAt,
          },
        ],
        status: "new",
        createdAt,
        updatedAt: createdAt,
        metadata: {
          providerBinding: {
            ...binding,
            externalConversationId: `conversation-${activeCaseId}`,
          },
          ownerId: "customer-alex",
        },
      },
      `event-${activeCaseId}`,
      activeRunId,
    );
    const activeDispatch = await caseStore.claimDispatchForStart(
      activeCaseId,
      activeRunId,
    );
    if (!activeDispatch) throw new Error("Expected active native dispatch.");
    expect(await caseStore.activateDispatch(activeDispatch)).toBe(true);
    selectExecutionCase(activeCaseId);
    const activeResult = await (
      await mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .createRun({ runId: activeRunId, disableScorers: true })
    ).start({
      inputData: { caseId: activeCaseId, turnId: activeDispatch.turnId },
    });
    expect(activeResult.status).toBe("suspended");
    await caseStore.completeDispatch(
      activeDispatch.id,
      "suspended",
      undefined,
      activeDispatch.leaseToken,
    );
    const activeNative = (
      (await caseStore.get(activeCaseId))!.metadata as Record<string, unknown>
    ).nativeApproval as { runId: string };
    const workflows = await mastra.getStorage()?.getStore("workflows");
    const before = await workflows?.listWorkflowRuns({ perPage: false });
    const nativeSnapshot = before?.runs.find(
      (run) => run.runId === native.runId,
    );
    expect([
      "agentic-loop",
      "durable-agentic-loop",
      "executionWorkflow",
    ]).toContain(nativeSnapshot?.workflowName);
    const activeSnapshot = before?.runs.find(
      (run) => run.runId === activeNative.runId,
    );
    expect([
      "agentic-loop",
      "durable-agentic-loop",
      "executionWorkflow",
    ]).toContain(activeSnapshot?.workflowName);
    const old = "2026-05-01T00:00:00.000Z";
    await caseStore.getClient().execute({
      sql: "UPDATE support_cases SET created_at = ?, accepted_at = ? WHERE id = ?",
      args: [old, old, caseId],
    });
    const retention = await caseStore.enforceRetention(
      () => new Date("2026-09-05T00:00:00.000Z"),
    );
    const deleted = await purgeExpiredWorkflowSnapshots(
      mastra.getStorage(),
      retention,
    );
    expect(deleted).toContain(
      `${nativeSnapshot!.workflowName}:${native.runId}`,
    );
    expect(
      (await workflows?.listWorkflowRuns({ perPage: false }))?.runs.some(
        (run) => run.runId === native.runId,
      ),
    ).toBe(false);
    expect(
      (await workflows?.listWorkflowRuns({ perPage: false }))?.runs.some(
        (run) => run.runId === activeNative.runId,
      ),
    ).toBe(true);
  });

  it("expires an actual registered inbound workflow snapshot after seven days", async () => {
    const caseId = `retention-ingest-${crypto.randomUUID()}`;
    const { caseStore, mastra, purgeExpiredWorkflowSnapshots } =
      await setup(caseId);
    const runId = `ingest-snapshot-${crypto.randomUUID()}`;
    const ingested = await (
      await mastra
        .getWorkflow("ingestSupportCaseWorkflow")
        .createRun({ runId, disableScorers: true })
    ).start({
      inputData: {
        payload: {
          externalId: `ingest-event-${crypto.randomUUID()}`,
          conversationId: `conversation-${caseId}`,
          from: "alex@example.com",
          subject: "A retention-bound inbound request",
          body: "Please review this duplicate charge.",
        },
        ingress: {
          id: "customer-alex",
          email: "alex@example.com",
          tenantId: "local-demo",
          roles: ["customer"],
        },
      },
    });
    expect(ingested.status).toBe("success");
    await vi.waitFor(async () => {
      expect((await caseStore.get(ingested.result.caseId))?.status).toBe(
        "waiting_approval",
      );
    });
    const workflows = await mastra.getStorage()?.getStore("workflows");
    const created = (
      await workflows?.listWorkflowRuns({ perPage: false })
    )?.runs.find((run) => run.runId === runId);
    expect(created).toMatchObject({
      runId,
      workflowName: "ingest-support-case",
    });
    const aged = "2026-08-20T00:00:00.000Z";
    await caseStore.getClient().execute({
      sql: "UPDATE mastra_workflow_snapshot SET createdAt = ?, updatedAt = ? WHERE workflow_name = ? AND run_id = ?",
      args: [aged, aged, created!.workflowName, runId],
    });
    expect(
      await purgeExpiredWorkflowSnapshots(mastra.getStorage(), {
        rawWorkflowSnapshotBefore: "2026-08-27T00:00:00.000Z",
        expiredCaseIds: [],
        expiredWorkflowRunIds: [],
      }),
    ).toContain(`${created!.workflowName}:${runId}`);
    expect(
      (await workflows?.listWorkflowRuns({ perPage: false }))?.runs.some(
        (run) => run.runId === runId,
      ),
    ).toBe(false);
  });

  it("escalates an actual persisted failed workflow snapshot without starting it again", async () => {
    const caseId = `failed-snapshot-${crypto.randomUUID()}`;
    const { caseStore, mastra } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { deferInitialWorkflow: true },
    );
    const runId = `workflow-${caseId}`;
    const workflow = mastra.getWorkflow("resolveSupportCaseWorkflow");
    const failedRun = await workflow.createRun({
      runId,
      disableScorers: true,
    });
    const failed = await failedRun.start({
      inputData: {
        caseId: `missing-${crypto.randomUUID()}`,
        turnId: `missing-turn-${crypto.randomUUID()}`,
      },
    });
    expect(failed.status).toBe("failed");
    expect(await workflow.getWorkflowRunById(runId)).toMatchObject({
      status: "failed",
    });

    const createRun = vi.spyOn(workflow, "createRun");
    const { recoverLocalWorkflows } =
      await import("../../src/mastra/runtime/local-runtime");
    expect(await recoverLocalWorkflows(mastra, 1, caseStore)).toBe(1);

    expect(createRun).not.toHaveBeenCalled();
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      escalationReason: "Workflow recovery failed: failed",
    });
    const dispatches = await caseStore.getClient().execute({
      sql: "SELECT state, run_id FROM support_dispatch WHERE case_id = ?",
      args: [caseId],
    });
    expect(dispatches.rows).toEqual([{ state: "failed", run_id: runId }]);
  });

  it("invalidates a real pending native approval when a follow-up is appended", async () => {
    const caseId = `follow-up-invalidates-native-${crypto.randomUUID()}`;
    const { caseStore, native } = await setup(caseId);
    const followUp = await caseStore.appendFollowUp({
      caseId,
      eventId: `follow-up-invalidates-event-${crypto.randomUUID()}`,
      runId: `follow-up-invalidates-run-${crypto.randomUUID()}`,
      message: {
        id: `follow-up-invalidates-message-${crypto.randomUUID()}`,
        author: "customer",
        body: "Please reconsider this request with new information.",
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp).toMatchObject({
      appended: true,
      turnId: expect.any(String),
    });
    const invalidated = await caseStore.get(caseId);
    expect(invalidated).toMatchObject({ status: "new" });
    expect(
      (invalidated!.metadata as Record<string, unknown>).nativeApproval,
    ).toBeUndefined();
    expect(
      await caseStore.approvalDecision(caseId, native.turnId),
    ).toBeUndefined();
    expect(await caseStore.nativeDecisionsNeedingRecovery()).toEqual([]);
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("reopens a pre-suspension command binding with the same fingerprint and rejects a changed command", async () => {
    const caseId = `bind-crash-${crypto.randomUUID()}`;
    const { caseStore, mastra } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { deferInitialWorkflow: true },
    );
    const dispatch = await caseStore.claimDispatchForStart(
      caseId,
      `workflow-${caseId}`,
    );
    if (!dispatch) throw new Error("Expected the initial workflow dispatch.");
    await caseStore.markDispatchStarted(dispatch.id, dispatch.leaseToken);
    const beforeFault = await caseStore.get(caseId);
    await caseStore.update(caseId, {
      workflowRunId: `workflow-${caseId}`,
      metadata: {
        ...beforeFault!.metadata,
        activeTurnId: dispatch.turnId,
      },
    });
    const originalBind = caseStore.bindTurnCommand.bind(caseStore);
    const bind = vi
      .spyOn(caseStore, "bindTurnCommand")
      .mockImplementation(async (boundCaseId, turnId, fingerprint) => {
        await originalBind(boundCaseId, turnId, fingerprint);
        throw new Error("injected crash after durable command binding");
      });
    const executionAgent = mastra.getAgent("refundExecutionAgent");
    const generate = vi.spyOn(executionAgent, "generate");
    const initial = await mastra
      .getWorkflow("resolveSupportCaseWorkflow")
      .createRun({ runId: `workflow-${caseId}`, disableScorers: true });
    const initialResult = await initial.start({
      inputData: { caseId, turnId: dispatch.turnId },
    });
    bind.mockRestore();
    expect(initialResult.status).toBe("failed");
    expect(generate).not.toHaveBeenCalled();
    const boundTurn = await caseStore.turn(caseId, dispatch.turnId);
    expect(boundTurn?.commandFingerprint).toEqual(expect.any(String));
    expect(
      await caseStore.getAction(
        caseId,
        "refund-command",
        boundTurn!.commandFingerprint!,
      ),
    ).toMatchObject({ fingerprint: boundTurn!.commandFingerprint });

    // A process exit cannot leave a failed Mastra snapshot behind. Remove the
    // test's caught-exception snapshot through Mastra's supported storage API,
    // then let the normal durable dispatcher reopen the same workflow run.
    const workflowStore = await mastra.getStorage()?.getStore?.("workflows");
    if (!workflowStore)
      throw new Error("Expected the configured workflow storage.");
    await workflowStore.deleteWorkflowRunById({
      workflowName: "resolve-support-case",
      runId: `workflow-${caseId}`,
    });
    expect(
      await mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .getWorkflowRunById(`workflow-${caseId}`),
    ).toBeNull();
    await mastra.shutdown();
    runtimes.splice(runtimes.indexOf(mastra), 1);
    vi.resetModules();
    const { mastra: reopenedMastra } = await import("../../src/mastra/index");
    const { caseStore: reopenedStore } =
      await import("../../src/mastra/lib/case-store");
    const { triageAgent: reopenedTriageAgent } =
      await import("../../src/mastra/agents/triage-agent");
    const { responseAgent: reopenedResponseAgent } =
      await import("../../src/mastra/agents/response-agent");
    const { refundExecutionAgent: reopenedExecutionAgent } =
      await import("../../src/mastra/agents/refund-execution-agent");
    runtimes.push(reopenedMastra);
    reopenedTriageAgent.__updateModel({
      model: jsonModel({
        intent: "duplicate_charge",
        urgency: "normal",
        sentiment: "negative",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "Deterministic duplicate-charge triage.",
      }) as never,
    });
    reopenedResponseAgent.__updateModel({
      model: jsonModel({
        draftResponse: "We will process the duplicate-charge refund.",
        citedSources: ["duplicate-charge-policy"],
        selectedPolicyExcerpts: [
          {
            source: "duplicate-charge-policy",
            excerpt:
              "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
          },
        ],
        recommendRefund: true,
        refundAmount: 20,
        refundCurrency: "USD",
        refundReason: "duplicate charge",
        requiresEscalation: false,
      }) as never,
    });
    const reopenedExecutionModel = async () => {
      const action = await reopenedStore.getClient().execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'refund-command' ORDER BY created_at DESC LIMIT 1",
        args: [caseId],
      });
      const command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as {
        idempotencyKey?: string;
        fingerprint?: string;
      };
      return refundModel({
        caseId,
        orderId: "ORD-1001",
        amount: 20,
        currency: "USD",
        reason: "duplicate charge",
        idempotencyKey: command.idempotencyKey,
        fingerprint: command.fingerprint,
      }) as never;
    };
    reopenedExecutionAgent.__updateModel({ model: reopenedExecutionModel });
    reopenedMastra
      .getAgent("refundExecutionAgent")
      .__updateModel({ model: reopenedExecutionModel });
    await reopenedStore.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ?",
      args: ["2000-01-01T00:00:00.000Z", dispatch.id],
    });
    const { recoverLocalWorkflows } =
      await import("../../src/mastra/runtime/local-runtime");
    expect(await recoverLocalWorkflows(reopenedMastra, 1, reopenedStore)).toBe(
      1,
    );
    const recovered = await reopenedStore.get(caseId);
    const native = (recovered!.metadata as Record<string, unknown>)
      .nativeApproval as {
      fingerprint: string;
      runId: string;
      turnId: string;
    };
    expect(recovered?.status).toBe("waiting_approval");
    expect(native).toMatchObject({
      fingerprint: boundTurn!.commandFingerprint,
      turnId: dispatch.turnId,
      runId: expect.any(String),
    });
    await expect(
      reopenedStore.bindTurnCommand(
        caseId,
        dispatch.turnId,
        "different-command-fingerprint",
      ),
    ).rejects.toThrow("already bound, or changed");
    const decision = await reopenedStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: "native-tool-call",
    });
    expect(decision.won).toBe(true);
    const { recoverApprovedNativeDecisions } =
      await import("../../src/mastra/runtime/local-runtime");
    expect(
      await recoverApprovedNativeDecisions(reopenedMastra, reopenedStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(await localRefundCount(reopenedStore)).toBe(1);
    expect(await reopenedStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { status: "executed", amount: 20 },
    });
  });

  it("executes exact at-limit JPY and KWD commands through the registered native Agent", async () => {
    for (const currency of ["JPY", "KWD"]) {
      const caseId = `currency-${currency}-${crypto.randomUUID()}`;
      const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(caseId, undefined, undefined, {
          amount: 1000,
          currency,
        });
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      expect(
        await recoverApprovedNativeDecisions(mastra, caseStore, {
          disableScorers: true,
        }),
      ).toBe(1);
      expect((await caseStore.get(caseId))?.refundResult).toMatchObject({
        amount: 1000,
        currency,
        status: "executed",
      });
    }
  });

  it("does not present a native command above the exact JPY/KWD policy limit", async () => {
    for (const currency of ["JPY", "KWD"]) {
      const caseId = `currency-over-${currency}-${crypto.randomUUID()}`;
      const { caseStore } = await setup(caseId, undefined, undefined, {
        amount: currency === "JPY" ? 1001 : 1000.001,
        currency,
      });
      expect(await localRefundCount(caseStore)).toBe(0);
      expect((await caseStore.get(caseId))?.status).toBe("escalated");
    }
  });

  it("automatically recovers a durable approval before native resume exactly once", async () => {
    const caseId = `decision-crash-${crypto.randomUUID()}`;
    const {
      binding,
      caseStore,
      mastra,
      native,
      recoverApprovedNativeDecisions,
    } = await setup(caseId);
    const decision = await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    expect(decision.won).toBe(true);

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(1);
    expect(
      await caseStore.approvalDecision(caseId, native.turnId),
    ).toMatchObject({
      approved: true,
      commandFingerprint: native.fingerprint,
    });
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { amount: 20, status: "executed" },
    });
    await expect(
      (
        await import("../../src/mastra/runtime/local-runtime")
      ).localRuntime.refunds(binding, "ORD-1001"),
    ).resolves.toHaveLength(1);
  });

  it("executes a completed follow-up refund as a distinct native approval and delivery", async () => {
    const caseId = `second-approved-refund-${crypto.randomUUID()}`;
    const {
      caseStore,
      mastra,
      native: firstNative,
      recoverApprovedNativeDecisions,
    } = await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: firstNative.turnId,
      commandFingerprint: firstNative.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: firstNative.runId,
      nativeToolCallId: firstNative.toolCallId,
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect((await caseStore.get(caseId))?.status).toBe("resolved");
    const firstTurn = await caseStore.turn(caseId, firstNative.turnId);
    expect(firstTurn).toMatchObject({
      commandFingerprint: firstNative.fingerprint,
      outcome: {
        status: "resolved",
        refundResult: { amount: 20, status: "executed" },
      },
    });

    const followUp = await caseStore.appendFollowUp({
      caseId,
      eventId: `second-approved-event-${crypto.randomUUID()}`,
      runId: `second-approved-run-${crypto.randomUUID()}`,
      message: {
        id: `second-approved-message-${crypto.randomUUID()}`,
        author: "customer",
        body: "Please issue the separately reviewed duplicate-charge refund.",
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp).toMatchObject({
      appended: true,
      turnId: expect.any(String),
    });
    const { recoverLocalWorkflows } =
      await import("../../src/mastra/runtime/local-runtime");
    expect(await recoverLocalWorkflows(mastra, 1, caseStore)).toBe(1);
    const secondSuspended = await caseStore.get(caseId);
    const secondNative = (secondSuspended!.metadata as Record<string, unknown>)
      .nativeApproval as {
      fingerprint: string;
      runId: string;
      toolCallId: string;
      turnId: string;
    };
    expect(secondSuspended?.status).toBe("waiting_approval");
    expect(secondNative).toMatchObject({ turnId: followUp.turnId });
    expect(secondNative.turnId).not.toBe(firstNative.turnId);
    expect(secondNative.runId).not.toBe(firstNative.runId);
    expect(secondNative.fingerprint).not.toBe(firstNative.fingerprint);

    const secondDecision = await caseStore.recordApprovalDecision({
      caseId,
      turnId: secondNative.turnId,
      commandFingerprint: secondNative.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: secondNative.runId,
      nativeToolCallId: secondNative.toolCallId,
    });
    expect(secondDecision.won).toBe(true);
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(await localRefundCount(caseStore)).toBe(2);

    const turns = await caseStore.turns(caseId);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      id: firstNative.turnId,
      commandFingerprint: firstNative.fingerprint,
      outcome: {
        status: "resolved",
        refundResult: { amount: 20, status: "executed" },
      },
    });
    expect(turns[1]).toMatchObject({
      id: secondNative.turnId,
      commandFingerprint: secondNative.fingerprint,
      outcome: {
        status: "resolved",
        refundResult: { amount: 20, status: "executed" },
      },
    });
    const persisted = await caseStore.getClient().execute({
      sql: "SELECT turn_id, command_fingerprint FROM support_decisions WHERE case_id = ? ORDER BY created_at, id",
      args: [caseId],
    });
    expect(persisted.rows).toEqual([
      {
        turn_id: firstNative.turnId,
        command_fingerprint: firstNative.fingerprint,
      },
      {
        turn_id: secondNative.turnId,
        command_fingerprint: secondNative.fingerprint,
      },
    ]);
    const outbox = await caseStore.getClient().execute({
      sql: "SELECT id, status FROM support_outbox WHERE case_id = ? ORDER BY id",
      args: [caseId],
    });
    expect(outbox.rows).toEqual(
      expect.arrayContaining([
        {
          id: `outbox_${caseId}_${firstNative.turnId}_final`,
          status: "resolved",
        },
        {
          id: `outbox_${caseId}_${secondNative.turnId}_final`,
          status: "resolved",
        },
      ]),
    );
    expect(outbox.rows).toHaveLength(2);
  });

  it("reuses a durable effect after a crash before workflow completion", async () => {
    const caseId = `effect-crash-${crypto.randomUUID()}`;
    const expiry = prepareKnowledgeExpiry();
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, undefined, undefined, undefined, {
        knowledgeExpiresAt: expiry.expiresAt,
      });
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    // This is the actual native Agent transition and financial tool execution;
    // intentionally omit workflow.resume to model a process crash in between.
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    // Fault exactly after the provider commits its idempotency/effect row and
    // before issue_refund can atomically project refundResult onto the case.
    const originalProjection =
      caseStore.projectRefundToolExecution.bind(caseStore);
    let projectionFault = true;
    const projection = vi
      .spyOn(caseStore, "projectRefundToolExecution")
      .mockImplementation(async (input) => {
        if (projectionFault && input.caseId === caseId) {
          projectionFault = false;
          throw new Error("injected post-provider projection crash");
        }
        return originalProjection(input);
      });
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    projection.mockRestore();
    await caseStore.completeDispatch(
      dispatch!.id,
      "suspended",
      undefined,
      dispatch!.leaseToken,
    );
    expect(await localRefundCount(caseStore)).toBe(1);

    expect((await caseStore.get(caseId))?.refundResult).toBeUndefined();
    // The provider effect is already durable. A later expiry must not turn
    // recovery into a rejection or permit a duplicate effect.
    vi.setSystemTime(expiry.afterExpiry);

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(1);
    expect((await caseStore.get(caseId))?.refundResult).toMatchObject({
      amount: 20,
      status: "executed",
    });
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { status: "executed", amount: 20 },
    });
  });

  it("fails closed when the verified owner or current order owner changes while native approval is suspended", async () => {
    const caseId = `owner-change-${crypto.randomUUID()}`;
    const { caseStore, mastra, native } = await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    // This models a provider-side ownership correction after the immutable
    // command/snapshot exists. The provider transaction, not model input,
    // makes the final decision.
    await caseStore.getClient().execute({
      sql: "UPDATE local_orders SET customer_email = ? WHERE tenant_id = ? AND order_id = ?",
      args: ["jordan@example.com", "local-demo", "ORD-1001"],
    });
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    expect(await localRefundCount(caseStore)).toBe(0);
    expect((await caseStore.get(caseId))?.refundResult).toBeUndefined();
  });

  it("executes an authenticated first refund with independently configured knowledge and transaction accounts", async () => {
    const caseId = `independent-accounts-approval-${crypto.randomUUID()}`;
    const bindings = independentCaseBindings(caseId);
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { providerBindings: bindings },
    );

    const response = await approveNativeRefund(app, caseId, native.fingerprint);

    expect(response.status).toBe(200);
    expect(await localRefundCount(caseStore)).toBe(1);
    const providerEffect = await caseStore.getClient().execute({
      sql: "SELECT tenant_id, provider_account_id, order_id, amount_minor FROM local_refunds",
    });
    expect(providerEffect.rows).toEqual([
      {
        tenant_id: bindings.transactions.tenantId,
        provider_account_id: bindings.transactions.providerAccountId,
        order_id: "ORD-1001",
        amount_minor: 2000,
      },
    ]);
    expect(
      await caseStore.getAction(
        caseId,
        "refund-policy-evidence",
        native.fingerprint,
      ),
    ).toMatchObject({
      turnId: native.turnId,
      binding: {
        tenantId: bindings.knowledge.tenantId,
        providerKind: bindings.knowledge.providerKind,
        providerAccountId: bindings.knowledge.providerAccountId,
      },
    });
  });

  it("denies an authenticated first refund after knowledge authority expires with independent accounts", async () => {
    const caseId = `independent-accounts-expiry-${crypto.randomUUID()}`;
    const bindings = independentCaseBindings(caseId);
    const expiry = prepareKnowledgeExpiry();
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { providerBindings: bindings, knowledgeExpiresAt: expiry.expiresAt },
    );
    vi.setSystemTime(expiry.afterExpiry);

    const response = await approveNativeRefund(app, caseId, native.fingerprint);

    expect(response.status).toBe(500);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({ status: "escalated" });
    expect(
      await caseStore.getAction(
        caseId,
        "refund-policy-evidence-rejected",
        native.fingerprint,
      ),
    ).toMatchObject({ category: "policy", classification: "requires-review" });
  });

  it("denies recovery after replacing knowledge authority with independent accounts", async () => {
    const caseId = `independent-accounts-replacement-${crypto.randomUUID()}`;
    const bindings = independentCaseBindings(caseId);
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, undefined, undefined, undefined, {
        providerBindings: bindings,
      });
    const { publishKnowledge } =
      await import("../../src/mastra/lib/publish-knowledge");
    const original = await caseStore.getClient().execute({
      sql: "SELECT generation_id FROM support_knowledge_publications WHERE account_key = ?",
      args: [knowledgeAccountKey(bindings.knowledge)],
    });
    const replacement = await publishKnowledge(bindings.knowledge);
    expect(replacement.generationId).not.toBe(original.rows[0]?.generation_id);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({ status: "escalated" });
  });

  it("reconciles an existing native effect after knowledge expiry with independent accounts", async () => {
    const caseId = `independent-accounts-replay-${crypto.randomUUID()}`;
    const bindings = independentCaseBindings(caseId);
    const expiry = prepareKnowledgeExpiry();
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, undefined, undefined, undefined, {
        providerBindings: bindings,
        knowledgeExpiresAt: expiry.expiresAt,
      });
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    const originalUpdate = caseStore.update.bind(caseStore);
    let projectionFault = true;
    const update = vi
      .spyOn(caseStore, "update")
      .mockImplementation(async (id, patch, expectedVersion) => {
        if (projectionFault && patch.refundResult) {
          projectionFault = false;
          throw new Error("injected post-provider projection crash");
        }
        return originalUpdate(id, patch, expectedVersion);
      });
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    update.mockRestore();
    await caseStore.completeDispatch(
      dispatch!.id,
      "suspended",
      undefined,
      dispatch!.leaseToken,
    );
    expect(await localRefundCount(caseStore)).toBe(1);
    const providerEffect = await caseStore.getClient().execute({
      sql: "SELECT provider_account_id FROM local_refunds",
    });
    expect(providerEffect.rows).toEqual([
      { provider_account_id: bindings.transactions.providerAccountId },
    ]);
    vi.setSystemTime(expiry.afterExpiry);

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(await localRefundCount(caseStore)).toBe(1);
    expect((await caseStore.get(caseId))?.refundResult).toMatchObject({
      status: "executed",
      amount: 20,
    });
  });

  it.each([
    ["missing", (evidence: Record<string, unknown>) => delete evidence.binding],
    [
      "foreign",
      (evidence: Record<string, unknown>) => {
        evidence.binding = {
          ...(evidence.binding as Record<string, unknown>),
          providerAccountId: "foreign-knowledge-account",
        };
      },
    ],
    [
      "transaction-tampered",
      (evidence: Record<string, unknown>, bindings: CaseProviderBindings) => {
        evidence.binding = {
          ...(evidence.binding as Record<string, unknown>),
          providerAccountId: bindings.transactions.providerAccountId,
        };
      },
    ],
  ])(
    "denies a %s immutable knowledge binding before an authenticated provider effect",
    async (_kind, mutate) => {
      const caseId = `independent-accounts-binding-${crypto.randomUUID()}`;
      const bindings = independentCaseBindings(caseId);
      const { app, caseStore, native } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        { providerBindings: bindings },
      );
      const evidence = (await caseStore.getAction(
        caseId,
        "refund-policy-evidence",
        native.fingerprint,
      )) as Record<string, unknown>;
      mutate(evidence, bindings);
      await caseStore.getClient().execute({
        sql: "UPDATE support_actions SET data = ? WHERE case_id = ? AND kind = ? AND fingerprint = ?",
        args: [
          JSON.stringify(evidence),
          caseId,
          "refund-policy-evidence",
          native.fingerprint,
        ],
      });

      const response = await approveNativeRefund(
        app,
        caseId,
        native.fingerprint,
      );

      expect(response.status).toBe(500);
      expect(await localRefundCount(caseStore)).toBe(0);
      expect(
        await caseStore.getAction(
          caseId,
          "refund-policy-evidence-rejected",
          native.fingerprint,
        ),
      ).toMatchObject({
        category: "policy",
        classification: "requires-review",
      });
    },
  );

  it("escalates an authenticated approval when its bound policy expires during native suspension", async () => {
    const caseId = `policy-expired-approval-${crypto.randomUUID()}`;
    const expiry = prepareKnowledgeExpiry();
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { knowledgeExpiresAt: expiry.expiresAt },
    );
    vi.setSystemTime(expiry.afterExpiry);

    const response = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandFingerprint: native.fingerprint }),
      },
    );

    expect(response.status).toBe(500);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
    });
    const rejected = await caseStore.getClient().execute({
      sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'refund-policy-evidence-rejected' AND fingerprint = ?",
      args: [caseId, native.fingerprint],
    });
    expect(JSON.parse(String(rejected.rows[0]?.data))).toMatchObject({
      category: "policy",
      classification: "requires-review",
    });
  });

  it("escalates recovery without an effect when publication generation changes after suspension", async () => {
    const caseId = `policy-replaced-recovery-${crypto.randomUUID()}`;
    const {
      binding,
      caseStore,
      mastra,
      native,
      recoverApprovedNativeDecisions,
    } = await setup(caseId);
    const { publishKnowledge } =
      await import("../../src/mastra/lib/publish-knowledge");
    const originalGeneration = (
      await caseStore.getClient().execute({
        sql: "SELECT generation_id FROM support_knowledge_publications WHERE account_key = ?",
        args: [knowledgeAccountKey(binding)],
      })
    ).rows[0]?.generation_id;
    const replacement = await publishKnowledge(binding);
    expect(replacement.generationId).not.toBe(originalGeneration);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
    });
  });

  it("exports the actual request-approval refund quote provider span on its workflow trace", async () => {
    const caseId = `refund-quote-span-${crypto.randomUUID()}`;
    const { caseStore, mastra } = await setup(caseId);
    const supportCase = await caseStore.get(caseId);
    expect(supportCase?.traceId).toEqual(expect.any(String));
    await mastra.observability.flush();
    const observability = await mastra.getStorage()?.getStore("observability");
    const trace = await observability?.getTrace({
      traceId: supportCase!.traceId!,
    });
    const quote = trace?.spans.find(
      (span) => span.name === "transactions.quote_refund",
    );
    expect(quote).toMatchObject({
      metadata: {
        operationalKind: "provider",
        operation: "transactions.quote_refund",
      },
      attributes: { success: true },
    });
  });

  it("records slow and failed actual refund quotes as provider health and alert evidence", async () => {
    const slowCaseId = `slow-refund-quote-${crypto.randomUUID()}`;
    const slow = await setup(slowCaseId, undefined, undefined, undefined, {
      quoteDelayMs: 5_010,
    });
    const { computeMonitoringSummary } =
      await import("../../src/mastra/lib/monitoring");
    await slow.mastra.observability.flush();
    const slowSummary = await computeMonitoringSummary(
      slow.mastra,
      slow.binding.tenantId,
    );
    expect(
      slowSummary.telemetry.providerCalls.find(
        (entry) => entry.operation === "transactions.quote_refund",
      ),
    ).toMatchObject({ calls: 1, errorRate: 0, p95Ms: expect.any(Number) });
    expect(
      slowSummary.telemetry.providerCalls.find(
        (entry) => entry.operation === "transactions.quote_refund",
      )?.p95Ms,
    ).toBeGreaterThan(5_000);
    expect(slowSummary.telemetry.alerts).toContain("p95-latency");

    const failedCaseId = `failed-refund-quote-${crypto.randomUUID()}`;
    const failed = await setup(failedCaseId, undefined, undefined, undefined, {
      quoteFailure: true,
      allowInitialWorkflowFailure: true,
    });
    const { computeMonitoringSummary: computeFailedMonitoringSummary } =
      await import("../../src/mastra/lib/monitoring");
    await failed.mastra.observability.flush();
    const failedSummary = await computeFailedMonitoringSummary(
      failed.mastra,
      failed.binding.tenantId,
    );
    expect(
      failedSummary.telemetry.providerCalls.find(
        (entry) => entry.operation === "transactions.quote_refund",
      ),
    ).toMatchObject({ calls: 1, errorRate: 1 });
    expect(failedSummary.telemetry.alerts).toContain("error-rate");
    expect(await localRefundCount(failed.caseStore)).toBe(0);
  }, 15_000);

  it("rechecks an escalation policy changed after native suspension before any provider effect", async () => {
    const caseId = `policy-change-${crypto.randomUUID()}`;
    const { caseStore, mastra, native } = await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const before = await caseStore.get(caseId);
    await caseStore.update(caseId, {
      draft: {
        ...before!.draft!,
        requiresEscalation: true,
        escalationReason: "Risk policy changed while awaiting approval.",
      },
    });
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      before!.workflowRunId,
      native.turnId,
    );
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("reconciles a committed loopback HTTP refund after its response is dropped", async () => {
    const caseId = `loopback-drop-${crypto.randomUUID()}`;
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: `drop-${caseId}`,
      externalConversationId: `drop-conversation-${caseId}`,
    };
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, binding, (request) =>
        request.url.endsWith("/transactions/issue-refund")
          ? "drop-after-commit"
          : undefined,
      );
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect((await caseStore.get(caseId))?.refundResult).toMatchObject({
      amount: 20,
      status: "executed",
    });
    expect(await localRefundCount(caseStore)).toBe(1);
    const persisted = await caseStore.getClient().execute({
      sql: "SELECT (SELECT COUNT(*) FROM support_decisions WHERE case_id = ?) AS decisions, (SELECT state FROM support_outbox WHERE case_id = ?) AS outbox_state",
      args: [caseId, caseId],
    });
    expect(persisted.rows[0]).toMatchObject({
      decisions: 1,
      outbox_state: "delivered",
    });
    expect((await caseStore.get(caseId))?.status).toBe("resolved");
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(1);
  });

  it("reconciles a drop-after-commit refund on the first registered HTTP approval without repair", async () => {
    const caseId = `http-drop-${crypto.randomUUID()}`;
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: `http-drop-${caseId}`,
      externalConversationId: `http-drop-conversation-${caseId}`,
    };
    const { app, caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, binding, (request) =>
        request.url.endsWith("/transactions/issue-refund")
          ? "drop-after-commit"
          : undefined,
      );

    const response = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandFingerprint: native.fingerprint }),
      },
    );

    expect(response.status).toBe(200);
    expect(await localRefundCount(caseStore)).toBe(1);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { amount: 20, status: "executed" },
    });
    const durable = await caseStore.getClient().execute({
      sql: "SELECT (SELECT COUNT(*) FROM support_decisions WHERE case_id = ?) AS decisions, (SELECT COUNT(*) FROM support_idempotency) AS effects, (SELECT state FROM support_outbox WHERE case_id = ?) AS outbox_state",
      args: [caseId, caseId],
    });
    expect(durable.rows[0]).toMatchObject({
      decisions: 1,
      effects: 1,
      outbox_state: "delivered",
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(1);
  });

  it("reconciles a committed refund when the provider throws after its durable effect", async () => {
    const caseId = `commit-then-throw-${crypto.randomUUID()}`;
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const originalIssueRefund = localRuntime.issueRefund.bind(localRuntime);
    const afterCommit = vi
      .spyOn(localRuntime, "issueRefund")
      .mockImplementation(async (...args) => {
        await originalIssueRefund(...args);
        throw new Error("synthetic response lost after durable commit");
      });
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    afterCommit.mockRestore();
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { amount: 20, status: "executed" },
    });
    // The assertion below uses the exact command key instead of inferring a
    // successful financial outcome from a caught exception.
    const command = (await caseStore.get(caseId))!.metadata.refundCommand as {
      idempotencyKey: string;
    };
    expect(await caseStore.idempotency(command.idempotencyKey)).toMatchObject({
      fingerprint: native.fingerprint,
    });
    expect(
      await caseStore.getAction(caseId, "refund-failure", native.fingerprint),
    ).toBeUndefined();
    await expect(
      caseStore.monitoringOperationalFailures([caseId]),
    ).resolves.toMatchObject({ financial: 0 });
  });

  it("durably escalates the registered HTTP approval when native execution has no effect", async () => {
    const caseId = `http-native-no-effect-${crypto.randomUUID()}`;
    const { app, caseStore, native } = await setup(caseId);
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const providerFailure = vi
      .spyOn(localRuntime, "issueRefund")
      .mockRejectedValue(new Error("injected permanent provider rejection"));
    const response = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandFingerprint: native.fingerprint }),
      },
    );
    providerFailure.mockRestore();
    expect(response.status).toBe(500);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      escalationReason:
        "Native approval completed without a durable refund effect.",
    });
    expect(await caseStore.turns(caseId)).toContainEqual(
      expect.objectContaining({
        state: "escalated",
        outcome: expect.objectContaining({
          operationalFailure: expect.objectContaining({
            disposition: "escalate",
          }),
        }),
      }),
    );
    await expect(
      caseStore.getAction(caseId, "refund-failure", native.fingerprint),
    ).resolves.toMatchObject({ classification: "confirmed-failed" });
  });

  it("records a no-effect transport exception as uncertain rather than a permanent financial failure", async () => {
    const caseId = `native-uncertain-effect-${crypto.randomUUID()}`;
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const transportFailure = vi
      .spyOn(localRuntime, "issueRefund")
      .mockRejectedValue(new Error("synthetic transport timeout"));
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    await recoverApprovedNativeDecisions(mastra, caseStore, {
      disableScorers: true,
    });
    transportFailure.mockRestore();
    await expect(
      caseStore.getAction(caseId, "refund-uncertain", native.fingerprint),
    ).resolves.toMatchObject({ classification: "uncertain" });
    await expect(
      caseStore.getAction(caseId, "refund-failure", native.fingerprint),
    ).resolves.toBeUndefined();
    await expect(
      caseStore.customerFinancialRequests([caseId]),
    ).resolves.toMatchObject([{ type: "refund", status: "unknown" }]);
    await expect(
      caseStore.monitoringOperationalFailures([caseId]),
    ).resolves.toMatchObject({ financial: 0, workflow: 1 });
    expect(await caseStore.get(caseId)).toMatchObject({ status: "escalated" });
  });

  it("makes a completed native tool failure explicit instead of resuming it forever", async () => {
    const caseId = `native-no-effect-${crypto.randomUUID()}`;
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const providerFailure = vi
      .spyOn(localRuntime, "issueRefund")
      .mockRejectedValue(new Error("injected permanent provider rejection"));

    // Mastra completes the native approval transition and returns the tool
    // error to the Agent. No effect row exists, so recovery must make the
    // failure durable rather than attempting the consumed snapshot again.
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    providerFailure.mockRestore();
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      escalationReason:
        "Native approval completed without a durable refund effect.",
    });
    const durable = await caseStore.getClient().execute({
      sql: "SELECT (SELECT COUNT(*) FROM support_decisions WHERE case_id = ?) AS decisions, (SELECT COUNT(*) FROM support_idempotency) AS effects, (SELECT state FROM support_dispatch WHERE case_id = ?) AS dispatch_state, (SELECT state FROM support_turns WHERE case_id = ?) AS turn_state",
      args: [caseId, caseId, caseId],
    });
    expect(durable.rows[0]).toMatchObject({
      decisions: 1,
      effects: 0,
      dispatch_state: "failed",
      turn_state: "escalated",
    });
    await expect(
      caseStore.getAction(caseId, "refund-failure", native.fingerprint),
    ).resolves.toMatchObject({ classification: "confirmed-failed" });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
  });

  it("rejects a lease reclaimed between the tool precheck and effect transaction", async () => {
    const caseId = `lease-race-${crypto.randomUUID()}`;
    const { caseStore, mastra, native } = await setup(caseId);
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const originalIssue = localRuntime.issueRefund.bind(localRuntime);
    let expired = false;
    const issue = vi
      .spyOn(localRuntime, "issueRefund")
      .mockImplementation(async (command, authorization) => {
        if (!expired) {
          expired = true;
          await caseStore.getClient().execute({
            sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ?",
            args: ["2000-01-01T00:00:00.000Z", dispatch!.id],
          });
        }
        return originalIssue(command, authorization);
      });
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    issue.mockRestore();
    expect(expired).toBe(true);
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("recovers a durable rejection without creating a financial effect", async () => {
    const caseId = `decline-crash-${crypto.randomUUID()}`;
    const {
      binding,
      caseStore,
      mastra,
      native,
      recoverApprovedNativeDecisions,
    } = await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: false,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(
      await (
        await import("../../src/mastra/runtime/local-runtime")
      ).localRuntime.refunds(binding, "ORD-1001"),
    ).toEqual([]);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      approval: { approved: false, approverId: "approver-demo" },
    });
  });

  it("refuses a cross-tenant command or a non-approver at the financial boundary", async () => {
    const caseId = `effect-denial-${crypto.randomUUID()}`;
    const { caseStore, native } = await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as {
      approvalCaseId: string;
      binding: {
        tenantId: string;
        providerKind: "local";
        providerAccountId: string;
        externalConversationId: string;
      };
      orderId: string;
      amount: { currency: string; minor: number };
      reason: string;
      idempotencyKey: string;
      fingerprint: string;
    };
    const { refundFingerprint } = await import("../../src/mastra/lib/money");
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    await expect(
      localRuntime.issueRefund({ ...command, fingerprint: "tampered" }),
    ).rejects.toThrow("fingerprint was tampered with");
    const crossTenant = {
      ...command,
      binding: { ...command.binding, tenantId: "other-tenant" },
    };
    crossTenant.fingerprint = refundFingerprint(crossTenant);
    await expect(localRuntime.issueRefund(crossTenant)).rejects.toThrow(
      "approved native refund tool context",
    );

    const persisted = await caseStore.get(caseId);
    await caseStore.update(caseId, {
      metadata: {
        ...persisted!.metadata,
        nativeApproval: {
          ...((persisted!.metadata as Record<string, unknown>)
            .nativeApproval as Record<string, unknown>),
          toolCallId: "stale-tool-call",
        },
      },
    });
    await expect(localRuntime.issueRefund(command)).rejects.toThrow(
      "approved native refund tool context",
    );

    await caseStore.getClient().execute({
      sql: "UPDATE support_decisions SET principal_id = ? WHERE case_id = ? AND turn_id = ?",
      args: ["support-agent-demo", caseId, native.turnId],
    });
    await expect(localRuntime.issueRefund(command)).rejects.toThrow(
      "approved native refund tool context",
    );
    expect(await localRefundCount(caseStore)).toBe(0);
  });

  it("does not treat durable approval metadata as direct tool or HTTP authority", async () => {
    const caseId = `native-context-${crypto.randomUUID()}`;
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: `loopback-${caseId}`,
      externalConversationId: `conversation-${caseId}`,
    };
    const { caseStore, mastra, native } = await setup(caseId, binding);
    const { createLocalLoopbackFacade, LoopbackHttpProviderRegistry } =
      await import("../../src/mastra/providers/advanced/loopback-http");
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const { issueRefundTool } =
      await import("../../src/mastra/tools/issue-refund");
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as {
      orderId: string;
      amount: { currency: string; minor: number };
      reason: string;
      idempotencyKey: string;
      fingerprint: string;
      binding: typeof binding;
      approvalCaseId: string;
    };
    const input = {
      caseId,
      orderId: command.orderId,
      amount: command.amount.minor / 100,
      currency: command.amount.currency,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    };
    await expect(issueRefundTool.execute!(input, {} as never)).rejects.toThrow(
      "current durable workflow dispatch lease",
    );
    // A correctly shaped Agent context and a valid durable decision still do
    // not create financial authority before Mastra's official native resume.
    const directDispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    await expect(
      withDispatchLeaseScope(
        {
          dispatchId: directDispatch!.id,
          caseId,
          turnId: native.turnId,
          leaseToken: directDispatch!.leaseToken!,
        },
        () =>
          issueRefundTool.execute!(input, {
            agent: {
              agentId: "refund-execution-agent",
              toolCallId: native.toolCallId,
            },
          } as never),
      ),
    ).rejects.toThrow("approved native refund agent tool context");
    await caseStore.completeDispatch(
      directDispatch!.id,
      "suspended",
      undefined,
      directDispatch!.leaseToken,
    );
    const loopback = new LoopbackHttpProviderRegistry(
      createLocalLoopbackFacade(localRuntime),
    );
    await expect(
      loopback.transactions(binding).issueRefund(command),
    ).rejects.toThrow("missing or invalid native refund authorization");
    expect(await localRefundCount(caseStore)).toBe(0);

    // The same configured HTTP adapter accepts only the authorization created
    // by Mastra while it executes the approved native tool call.
    const dispatch = await caseStore.claimDispatchForResume(
      caseId,
      (await caseStore.get(caseId))!.workflowRunId,
      native.turnId,
    );
    const { resumeApprovedNativeTool } =
      await import("../../src/mastra/providers/native-execution");
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: native.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId,
            turnId: native.turnId,
            nativeRunId: native.runId,
            nativeToolCallId: native.toolCallId,
            commandFingerprint: native.fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
        }),
    );
    expect(await localRefundCount(caseStore)).toBe(1);
  });

  it("does not reconcile an effect with the wrong immutable fingerprint", async () => {
    const caseId = `effect-mismatch-${crypto.randomUUID()}`;
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId);
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { idempotencyKey: string };
    await caseStore.recordEffect(command.idempotencyKey, "wrong-fingerprint", {
      refundId: "wrong-effect",
    });

    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    expect(await localRefundCount(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({ status: "escalated" });
  });

  it("uses the registered native approval path for a Stripe pending refund, then finalizes exactly once after polling succeeds", async () => {
    const caseId = `stripe-native-pending-${crypto.randomUUID()}`;
    process.env.COMMERCE_SOURCE = "stripe";
    process.env.STRIPE_SANDBOX_ENABLED = "true";
    process.env.STRIPE_TENANT_ID = "local-demo";
    process.env.STRIPE_ACCOUNT_ID = "acct_test_123";
    process.env.STRIPE_RESTRICTED_API_KEY = "rk_test_synthetic";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
    process.env.STRIPE_API_BASE_URL = "http://stripe.test";
    let remoteStatus = "pending";
    let transientRetrieveFailure = false;
    let posts = 0;
    let approvedFingerprint = "";
    // This downstream lifecycle fixture intentionally includes the adapter's
    // current account check field.  The separate client contract uses the
    // real Account API shape and protects against treating it as normative.
    vi.stubGlobal("fetch", async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: "acct_test_123", livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "ORD-1001",
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
          amount_received: 102000,
          status: "succeeded",
        });
      if (path === "/v1/checkout/sessions/ORD-1001/line_items")
        return Response.json({
          data: [
            { description: "Synthetic purchase", price: { product: "prod_1" } },
          ],
          has_more: false,
        });
      if (path === "/v1/subscriptions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "GET")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "POST") {
        posts += 1;
        return Response.json({
          id: "re_pending",
          livemode: false,
          currency: "usd",
          amount: 2000,
          created: 2,
          status: remoteStatus,
          metadata: {
            support_case_id: caseId,
            command_fingerprint: approvedFingerprint,
          },
        });
      }
      if (path === "/v1/refunds/re_pending") {
        if (transientRetrieveFailure)
          return new Response("temporary", { status: 503 });
        return Response.json({
          id: "re_pending",
          livemode: false,
          currency: "usd",
          amount: 2000,
          created: 2,
          status: remoteStatus,
          metadata: {
            support_case_id: caseId,
            command_fingerprint: approvedFingerprint,
          },
        });
      }
      throw new Error(`Unexpected Stripe request ${request.method} ${path}`);
    });
    const local = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: `conversation-${caseId}`,
    };
    const stripe = {
      tenantId: "local-demo",
      providerKind: "stripe" as const,
      providerAccountId: "acct_test_123",
      externalConversationId: `conversation-${caseId}`,
    };
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        providerBindings: {
          support: local,
          commerce: stripe,
          transactions: stripe,
          knowledge: local,
        },
      },
    );
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { fingerprint: string; idempotencyKey: string };
    approvedFingerprint = command.fingerprint;
    const approval = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandFingerprint: native.fingerprint }),
      },
    );
    expect(approval.status).toBe(200);
    expect(posts).toBe(1);
    expect(await caseStore.get(caseId)).toMatchObject({
      refundResult: { status: "pending" },
    });
    await expect(
      caseStore.customerFinancialRequests([caseId]),
    ).resolves.toMatchObject([{ type: "refund", status: "processing" }]);
    await expect(
      caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      }),
    ).resolves.toMatchObject({ rows: [{ total: 0 }] });
    remoteStatus = "succeeded";
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    const pendingAttempt = await caseStore.stripeRefundAttempt(
      command.idempotencyKey,
    );
    await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
      status: "pending",
      nextAttemptAt: new Date(0).toISOString(),
    });
    // Claim the exact persisted pending receipt in this manual sweep. The
    // explicit due-time avoids accepting timing from any runtime worker.
    expect(pendingAttempt).toMatchObject({ status: "pending" });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      refundResult: { status: "executed" },
    });
    const outbox = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    expect(Number((outbox.rows[0] as { total: number }).total)).toBe(1);
    // A terminal success stays terminal when its scheduled audit has a
    // transient retrieval failure. Only a later authoritative provider read
    // may change it to failed.
    transientRetrieveFailure = true;
    const succeededAttempt = await caseStore.stripeRefundAttempt(
      (await caseStore.get(caseId))!.refundResult!.idempotencyKey,
    );
    await caseStore.updateStripeRefundAttempt(
      succeededAttempt!.idempotencyKey,
      {
        status: "succeeded",
        nextAttemptAt: new Date(0).toISOString(),
      },
    );
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
    expect(
      await caseStore.stripeRefundAttempt(succeededAttempt!.idempotencyKey),
    ).toMatchObject({ status: "succeeded" });
    transientRetrieveFailure = false;
    // Stripe documents that a later authoritative failure may follow success.
    // Re-open only the poll schedule; the immutable command/effect key stays.
    remoteStatus = "failed";
    const attempt = await caseStore.stripeRefundAttempt(
      (await caseStore.get(caseId))!.refundResult!.idempotencyKey,
    );
    await caseStore.updateStripeRefundAttempt(attempt!.idempotencyKey, {
      status: "succeeded",
      nextAttemptAt: new Date(0).toISOString(),
    });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      refundResult: { status: "failed" },
    });
    const failures = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_actions WHERE case_id = ? AND kind = 'refund-failure'",
      args: [caseId],
    });
    expect(Number((failures.rows[0] as { total: number }).total)).toBe(1);
    // An earlier transport marker remains audit history, but the exact Stripe
    // attempt has since established a provider failure and must win the
    // customer-facing projection.
    await caseStore.saveAction(
      caseId,
      "refund-uncertain",
      command.fingerprint,
      { classification: "uncertain" },
    );
    await expect(
      caseStore.customerFinancialRequests([caseId]),
    ).resolves.toMatchObject([{ type: "refund", status: "failed" }]);
  });

  it.each([
    "Cancel? I do not want a refund, but I do not think you should cancel my subscription.",
    "Could you terminate my subscription? No refund please.",
    'The customer reported: "Please cancel my subscription. I do not want a refund."',
    "If you can cancel my subscription, I do not want a refund.",
  ])(
    "escalates non-authoritative cancellation wording without a native Stripe cancellation POST: %s",
    async (message) => {
      const caseId = `stripe-cancel-denied-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      const observed = {
        posts: 0,
        refundPosts: 0,
        gets: [] as string[],
        keys: [] as string[],
        scheduled: false,
        loseFirstPost: false,
      };
      vi.stubGlobal("fetch", cancellationStripeTransport(observed));
      const { caseStore } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          providerBindings: syntheticStripeBindings(caseId),
          triage: {
            intent: "cancellation",
            urgency: "normal",
            sentiment: "neutral",
            requiresHumanReview: false,
            confidence: 1,
            rationale: "customer mentioned cancellation",
          },
          message,
          responseModel: jsonModel({
            draftResponse: "draft",
            citedSources: ["subscription-cancellation-policy"],
            recommendRefund: false,
            requiresEscalation: false,
          }) as never,
          allowInitialWorkflowFailure: true,
        },
      );
      expect(observed).toMatchObject({ posts: 0, refundPosts: 0 });
      expect(await caseStore.get(caseId)).toMatchObject({
        status: "escalated",
      });
      const commands = await caseStore.getClient().execute({
        sql: "SELECT kind FROM support_actions WHERE case_id = ? AND kind IN ('subscription-cancellation-command', 'refund-command')",
        args: [caseId],
      });
      expect(commands.rows).toEqual([]);
    },
  );

  it("suppresses a refund recommendation before the explicit no-refund cancellation takes effect", async () => {
    const caseId = `stripe-cancel-conflicting-draft-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      refundPosts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: false,
    };
    vi.stubGlobal("fetch", cancellationStripeTransport(observed));
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      providerBindings: syntheticStripeBindings(caseId),
      triage: {
        intent: "cancellation",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "explicit no-refund cancellation",
      },
      message:
        "Please cancel my subscription at the end of the period. I do not want a refund.",
      responseModel: jsonModel({
        draftResponse: "draft",
        citedSources: ["subscription-cancellation-policy"],
        selectedPolicyExcerpts: [
          {
            source: "subscription-cancellation-policy",
            excerpt:
              "If a customer explicitly says they do not want a refund and only want to cancel, do not offer or recommend one - honor the customer's stated intent.",
          },
        ],
        recommendRefund: true,
        refundAmount: 20,
        refundCurrency: "USD",
        refundReason: "model conflict",
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });
    expect(observed).toMatchObject({ posts: 1, refundPosts: 0 });
    const stored = await caseStore.get(caseId);
    expect(stored).toMatchObject({
      status: "resolved",
      draft: { recommendRefund: false },
      metadata: {
        cancellationEffect: { cancelAtPeriodEnd: true },
      },
    });
    expect(
      (stored!.metadata as Record<string, unknown>).nativeApproval,
    ).toBeUndefined();
    const refundCommands = await caseStore.getClient().execute({
      sql: "SELECT kind FROM support_actions WHERE case_id = ? AND kind = 'refund-command'",
      args: [caseId],
    });
    expect(refundCommands.rows).toEqual([]);
  });

  it.each([
    {
      name: "mandatory triage review",
      triage: {
        requiresHumanReview: true,
        confidence: 1,
        rationale: "Cancellation needs a specialist.",
      },
    },
    {
      name: "low triage confidence without an explicit review flag",
      triage: {
        requiresHumanReview: false,
        confidence: 0.49,
        rationale: "Cancellation classification is uncertain.",
      },
    },
  ])(
    "does not execute an explicit no-refund cancellation with $name",
    async ({ triage }) => {
      const caseId = `stripe-cancel-review-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      const observed = {
        posts: 0,
        refundPosts: 0,
        gets: [] as string[],
        keys: [] as string[],
        scheduled: false,
        loseFirstPost: false,
      };
      vi.stubGlobal("fetch", cancellationStripeTransport(observed));
      const { caseStore } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          providerBindings: syntheticStripeBindings(caseId),
          triage: {
            intent: "cancellation",
            urgency: "normal",
            sentiment: "neutral",
            ...triage,
          },
          message:
            "Please cancel my subscription at the end of the period. I do not want a refund.",
          responseModel: jsonModel({
            draftResponse: "The cancellation is ready to schedule.",
            citedSources: ["subscription-cancellation-policy"],
            selectedPolicyExcerpts: [
              {
                source: "subscription-cancellation-policy",
                excerpt:
                  "Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period.",
              },
            ],
            recommendRefund: false,
            requiresEscalation: false,
          }) as never,
          allowInitialWorkflowFailure: true,
        },
      );

      expect(observed).toMatchObject({ posts: 0, refundPosts: 0 });
      expect(await caseStore.get(caseId)).toMatchObject({
        status: "escalated",
      });
      const commands = await caseStore.getClient().execute({
        sql: "SELECT kind FROM support_actions WHERE case_id = ? AND kind = 'subscription-cancellation-command'",
        args: [caseId],
      });
      expect(commands.rows).toEqual([]);
    },
  );

  it("does not execute an explicit no-refund cancellation when the writer escalates it", async () => {
    const caseId = `stripe-cancel-writer-escalation-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      refundPosts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: false,
    };
    vi.stubGlobal("fetch", cancellationStripeTransport(observed));
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      providerBindings: syntheticStripeBindings(caseId),
      triage: {
        intent: "cancellation",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "Verified cancellation intent.",
      },
      message:
        "Please cancel my subscription at the end of the period. I do not want a refund.",
      responseModel: jsonModel({
        draftResponse: "A specialist needs to check this cancellation.",
        citedSources: ["subscription-cancellation-policy"],
        recommendRefund: false,
        requiresEscalation: true,
        escalationReason: "The writer needs a specialist to verify the plan.",
      }) as never,
      allowInitialWorkflowFailure: true,
    });

    expect(observed).toMatchObject({ posts: 0, refundPosts: 0 });
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "escalated",
      escalationReason: "The writer needs a specialist to verify the plan.",
    });
  });

  it("schedules Jordan's structured staging cancellation without a refund", async () => {
    const caseId = `staging-jordan-cancel-${crypto.randomUUID()}`;
    enableSyntheticIntercom();
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      refundPosts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: false,
    };
    vi.stubGlobal("fetch", cancellationStripeTransport(observed));
    const message =
      "Hey, please cancel my subscription when it renews. I don’t want a refund; please keep access until then.";
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      appMode: "staging",
      supportSource: "intercom",
      source: "intercom-conversation",
      providerBindings: syntheticIntercomStripeBindings(caseId),
      message,
      triage: {
        intent: "cancellation",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale:
          "Customer requested cancellation at renewal without a refund.",
        cancellationInterpretation: {
          directCancellationRequested: true,
          atPeriodEnd: true,
          explicitNoRefund: true,
          hasNegationQuoteConflictOrAmbiguity: false,
          evidenceVerbatim: [
            "cancel my subscription when it renews",
            "don’t want a refund",
          ],
          confidence: 0.95,
        },
      },
      responseModel: jsonModel({
        draftResponse: "draft",
        citedSources: ["subscription-cancellation-policy"],
        selectedPolicyExcerpts: [
          {
            source: "subscription-cancellation-policy",
            excerpt:
              "Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period.",
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });
    expect(observed).toMatchObject({ posts: 1, refundPosts: 0 });
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      metadata: { cancellationEffect: { cancelAtPeriodEnd: true } },
    });
    expect(
      (
        await caseStore.getClient().execute({
          sql: "SELECT COUNT(*) AS total FROM support_actions WHERE case_id = ? AND kind = 'subscription-cancellation-command'",
          args: [caseId],
        })
      ).rows[0]?.total,
    ).toBe(1);
  });

  it("schedules one explicit no-refund Stripe cancellation through the registered workflow and replays its durable command", async () => {
    const caseId = `stripe-cancel-${crypto.randomUUID()}`;
    Object.assign(process.env, {
      COMMERCE_SOURCE: "stripe",
      STRIPE_SANDBOX_ENABLED: "true",
      STRIPE_TENANT_ID: "local-demo",
      STRIPE_ACCOUNT_ID: "acct_test_123",
      STRIPE_RESTRICTED_API_KEY: "rk_test_synthetic",
      STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
      STRIPE_API_BASE_URL: "http://stripe.test",
    });
    let cancellationPosts = 0;
    let refundPosts = 0;
    vi.stubGlobal("fetch", async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ id: "acct_test_123" });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "cs_purchase",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_purchase",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/customers/cus_1")
        return Response.json({
          id: "cus_1",
          email: "alex@example.com",
          livemode: false,
        });
      if (path === "/v1/checkout/sessions/cs_purchase/line_items")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/payment_intents/pi_purchase")
        return Response.json({
          id: "pi_purchase",
          livemode: false,
          currency: "usd",
          amount: 4900,
          status: "succeeded",
        });
      if (path === "/v1/subscriptions")
        return Response.json({
          data: [
            {
              id: "sub_cancel",
              customer: "cus_1",
              latest_invoice: "in_1",
              livemode: false,
              status: "active",
              items: {
                data: [
                  {
                    current_period_end: 200,
                    price: {
                      currency: "usd",
                      unit_amount: 4900,
                      nickname: "Pro",
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
          created: 1,
        });
      if (path === "/v1/invoice_payments")
        return Response.json({
          data: [
            {
              id: "ip_1",
              invoice: "in_1",
              payment_intent: "pi_sub",
              livemode: false,
              status: "paid",
            },
          ],
          has_more: false,
        });
      if (path === "/v1/payment_intents/pi_sub")
        return Response.json({
          id: "pi_sub",
          livemode: false,
          currency: "usd",
          amount: 4900,
          status: "succeeded",
        });
      if (path === "/v1/refunds" && request.method === "GET")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "POST") {
        refundPosts += 1;
        throw new Error("refund must not execute");
      }
      if (path === "/v1/subscriptions/sub_cancel" && request.method === "GET")
        return Response.json({
          id: "sub_cancel",
          customer: "cus_1",
          livemode: false,
          status: "active",
        });
      if (
        path === "/v1/subscriptions/sub_cancel" &&
        request.method === "POST"
      ) {
        cancellationPosts += 1;
        expect(await request.text()).toBe("cancel_at_period_end=true");
        return Response.json({
          id: "sub_cancel",
          customer: "cus_1",
          livemode: false,
          status: "active",
          cancel_at_period_end: true,
          items: { data: [{ current_period_end: 200 }] },
        });
      }
      throw new Error(`Unexpected ${request.method} ${path}`);
    });
    const local = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: `conversation-${caseId}`,
    };
    const stripe = {
      tenantId: "local-demo",
      providerKind: "stripe" as const,
      providerAccountId: "acct_test_123",
      externalConversationId: `conversation-${caseId}`,
    };
    const { caseStore, mastra } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        providerBindings: {
          support: local,
          commerce: stripe,
          transactions: stripe,
          knowledge: local,
        },
        triage: {
          intent: "cancellation",
          urgency: "normal",
          sentiment: "neutral",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "explicit no-refund cancellation",
        },
        message:
          "Please cancel my subscription at the end of the period. I do not want a refund.",
        allowInitialWorkflowFailure: true,
        responseModel: jsonModel({
          draftResponse: "draft",
          citedSources: ["subscription-cancellation-policy"],
          selectedPolicyExcerpts: [
            {
              source: "subscription-cancellation-policy",
              excerpt:
                "Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period unless the customer explicitly asks for an immediate cancellation with a prorated refund.",
            },
          ],
          recommendRefund: false,
          requiresEscalation: false,
        }) as never,
      },
    );
    const cancellationFailure = await caseStore.getClient().execute({
      sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'subscription-cancellation-failure'",
      args: [caseId],
    });
    expect(String(cancellationFailure.rows[0]?.data ?? "")).toBe("");
    expect(cancellationPosts).toBe(1);
    expect(refundPosts).toBe(0);
    expect(await caseStore.get(caseId)).toMatchObject({
      status: "resolved",
      metadata: {
        cancellationEffect: {
          cancelAtPeriodEnd: true,
          cancelsAt: "1970-01-01T00:03:20.000Z",
        },
      },
    });
    const outbox = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    expect(Number((outbox.rows[0] as { total: number }).total)).toBe(1);
    const command = await caseStore.getClient().execute({
      sql: "SELECT idempotency_key FROM support_subscription_cancellation_attempts WHERE case_id = ?",
      args: [caseId],
    });
    expect(command.rows).toHaveLength(1);
    const stored = await caseStore.get(caseId);
    expect(stored?.metadata.cancellationEffect).toMatchObject({
      cancelAtPeriodEnd: true,
    });
    // Restart/replay sees the terminal durable attempt and cannot POST again.
    const tool = mastra.getTool("scheduleSubscriptionCancellationTool");
    expect(tool).toBeDefined();
    expect(cancellationPosts).toBe(1);
  });

  it.each(["preflight", "post-4xx"] as const)(
    "terminalizes a deterministic Stripe cancellation %s without recovery work",
    async (failure) => {
      const caseId = `stripe-cancel-no-effect-${failure}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      const observed = {
        posts: 0,
        gets: [] as string[],
        keys: [] as string[],
        scheduled: false,
        loseFirstPost: false,
        ...(failure === "preflight"
          ? { preflightFailure: true }
          : { post4xx: true }),
      };
      vi.stubGlobal("fetch", cancellationStripeTransport(observed));
      const { caseStore } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          providerBindings: syntheticStripeBindings(caseId),
          triage: {
            intent: "cancellation",
            urgency: "normal",
            sentiment: "neutral",
            requiresHumanReview: false,
            confidence: 1,
            rationale: "explicit no-refund cancellation",
          },
          message:
            "Please cancel my subscription at the end of the period. I do not want a refund.",
          responseModel: jsonModel({
            draftResponse: "draft",
            citedSources: ["subscription-cancellation-policy"],
            recommendRefund: false,
            requiresEscalation: false,
          }) as never,
          allowInitialWorkflowFailure: true,
        },
      );
      const attempt = await caseStore.getClient().execute({
        sql: "SELECT idempotency_key, fingerprint, status FROM support_subscription_cancellation_attempts WHERE case_id = ?",
        args: [caseId],
      });
      const beforeRecovery = {
        posts: observed.posts,
        gets: [...observed.gets],
      };
      const { reconcileUnknownSubscriptionCancellations } =
        await import("../../src/mastra/providers/stripe/cancellation-reconciliation");
      expect(await reconcileUnknownSubscriptionCancellations(caseStore)).toBe(
        0,
      );
      expect({
        beforeRecovery,
        afterRecovery: { posts: observed.posts, gets: observed.gets },
        attempt: attempt.rows[0],
        case: await caseStore.get(caseId),
        audit: await caseStore.getAction(
          caseId,
          "subscription-cancellation-failure",
          String((attempt.rows[0] as { fingerprint: string }).fingerprint),
        ),
      }).toMatchObject({
        beforeRecovery: {
          posts: failure === "post-4xx" ? 1 : 0,
        },
        afterRecovery: beforeRecovery,
        attempt: { status: "failed" },
        case: { status: "escalated" },
        audit: { classification: "confirmed-no-effect" },
      });
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      expect(Number((outbox.rows[0] as { total: number }).total)).toBe(1);
    },
  );

  it.each(["missing-schedule", "malformed-items"] as const)(
    "recovers a committed native Stripe cancellation after an invalid 2xx %s response",
    async (invalidPostResponse) => {
      const caseId = `stripe-cancel-invalid-2xx-${invalidPostResponse}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      const observed = {
        posts: 0,
        refundPosts: 0,
        gets: [] as string[],
        keys: [] as string[],
        scheduled: false,
        loseFirstPost: false,
        invalidPostResponse,
      };
      vi.stubGlobal("fetch", cancellationStripeTransport(observed));
      const { caseStore } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          providerBindings: syntheticStripeBindings(caseId),
          triage: {
            intent: "cancellation",
            urgency: "normal",
            sentiment: "neutral",
            requiresHumanReview: false,
            confidence: 1,
            rationale: "explicit no-refund cancellation",
          },
          message:
            "Please cancel my subscription at the end of the period. I do not want a refund.",
          responseModel: jsonModel({
            draftResponse: "draft",
            citedSources: ["subscription-cancellation-policy"],
            recommendRefund: false,
            requiresEscalation: false,
          }) as never,
          allowInitialWorkflowFailure: true,
        },
      );
      const attempt = await caseStore.getClient().execute({
        sql: "SELECT idempotency_key, fingerprint, status FROM support_subscription_cancellation_attempts WHERE case_id = ?",
        args: [caseId],
      });
      const firstAttempt = attempt.rows[0] as {
        fingerprint: string;
        status: string;
      };
      const initialAudit = (await caseStore.getAction(
        caseId,
        "subscription-cancellation-failure",
        firstAttempt.fingerprint,
      )) as { classification?: string } | undefined;
      expect({
        posts: observed.posts,
        refundPosts: observed.refundPosts,
        remotelyScheduled: observed.scheduled,
        attempt: firstAttempt,
      }).toMatchObject({
        posts: 1,
        refundPosts: 0,
        remotelyScheduled: true,
        attempt: { status: "unknown" },
      });
      expect(initialAudit?.classification).not.toBe("confirmed-no-effect");
      const initialOutbox = await caseStore.getClient().execute({
        sql: "SELECT status, body FROM support_outbox WHERE case_id = ? ORDER BY created_at, id",
        args: [caseId],
      });
      const initialOutboxCount = initialOutbox.rows.length;
      expect(initialOutbox.rows).toMatchObject([{ status: "escalated" }]);
      expect(String((initialOutbox.rows[0] as { body: string }).body)).toMatch(
        /additional review|support specialist/i,
      );
      const { reconcileUnknownSubscriptionCancellations } =
        await import("../../src/mastra/providers/stripe/cancellation-reconciliation");
      expect(await reconcileUnknownSubscriptionCancellations(caseStore)).toBe(
        1,
      );
      expect(await reconcileUnknownSubscriptionCancellations(caseStore)).toBe(
        0,
      );
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT status FROM support_outbox WHERE case_id = ? ORDER BY created_at, id",
        args: [caseId],
      });
      const finalAudit = (await caseStore.getAction(
        caseId,
        "subscription-cancellation-failure",
        firstAttempt.fingerprint,
      )) as { classification?: string } | undefined;
      expect({
        posts: observed.posts,
        refundPosts: observed.refundPosts,
        subscriptionGets: observed.gets.filter(
          (path) => path === "/v1/subscriptions/sub_cancel",
        ).length,
        attempt: (
          await caseStore.getClient().execute({
            sql: "SELECT status FROM support_subscription_cancellation_attempts WHERE case_id = ?",
            args: [caseId],
          })
        ).rows[0],
        case: await caseStore.get(caseId),
        recoveryOutbox: outbox.rows.slice(initialOutboxCount),
      }).toMatchObject({
        posts: 1,
        refundPosts: 0,
        subscriptionGets: 2,
        attempt: { status: "scheduled" },
        case: {
          status: "resolved",
          metadata: { cancellationEffect: { cancelAtPeriodEnd: true } },
        },
        recoveryOutbox: [{ status: "resolved" }],
      });
      expect(finalAudit?.classification).not.toBe("confirmed-no-effect");
    },
  );

  it("uses one validated paid InvoicePayment snapshot when the association changes before native refund execution", async () => {
    for (const amount of [20, 1000]) {
      const caseId = `stripe-renewal-${amount}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      const posts: Array<{ target: string | null; key: string | null }> = [];
      const refundHistoryTargets: string[] = [];
      let invoicePaymentReads = 0;
      let fingerprint = "";
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [
              { id: "cus_renewal", email: "alex@example.com", livemode: false },
            ],
            has_more: false,
          });
        if (path === "/v1/customers/cus_renewal")
          return Response.json({
            id: "cus_renewal",
            email: "alex@example.com",
            livemode: false,
          });
        // A renewal has no Checkout to fall back to. The only executable
        // target is its paid InvoicePayment's PaymentIntent.
        if (path === "/v1/checkout/sessions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/invoices")
          return Response.json({
            data: [
              {
                id: "in_renewal",
                customer: "cus_renewal",
                livemode: false,
                status: "paid",
                paid: true,
                billing_reason: "subscription_cycle",
                subscription: "sub_renewal",
                parent: {
                  subscription_details: { subscription: "sub_renewal" },
                },
              },
            ],
            has_more: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({
            data: [
              {
                id: "sub_renewal",
                customer: "cus_renewal",
                latest_invoice: "in_renewal",
                status: "active",
                livemode: false,
                items: {
                  data: [
                    {
                      current_period_end: 2,
                      price: {
                        id: "price_renewal",
                        nickname: "Renewal",
                        currency: "usd",
                        unit_amount: 100000,
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
        if (path === "/v1/invoices/in_renewal")
          return Response.json({
            id: "in_renewal",
            customer: "cus_renewal",
            status: "paid",
            paid: true,
            created: 1,
            livemode: false,
            description: "Synthetic renewal",
          });
        if (path === "/v1/invoice_payments") {
          invoicePaymentReads += 1;
          const target = `pi_renewal_snapshot_${invoicePaymentReads}`;
          return Response.json({
            data: [
              {
                id: "ip_renewal",
                invoice: "in_renewal",
                status: "paid",
                paid: true,
                payment: {
                  type: "payment_intent",
                  payment_intent: target,
                },
                livemode: false,
              },
            ],
            has_more: false,
          });
        }
        if (/^\/v1\/payment_intents\/pi_renewal_snapshot_\d+$/.test(path))
          return Response.json({
            id: path.split("/").at(-1),
            amount_received: 100000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/refunds" && request.method === "GET") {
          refundHistoryTargets.push(
            new URL(request.url).searchParams.get("payment_intent") ?? "",
          );
          return Response.json({ data: [], has_more: false });
        }
        if (path === "/v1/refunds" && request.method === "POST") {
          const payload = new URLSearchParams(await request.text());
          posts.push({
            target: payload.get("payment_intent"),
            key: request.headers.get("idempotency-key"),
          });
          return Response.json({
            id: `re_renewal_${amount}`,
            amount: amount * 100,
            currency: "usd",
            status: "succeeded",
            created: 3,
            livemode: false,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        }
        throw new Error(
          `Unexpected renewal Stripe request ${request.method} ${path}`,
        );
      });
      const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(
          caseId,
          undefined,
          undefined,
          { amount, currency: "USD" },
          {
            providerBindings: syntheticStripeBindings(caseId),
          },
        );
      const command = (await caseStore.getAction(
        caseId,
        "refund-command",
        native.fingerprint,
      )) as { orderId: string; fingerprint: string; idempotencyKey: string };
      fingerprint = command.fingerprint;
      expect(command.orderId).toBe("in_renewal");
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      expect(
        await recoverApprovedNativeDecisions(mastra, caseStore, {
          disableScorers: true,
        }),
      ).toBe(1);
      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({ key: command.idempotencyKey });
      const executedTarget = posts[0]!.target;
      expect(executedTarget).toMatch(/^pi_renewal_snapshot_\d+$/);
      expect(refundHistoryTargets.at(-1)).toBe(executedTarget);
      expect(
        await caseStore.stripeRefundAttempt(command.idempotencyKey),
      ).toMatchObject({
        stripeRequest: { paymentIntentId: executedTarget },
      });
      expect(await caseStore.get(caseId)).toMatchObject({
        status: "resolved",
        refundResult: { orderId: "in_renewal", status: "executed" },
      });
    }
  });

  it.each([
    {
      label: "ordinary webhook sequence",
      nativeReceiptRace: false,
      postProviderVersionRace: false,
      providerReceiptStatus: "pending",
    },
    {
      label: "terminal webhook after the native pending receipt",
      nativeReceiptRace: true,
      postProviderVersionRace: false,
      providerReceiptStatus: "pending",
    },
    {
      label:
        "failed webhook after the provider success receipt and before the native projection",
      nativeReceiptRace: false,
      postProviderVersionRace: true,
      providerReceiptStatus: "succeeded",
    },
  ])(
    "applies signed pending, duplicate success, and late failed webhooks to the immutable attempt without a poll: $label",
    async ({
      nativeReceiptRace,
      postProviderVersionRace,
      providerReceiptStatus,
    }) => {
      const caseId = `stripe-signed-webhook-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let remoteStatus = "pending";
      let fingerprint = "";
      let posts = 0;
      let refundGets = 0;
      let webhookGetBarrier:
        { started(): void; release: Promise<void> } | undefined;
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions")
          return Response.json({
            data: [
              {
                id: "ORD-1001",
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
        if (path === "/v1/checkout/sessions/ORD-1001/line_items")
          return Response.json({
            data: [{ description: "Synthetic", price: { product: "prod_1" } }],
            has_more: false,
          });
        if (path === "/v1/payment_intents/pi_1")
          return Response.json({
            id: "pi_1",
            amount_received: 102000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "GET")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "POST") {
          posts += 1;
          return Response.json({
            id: "re_webhook",
            amount: 2000,
            currency: "usd",
            status: providerReceiptStatus,
            created: 2,
            livemode: false,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        }
        if (path === "/v1/refunds/re_webhook") {
          refundGets += 1;
          const barrier = webhookGetBarrier;
          if (barrier) {
            webhookGetBarrier = undefined;
            barrier.started();
            await barrier.release;
          }
          return Response.json({
            id: "re_webhook",
            amount: 2000,
            currency: "usd",
            status: remoteStatus,
            created: 2,
            livemode: false,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        }
        throw new Error(
          `Unexpected webhook Stripe request ${request.method} ${path}`,
        );
      });
      const {
        app,
        caseStore,
        databasePath,
        mastra,
        native,
        recoverApprovedNativeDecisions,
      } = await setup(caseId, undefined, undefined, undefined, {
        providerBindings: syntheticStripeBindings(caseId),
      });
      const command = (await caseStore.getAction(
        caseId,
        "refund-command",
        native.fingerprint,
      )) as { fingerprint: string };
      fingerprint = command.fingerprint;
      if (!postProviderVersionRace)
        await caseStore.recordApprovalDecision({
          caseId,
          turnId: native.turnId,
          commandFingerprint: native.fingerprint,
          principalId: "approver-demo",
          approved: true,
          nativeRunId: native.runId,
          nativeToolCallId: native.toolCallId,
        });
      const deliver = async (id: string, type: string) => {
        const signed = signedStripeEvent({
          id,
          type,
          api_version: "2026-08-26.dahlia",
          created: 1,
          livemode: false,
          data: { object: { id: "re_webhook" } },
        });
        return app.request("http://support.test/support/webhooks/stripe", {
          method: "POST",
          headers: signed.headers,
          body: signed.body,
        });
      };
      const originalUpdate =
        caseStore.updateStripeRefundAttempt.bind(caseStore);
      const originalProjection =
        caseStore.projectRefundToolExecution.bind(caseStore);
      let nativeReceiptRaceFired = false;
      let postProviderVersionRaceFired = false;
      const pendingReceiptSpy = nativeReceiptRace
        ? vi
            .spyOn(caseStore, "updateStripeRefundAttempt")
            .mockImplementation(async (idempotencyKey, update) => {
              const updated = await originalUpdate(idempotencyKey, update);
              if (
                !nativeReceiptRaceFired &&
                updated &&
                idempotencyKey === command.idempotencyKey &&
                update.status === "pending" &&
                update.refundId === "re_webhook"
              ) {
                nativeReceiptRaceFired = true;
                remoteStatus = "succeeded";
                expect(
                  (
                    await deliver(
                      "evt_native_pending_succeeded",
                      "refund.updated",
                    )
                  ).status,
                ).toBe(200);
              }
              return updated;
            })
        : undefined;
      const projectionSpy = postProviderVersionRace
        ? vi
            .spyOn(caseStore, "projectRefundToolExecution")
            .mockImplementation(async (input) => {
              if (!postProviderVersionRaceFired && input.caseId === caseId) {
                postProviderVersionRaceFired = true;
                remoteStatus = "failed";
                expect(
                  (
                    await deliver(
                      "evt_post_provider_late_failed",
                      "refund.failed",
                    )
                  ).status,
                ).toBe(200);
              }
              return originalProjection(input);
            })
        : undefined;
      let recovered: number | undefined;
      try {
        if (postProviderVersionRace) {
          const response = await approveNativeRefund(
            app,
            caseId,
            native.fingerprint,
          );
          expect(response.status).toBe(200);
        } else
          recovered = await recoverApprovedNativeDecisions(mastra, caseStore, {
            disableScorers: true,
          });
      } finally {
        pendingReceiptSpy?.mockRestore();
        projectionSpy?.mockRestore();
      }
      if (!postProviderVersionRace) expect(recovered).toBe(1);
      expect(posts).toBe(1);
      if (postProviderVersionRace) {
        expect(postProviderVersionRaceFired).toBe(true);
        expect(
          await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
        ).toMatchObject({ status: "failed" });
        expect(
          await caseStore.idempotency(command.idempotencyKey),
        ).toBeUndefined();
        expect(await caseStore.get(caseId)).toMatchObject({
          status: "escalated",
          refundResult: { status: "failed" },
        });
        const outbox = await caseStore.getClient().execute({
          sql: "SELECT status, body FROM support_outbox WHERE case_id = ? ORDER BY id",
          args: [caseId],
        });
        expect(outbox.rows).toEqual([
          expect.objectContaining({
            status: "escalated",
            body: expect.stringMatching(/additional review/i),
          }),
        ]);
        // Reopen the durable database through the real native recovery entry
        // after the HTTP approval returned. The failed ledger must suppress
        // any resumed native continuation and must not issue another POST.
        const restarted = await setup(caseId, undefined, undefined, undefined, {
          databasePath,
          existingCase: true,
          providerBindings: syntheticStripeBindings(caseId),
        });
        expect(
          await restarted.recoverApprovedNativeDecisions(
            restarted.mastra,
            restarted.caseStore,
            { disableScorers: true },
          ),
        ).toBe(0);
        expect(posts).toBe(1);
        return;
      }
      if (nativeReceiptRace) {
        expect(nativeReceiptRaceFired).toBe(true);
        expect(
          await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
        ).toMatchObject({ status: "succeeded" });
        expect(
          await caseStore.idempotency(command.idempotencyKey),
        ).toMatchObject({
          effect: { status: "succeeded", refundId: "re_webhook" },
        });
        expect(await caseStore.get(caseId)).toMatchObject({
          status: "resolved",
          refundResult: { status: "skipped" },
        });
        const originatingTurn = await caseStore.getClient().execute({
          sql: "SELECT state FROM support_turns WHERE id = ?",
          args: [native.turnId],
        });
        expect(originatingTurn.rows[0]).toMatchObject({ state: "resolved" });
        const outbox = await caseStore.getClient().execute({
          sql: "SELECT id, status, state, originating_turn_id, body FROM support_outbox WHERE case_id = ? ORDER BY id",
          args: [caseId],
        });
        expect(
          outbox.rows.map((row) => ({
            id: String(row.id),
            status: String(row.status),
            state: String(row.state),
            originatingTurnId: String(row.originating_turn_id),
            body: String(row.body),
          })),
        ).toEqual([
          {
            id: `outbox_${caseId}_${native.turnId}_refund-final`,
            status: "resolved",
            state: "delivered",
            originatingTurnId: native.turnId,
            body: expect.any(String),
          },
        ]);
        return;
      }
      expect((await deliver("evt_pending", "refund.updated")).status).toBe(200);
      expect(await caseStore.get(caseId)).toMatchObject({
        refundResult: { status: "pending" },
      });
      // `requires_action` is not an issued refund. It remains recoverable until
      // a later authoritative provider read reports success.
      remoteStatus = "requires_action";
      expect(
        (await deliver("evt_requires_action", "refund.updated")).status,
      ).toBe(200);
      expect(await caseStore.get(caseId)).toMatchObject({
        refundResult: { status: "pending" },
      });
      // Two reconcilers race on the same durable row. Only one can acquire the
      // CAS lease; a stale owner cannot later overwrite the winner's backoff.
      const pendingAttempt =
        await caseStore.stripeRefundAttemptByRefundId("re_webhook");
      await caseStore.updateStripeRefundAttempt(
        pendingAttempt!.idempotencyKey,
        {
          status: "pending",
          nextAttemptAt: new Date(0).toISOString(),
        },
      );
      const [firstClaims, secondClaims] = await Promise.all([
        caseStore.claimableStripeRefundAttempts(),
        caseStore.claimableStripeRefundAttempts(),
      ]);
      expect(firstClaims.length + secondClaims.length).toBe(1);
      const claimed = [...firstClaims, ...secondClaims][0]!;
      // This is the controlled interleaving after a worker has selected and
      // claimed the candidate but before its stale continuation writes back.
      // The signed provider terminalization wins; the stale worker must not
      // restore pending/unknown state or create another notification.
      remoteStatus = "succeeded";
      expect(
        (await deliver("evt_claim_terminal", "refund.updated")).status,
      ).toBe(200);
      expect(
        await caseStore.rescheduleStripeRefundAttempt({
          idempotencyKey: claimed.idempotencyKey,
          reconcileLeaseToken: claimed.reconcileLeaseToken!,
          status: "pending",
          providerStatus: "retrying",
          nextAttemptAt: new Date(Date.now() + 30_000).toISOString(),
        }),
      ).toBe(false);
      expect(
        await caseStore.rescheduleStripeRefundAttempt({
          idempotencyKey: claimed.idempotencyKey,
          reconcileLeaseToken: claimed.reconcileLeaseToken!,
          status: "unknown",
          providerStatus: "stale-worker",
        }),
      ).toBe(false);
      // A new customer turn is allowed to become the active projection while
      // the first attempt is pending. Its terminal webhook must still close and
      // notify the immutable originating turn exactly once.
      const followUp = await app.request(
        `http://support.test/support/cases/${caseId}/follow-ups`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            body: "Please also confirm the renewal date.",
          }),
        },
      );
      expect(followUp.status).toBe(200);
      const afterFollowUp = await caseStore.get(caseId);
      expect(
        (afterFollowUp!.metadata as Record<string, unknown>).activeTurnId,
      ).not.toBe(native.turnId);
      remoteStatus = "succeeded";
      const getsBeforeCompletedReplay = refundGets;
      let markWebhookGetStarted!: () => void;
      let releaseWebhookGet!: () => void;
      webhookGetBarrier = {
        started: () => markWebhookGetStarted(),
        release: new Promise<void>((resolve) => {
          releaseWebhookGet = resolve;
        }),
      };
      const webhookGetStarted = new Promise<void>((resolve) => {
        markWebhookGetStarted = resolve;
      });
      const firstSuccess = deliver("evt_success", "refund.updated");
      await webhookGetStarted;
      // An identical signed delivery while the first reconciliation is in its
      // provider GET is not a second job. Stripe will retry the 503 after the
      // bounded claim, and no second GET starts.
      expect((await deliver("evt_success", "refund.updated")).status).toBe(503);
      expect(refundGets).toBe(getsBeforeCompletedReplay + 1);
      releaseWebhookGet();
      expect((await firstSuccess).status).toBe(200);
      // The completed event is an acknowledgement-only replay. This exact
      // counter is intentionally red against the former receipt-only code.
      expect((await deliver("evt_success", "refund.updated")).status).toBe(200);
      expect(refundGets).toBe(getsBeforeCompletedReplay + 1);
      // Event IDs remain independent: a valid later event still drives its
      // own authoritative provider read and can supersede the prior result.
      expect(
        (await deliver("evt_success_later", "refund.updated")).status,
      ).toBe(200);
      expect(refundGets).toBe(getsBeforeCompletedReplay + 2);
      // Simulate a process dying after its durable receipt claim but before
      // its GET. The active lease returns retryable without a GET; after its
      // bounded expiry the real handler recovers and then completes it.
      expect(
        (await caseStore.claimStripeWebhookEvent("evt_crash_retry")).state,
      ).toBe("claimed");
      expect((await deliver("evt_crash_retry", "refund.updated")).status).toBe(
        503,
      );
      expect(refundGets).toBe(getsBeforeCompletedReplay + 2);
      await caseStore.getClient().execute({
        sql: "UPDATE support_stripe_webhook_receipts SET lease_until = ? WHERE event_id = ?",
        args: [new Date(0).toISOString(), "evt_crash_retry"],
      });
      expect((await deliver("evt_crash_retry", "refund.updated")).status).toBe(
        200,
      );
      expect(refundGets).toBe(getsBeforeCompletedReplay + 3);
      expect((await deliver("evt_crash_retry", "refund.updated")).status).toBe(
        200,
      );
      expect(refundGets).toBe(getsBeforeCompletedReplay + 3);
      expect(await caseStore.get(caseId)).toMatchObject({
        status: "waiting_approval",
      });
      const succeededOriginatingTurn = await caseStore.getClient().execute({
        sql: "SELECT state, outcome_data FROM support_turns WHERE id = ?",
        args: [native.turnId],
      });
      expect(succeededOriginatingTurn.rows[0]).toMatchObject({
        state: "resolved",
      });
      const { reconcileStripeRefundAttempts } =
        await import("../../src/mastra/providers/stripe/reconciliation");
      const succeededAttempt =
        await caseStore.stripeRefundAttemptByRefundId("re_webhook");
      await caseStore.updateStripeRefundAttempt(
        succeededAttempt!.idempotencyKey,
        {
          status: "succeeded",
          nextAttemptAt: new Date(0).toISOString(),
        },
      );
      const getsBeforeSucceededPoll = refundGets;
      await reconcileStripeRefundAttempts(caseStore);
      expect(refundGets).toBeGreaterThan(getsBeforeSucceededPoll);
      await caseStore.enforceRetention(() => new Date());
      expect(
        await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
      ).toMatchObject({ status: "succeeded" });
      await caseStore.updateStripeRefundAttempt(
        succeededAttempt!.idempotencyKey,
        {
          status: "succeeded",
          nextAttemptAt: new Date(0).toISOString(),
        },
      );
      const client = caseStore.getClient();
      const originalExecute = client.execute.bind(client);
      let selectBarrierFired = false;
      client.execute = async (...args) => {
        const selected = await originalExecute(...args);
        const sql = typeof args[0] === "string" ? args[0] : args[0]?.sql;
        if (
          !selectBarrierFired &&
          typeof sql === "string" &&
          sql.startsWith(
            "SELECT * FROM support_stripe_refund_attempts WHERE status IN",
          )
        ) {
          selectBarrierFired = true;
          remoteStatus = "failed";
          expect(
            (await deliver("evt_select_late_failed", "refund.failed")).status,
          ).toBe(200);
        }
        return selected;
      };
      try {
        expect(await caseStore.claimableStripeRefundAttempts()).toEqual([]);
      } finally {
        client.execute = originalExecute;
      }
      expect(selectBarrierFired).toBe(true);
      expect(
        await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
      ).toMatchObject({ status: "failed" });
      expect(await caseStore.get(caseId)).toMatchObject({
        status: "waiting_approval",
      });
      const originatingTurn = await caseStore.getClient().execute({
        sql: "SELECT state, outcome_data FROM support_turns WHERE id = ?",
        args: [native.turnId],
      });
      expect(originatingTurn.rows[0]).toMatchObject({
        state: "escalated",
      });
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      expect(Number((outbox.rows[0] as { total: number }).total)).toBe(2);
      // A recent terminal row remains after the runtime's normal reconcile then
      // retention ordering; only its immutable terminal timestamp may expire it.
      expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
      await caseStore.enforceRetention(() => new Date());
      expect(
        await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
      ).toMatchObject({ status: "failed" });
      // Terminal financial identifiers and unrelated provider delivery receipts
      // must disappear at their separate 365-day and raw-payload boundaries.
      const old = new Date(
        Date.now() - 366 * 24 * 60 * 60 * 1_000,
      ).toISOString();
      const attempt =
        await caseStore.stripeRefundAttemptByRefundId("re_webhook");
      await caseStore.getClient().execute({
        sql: "UPDATE support_stripe_refund_attempts SET created_at = ?, updated_at = ?, terminal_at = ? WHERE idempotency_key = ?",
        args: [old, old, old, attempt!.idempotencyKey],
      });
      await caseStore.getClient().execute({
        sql: "UPDATE support_stripe_webhook_receipts SET created_at = ?, completed_at = ?, updated_at = ? WHERE state = 'completed'",
        args: [old, old, old],
      });
      expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
      await caseStore.enforceRetention(() => new Date());
      expect(
        await caseStore.stripeRefundAttemptByRefundId("re_webhook"),
      ).toBeUndefined();
      const receipts = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_stripe_webhook_receipts",
      });
      expect(Number((receipts.rows[0] as { total: number }).total)).toBe(0);
    },
  );

  it("purges an old succeeded Stripe attempt after an actual scheduled reconciliation poll", async () => {
    const caseId = `stripe-succeeded-retention-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    let refundGets = 0;
    vi.stubGlobal("fetch", async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: "acct_test_123", livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_old", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "ORD-1001",
              customer: "cus_old",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_old",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions/ORD-1001/line_items")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/payment_intents/pi_old")
        return Response.json({
          id: "pi_old",
          amount_received: 102000,
          currency: "usd",
          status: "succeeded",
          livemode: false,
        });
      if (path === "/v1/subscriptions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "GET")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "POST")
        return Response.json({
          id: "re_old_succeeded",
          amount: 2000,
          currency: "usd",
          status: "pending",
          created: 2,
          livemode: false,
          metadata: {
            support_case_id: caseId,
            command_fingerprint: fingerprint,
          },
        });
      if (path === "/v1/refunds/re_old_succeeded") {
        refundGets += 1;
        return Response.json({
          id: "re_old_succeeded",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
          created: 2,
          livemode: false,
          metadata: {
            support_case_id: caseId,
            command_fingerprint: fingerprint,
          },
        });
      }
      throw new Error(
        `Unexpected succeeded-retention request ${request.method} ${path}`,
      );
    });
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, undefined, undefined, undefined, {
        providerBindings: syntheticStripeBindings(caseId),
      });
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { fingerprint: string; idempotencyKey: string };
    fingerprint = command.fingerprint;
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(1);
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    const pending = await caseStore.stripeRefundAttempt(command.idempotencyKey);
    await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
      status: "pending",
      nextAttemptAt: new Date(0).toISOString(),
    });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "succeeded" });
    const old = new Date(Date.now() - 366 * 24 * 60 * 60 * 1_000).toISOString();
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET created_at = ?, updated_at = ?, terminal_at = ?, next_attempt_at = ? WHERE idempotency_key = ?",
      args: [old, old, old, new Date(0).toISOString(), pending!.idempotencyKey],
    });
    const beforePoll = refundGets;
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
    expect(refundGets).toBeGreaterThan(beforePoll);
    await caseStore.enforceRetention(() => new Date());
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toBeUndefined();
  });

  it.each([
    { label: "retry count", ageExpires: false },
    { label: "24-hour age", ageExpires: true },
  ])(
    "quarantines a known requires_action refund once by $label while preserving a newer turn",
    async ({ ageExpires }) => {
      const caseId = `stripe-known-unknown-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let fingerprint = "";
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [
              { id: "cus_unknown", email: "alex@example.com", livemode: false },
            ],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions")
          return Response.json({
            data: [
              {
                id: "ORD-1001",
                customer: "cus_unknown",
                customer_details: { email: "alex@example.com" },
                payment_intent: "pi_unknown",
                status: "complete",
                payment_status: "paid",
                livemode: false,
                created: 1,
              },
            ],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions/ORD-1001/line_items")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/payment_intents/pi_unknown")
          return Response.json({
            id: "pi_unknown",
            amount_received: 102000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "GET")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "POST")
          return Response.json({
            id: "re_requires_action",
            amount: 2000,
            currency: "usd",
            status: "pending",
            created: 2,
            livemode: false,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        if (path === "/v1/refunds/re_requires_action")
          return Response.json({
            id: "re_requires_action",
            amount: 2000,
            currency: "usd",
            status: "requires_action",
            created: 2,
            livemode: false,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        throw new Error(
          `Unexpected known-unknown request ${request.method} ${path}`,
        );
      });
      const { app, caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(caseId, undefined, undefined, undefined, {
          providerBindings: syntheticStripeBindings(caseId),
        });
      const command = (await caseStore.getAction(
        caseId,
        "refund-command",
        native.fingerprint,
      )) as { fingerprint: string; idempotencyKey: string };
      fingerprint = command.fingerprint;
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      expect(
        await recoverApprovedNativeDecisions(mastra, caseStore, {
          disableScorers: true,
        }),
      ).toBe(1);
      const followUp = await app.request(
        `http://support.test/support/cases/${caseId}/follow-ups`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            body: "Please also confirm the renewal date.",
          }),
        },
      );
      expect(followUp.status).toBe(200);
      const { reconcileStripeRefundAttempts } =
        await import("../../src/mastra/providers/stripe/reconciliation");
      if (ageExpires)
        await caseStore.getClient().execute({
          sql: "UPDATE support_stripe_refund_attempts SET created_at = ? WHERE idempotency_key = ?",
          args: [
            new Date(Date.now() - 24 * 60 * 60 * 1_000 - 1).toISOString(),
            command.idempotencyKey,
          ],
        });
      for (let retry = 0; retry < (ageExpires ? 1 : 8); retry += 1) {
        await caseStore.getClient().execute({
          sql: "UPDATE support_stripe_refund_attempts SET next_attempt_at = ? WHERE idempotency_key = ?",
          args: [new Date(0).toISOString(), command.idempotencyKey],
        });
        await reconcileStripeRefundAttempts(caseStore);
      }
      expect(
        await caseStore.stripeRefundAttempt(command.idempotencyKey),
      ).toMatchObject({
        status: "quarantined",
        refundId: "re_requires_action",
      });
      const original = await caseStore.turn(caseId, native.turnId);
      expect(original?.outcome).toMatchObject({ status: "escalated" });
      expect((await caseStore.get(caseId))?.status).toBe("waiting_approval");
      const before = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      const signed = signedStripeEvent({
        id: `evt_known_duplicate_${crypto.randomUUID()}`,
        type: "refund.updated",
        api_version: "2026-08-26.dahlia",
        created: 2,
        livemode: false,
        data: { object: { id: "re_requires_action" } },
      });
      expect(
        (
          await app.request("http://support.test/support/webhooks/stripe", {
            method: "POST",
            headers: signed.headers,
            body: signed.body,
          })
        ).status,
      ).toBe(200);
      await reconcileStripeRefundAttempts(caseStore);
      const after = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      expect(after.rows).toEqual(before.rows);
    },
  );

  it.each(["owner-mismatch", "policy-change"])(
    "does not POST Stripe when %s is discovered after native approval",
    async (denial) => {
      const caseId = `stripe-${denial}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let posts = 0;
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions")
          return Response.json({
            data: [
              {
                id: "ORD-1001",
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
        if (path === "/v1/checkout/sessions/ORD-1001/line_items")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/payment_intents/pi_1")
          return Response.json({
            id: "pi_1",
            amount_received: 102000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "GET")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "POST") {
          posts += 1;
          throw new Error("POST must be denied");
        }
        throw new Error(
          `Unexpected authorization Stripe request ${request.method} ${path}`,
        );
      });
      const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(caseId, undefined, undefined, undefined, {
          providerBindings: syntheticStripeBindings(caseId),
        });
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      const current = await caseStore.get(caseId);
      if (denial === "owner-mismatch")
        await caseStore.update(caseId, {
          metadata: {
            ...(current!.metadata as Record<string, unknown>),
            ownerId: "customer-jordan",
          },
        });
      else
        await caseStore.update(caseId, {
          draft: {
            ...current!.draft!,
            requiresEscalation: true,
            escalationReason: "Policy changed after approval.",
          },
        });
      expect(
        await recoverApprovedNativeDecisions(mastra, caseStore, {
          disableScorers: true,
        }),
      ).toBe(0);
      expect(posts).toBe(0);
    },
  );

  it.each([
    { label: "canonical Intercom contact", changedOwner: false },
    { label: "changed Intercom contact", changedOwner: true },
    { label: "changed canonical binding tuple", changedOwner: "tuple" },
  ])(
    "uses the canonical Intercom owner at the Stripe refund fence: $label",
    async ({ changedOwner }) => {
      const caseId = `intercom-stripe-owner-${crypto.randomUUID()}`;
      const ownerId = `intercom:local-demo:contact:contact-${caseId}`;
      enableSyntheticIntercom();
      enableSyntheticStripe();
      let fingerprint = "";
      const observed = {
        posts: 0,
        accountGets: 0,
        gets: [] as string[],
        keys: [] as string[],
      };
      vi.stubGlobal(
        "fetch",
        nativeRefundStripeTransport({
          caseId,
          fingerprint: () => fingerprint,
          observed,
        }),
      );
      const { app, caseStore, native } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          ownerId,
          source: "intercom-conversation",
          supportSource: "intercom",
          providerBindings: syntheticIntercomStripeBindings(caseId),
        },
      );
      fingerprint = native.fingerprint;
      if (changedOwner === true) {
        const current = await caseStore.get(caseId);
        await caseStore.update(caseId, {
          metadata: {
            ...(current!.metadata as Record<string, unknown>),
            ownerId: `intercom:local-demo:contact:spoofed-${caseId}`,
          },
        });
      } else if (changedOwner === "tuple")
        await caseStore.getClient().execute({
          sql: "UPDATE support_conversations SET external_conversation_id = ? WHERE case_id = ?",
          args: [`spoofed-conversation-${caseId}`, caseId],
        });

      const approval = await approveNativeRefund(app, caseId, fingerprint);

      expect(observed.posts).toBe(changedOwner ? 0 : 1);
      if (changedOwner) {
        expect(approval.status).toBe(500);
        await expect(
          caseStore.getAction(caseId, "refund-failure", fingerprint),
        ).resolves.toMatchObject({
          classification: "confirmed-no-effect",
          reason:
            "The persisted canonical conversation owner no longer matches the case.",
        });
        await expect(
          caseStore.getAction(caseId, "refund-uncertain", fingerprint),
        ).resolves.toBeUndefined();
      } else {
        expect(approval.status).toBe(200);
        expect(await caseStore.get(caseId)).toMatchObject({
          status: "resolved",
          metadata: { ownerId },
          refundResult: { status: "executed" },
        });
      }
    },
  );

  it("keeps an uncertain Intercom refund receipt recoverable after owner drift", async () => {
    const caseId = `intercom-stripe-owner-uncertain-${crypto.randomUUID()}`;
    const ownerId = `intercom:local-demo:contact:contact-${caseId}`;
    enableSyntheticIntercom();
    enableSyntheticStripe();
    let fingerprint = "";
    const observed = {
      posts: 0,
      accountGets: 0,
      gets: [] as string[],
      keys: [] as string[],
    };
    vi.stubGlobal(
      "fetch",
      nativeRefundStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
        firstPostThrows: true,
      }),
    );
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        ownerId,
        source: "intercom-conversation",
        supportSource: "intercom",
        providerBindings: syntheticIntercomStripeBindings(caseId),
      },
    );
    fingerprint = native.fingerprint;
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      fingerprint,
    )) as { idempotencyKey: string };

    expect((await approveNativeRefund(app, caseId, fingerprint)).status).toBe(
      200,
    );
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "unknown" });
    const current = await caseStore.get(caseId);
    await caseStore.update(caseId, {
      metadata: {
        ...(current!.metadata as Record<string, unknown>),
        ownerId: `intercom:local-demo:contact:spoofed-${caseId}`,
      },
    });
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET next_attempt_at = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), command.idempotencyKey],
    });
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");

    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
    expect(observed.posts).toBe(1);
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "unknown" });
    await expect(
      caseStore.getAction(caseId, "refund-uncertain", fingerprint),
    ).resolves.toMatchObject({ classification: "uncertain" });
    await expect(
      caseStore.getAction(caseId, "refund-failure", fingerprint),
    ).resolves.toBeUndefined();
  });

  it("keeps a replacement reconciliation claim authoritative at the native recovery first-effect fence", async () => {
    const caseId = `stripe-recovery-final-fence-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    const observed = {
      posts: 0,
      accountGets: 0,
      gets: [] as string[],
      keys: [] as string[],
    };
    let recoveryBarrier:
      { started: () => void; release: Promise<void> } | undefined;
    vi.stubGlobal(
      "fetch",
      nativeRefundStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
        firstPostThrows: true,
        barrier: (path) =>
          path === "/v1/account" ? recoveryBarrier : undefined,
      }),
    );
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { providerBindings: syntheticStripeBindings(caseId) },
    );
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { fingerprint: string; idempotencyKey: string };
    fingerprint = command.fingerprint;
    expect(
      (await approveNativeRefund(app, caseId, native.fingerprint)).status,
    ).toBe(200);
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({
      status: "unknown",
    });

    // Recovery is a fresh process boundary. Re-registering the real Stripe
    // registry makes its account verification a genuine awaited GET while
    // retaining the same durable SQLite attempt and command.
    const { resetProviderRegistryForTests, registerProviderRegistry } =
      await import("../../src/mastra/providers/registry");
    const { StripeProviderRegistry } =
      await import("../../src/mastra/providers/stripe/registry");
    const { stripeSandboxConfig } =
      await import("../../src/mastra/providers/stripe/config");
    const bindings = syntheticStripeBindings(caseId);
    resetProviderRegistryForTests();
    registerProviderRegistry(
      new StripeProviderRegistry(stripeSandboxConfig()!),
      [bindings.transactions],
    );
    let releaseAccount!: () => void;
    let markAccountStarted!: () => void;
    const accountStarted = new Promise<void>((resolve) => {
      markAccountStarted = resolve;
    });
    recoveryBarrier = {
      started: () => markAccountStarted(),
      release: new Promise<void>((resolve) => {
        releaseAccount = resolve;
      }),
    };
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    const staleRecovery = reconcileStripeRefundAttempts(caseStore);
    await Promise.race([
      accountStarted,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `recovery did not await account: ${JSON.stringify(observed)}`,
              ),
            ),
          1_000,
        ),
      ),
    ]);
    const staleClaim = await caseStore.stripeRefundAttempt(
      command.idempotencyKey,
    );
    expect(staleClaim?.reconcileLeaseToken).toEqual(expect.any(String));
    const replacementToken = `replacement-${crypto.randomUUID()}`;
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_token = ?, reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [
        replacementToken,
        new Date(Date.now() + 60_000).toISOString(),
        command.idempotencyKey,
      ],
    });
    releaseAccount();
    expect(await staleRecovery).toBe(0);
    expect({
      postsAfterStaleClaim: observed.posts,
      attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
      issued: await caseStore.idempotency(command.idempotencyKey),
    }).toMatchObject({
      postsAfterStaleClaim: 1,
      attempt: { status: "unknown", reconcileLeaseToken: replacementToken },
      issued: undefined,
    });

    recoveryBarrier = undefined;
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), command.idempotencyKey],
    });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect({
      posts: observed.posts,
      keys: observed.keys,
      attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
      issued: await caseStore.idempotency(command.idempotencyKey),
    }).toMatchObject({
      posts: 2,
      keys: [command.idempotencyKey, command.idempotencyKey],
      attempt: { status: "succeeded" },
      issued: expect.any(Object),
    });
  });

  it("keeps a replacement claim authoritative for a prepared native recovery before its first POST", async () => {
    const caseId = `stripe-prepared-recovery-fence-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    const observed = {
      posts: 0,
      accountGets: 0,
      gets: [] as string[],
      keys: [] as string[],
    };
    let preflightBarrier:
      { started: () => void; release: Promise<void> } | undefined;
    let recoveryBarrier:
      { started: () => void; release: Promise<void> } | undefined;
    vi.stubGlobal(
      "fetch",
      nativeRefundStripeTransport({
        caseId,
        fingerprint: () => fingerprint,
        observed,
        barrier: (path) =>
          path === "/v1/refunds"
            ? preflightBarrier
            : path === "/v1/account"
              ? recoveryBarrier
              : undefined,
      }),
    );
    const { app, caseStore, native } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      { providerBindings: syntheticStripeBindings(caseId) },
    );
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { fingerprint: string; idempotencyKey: string };
    fingerprint = command.fingerprint;
    let releasePreflight!: () => void;
    let markPreflightStarted!: () => void;
    const preflightStarted = new Promise<void>((resolve) => {
      markPreflightStarted = resolve;
    });
    preflightBarrier = {
      started: () => markPreflightStarted(),
      release: new Promise<void>((resolve) => {
        releasePreflight = resolve;
      }),
    };
    const initialApproval = approveNativeRefund(
      app,
      caseId,
      native.fingerprint,
    );
    await preflightStarted;
    const dispatch = await caseStore.getClient().execute({
      sql: "SELECT id FROM support_dispatch WHERE case_id = ? AND turn_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [caseId, native.turnId],
    });
    await caseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), dispatch.rows[0]!.id as string],
    });
    releasePreflight();
    expect((await initialApproval).status).toBe(409);
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({
      status: "prepared",
      stripeRequest: { paymentIntentId: "pi_1" },
    });
    expect(observed.posts).toBe(0);

    const { resetProviderRegistryForTests, registerProviderRegistry } =
      await import("../../src/mastra/providers/registry");
    const { StripeProviderRegistry } =
      await import("../../src/mastra/providers/stripe/registry");
    const { stripeSandboxConfig } =
      await import("../../src/mastra/providers/stripe/config");
    resetProviderRegistryForTests();
    registerProviderRegistry(
      new StripeProviderRegistry(stripeSandboxConfig()!),
      [syntheticStripeBindings(caseId).transactions],
    );
    let releaseAccount!: () => void;
    let markAccountStarted!: () => void;
    const accountStarted = new Promise<void>((resolve) => {
      markAccountStarted = resolve;
    });
    recoveryBarrier = {
      started: () => markAccountStarted(),
      release: new Promise<void>((resolve) => {
        releaseAccount = resolve;
      }),
    };
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    const staleRecovery = reconcileStripeRefundAttempts(caseStore);
    await accountStarted;
    const staleClaim = await caseStore.stripeRefundAttempt(
      command.idempotencyKey,
    );
    const replacementToken = `replacement-${crypto.randomUUID()}`;
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_token = ?, reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [
        replacementToken,
        new Date(Date.now() + 60_000).toISOString(),
        command.idempotencyKey,
      ],
    });
    releaseAccount();
    expect(await staleRecovery).toBe(0);
    expect({
      staleToken: staleClaim?.reconcileLeaseToken,
      posts: observed.posts,
      attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
      issued: await caseStore.idempotency(command.idempotencyKey),
    }).toMatchObject({
      staleToken: expect.any(String),
      posts: 0,
      attempt: { status: "prepared", reconcileLeaseToken: replacementToken },
      issued: undefined,
    });
    recoveryBarrier = undefined;
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), command.idempotencyKey],
    });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect({
      posts: observed.posts,
      keys: observed.keys,
      attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
    }).toMatchObject({
      posts: 1,
      keys: [command.idempotencyKey],
      attempt: { status: "succeeded" },
    });
  });

  it("denies a registered cancellation when its dispatch is replaced during the final subscription preflight", async () => {
    const caseId = `stripe-cancellation-final-fence-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      refundPosts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: false,
    };
    let releaseSubscription!: () => void;
    let markSubscriptionStarted!: () => void;
    let subscriptionBarrier:
      { started: () => void; release: Promise<void> } | undefined;
    vi.stubGlobal(
      "fetch",
      cancellationStripeTransport(observed, (path) =>
        path === "/v1/subscriptions/sub_cancel"
          ? subscriptionBarrier
          : undefined,
      ),
    );
    const { caseStore, mastra } = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      {
        deferInitialWorkflow: true,
        providerBindings: syntheticStripeBindings(caseId),
        triage: {
          intent: "cancellation",
          urgency: "normal",
          sentiment: "neutral",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "explicit cancellation",
        },
        message:
          "Please cancel my subscription at the end of the period. I do not want a refund.",
        responseModel: jsonModel({
          draftResponse: "draft",
          citedSources: ["subscription-cancellation-policy"],
          recommendRefund: false,
          requiresEscalation: false,
        }) as never,
      },
    );
    const dispatch = await caseStore.claimDispatchForStart(
      caseId,
      `workflow-${caseId}`,
    );
    expect(dispatch).toMatchObject({
      id: expect.any(String),
      leaseToken: expect.any(String),
    });
    await caseStore.markDispatchStarted(dispatch!.id, dispatch!.leaseToken);
    const current = await caseStore.get(caseId);
    await caseStore.update(caseId, {
      workflowRunId: `workflow-${caseId}`,
      metadata: {
        ...(current!.metadata as Record<string, unknown>),
        activeTurnId: dispatch!.turnId,
      },
    });
    const subscriptionStarted = new Promise<void>((resolve) => {
      markSubscriptionStarted = resolve;
    });
    subscriptionBarrier = {
      started: () => markSubscriptionStarted(),
      release: new Promise<void>((resolve) => {
        releaseSubscription = resolve;
      }),
    };
    const { withDispatchLeaseScope } =
      await import("../../src/mastra/lib/dispatch-lease-scope");
    const run = await mastra
      .getWorkflow("resolveSupportCaseWorkflow")
      .createRun({ runId: `workflow-${caseId}`, disableScorers: true });
    const cancellationRun = withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId,
        turnId: dispatch!.turnId,
        leaseToken: dispatch!.leaseToken!,
      },
      () => run.start({ inputData: { caseId, turnId: dispatch!.turnId } }),
    );
    await Promise.race([
      subscriptionStarted,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `cancellation did not reach final subscription GET: ${JSON.stringify(observed)}`,
              ),
            ),
          1_000,
        ),
      ),
    ]);
    await caseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_token = ?, lease_until = ? WHERE id = ?",
      args: [
        `replacement-${crypto.randomUUID()}`,
        new Date(Date.now() + 60_000).toISOString(),
        dispatch!.id,
      ],
    });
    releaseSubscription();
    await cancellationRun;
    const attempts = await caseStore.getClient().execute({
      sql: "SELECT status FROM support_subscription_cancellation_attempts WHERE case_id = ?",
      args: [caseId],
    });
    const issued = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_idempotency",
    });
    expect({
      posts: observed.posts,
      refundPosts: observed.refundPosts,
      keys: observed.keys,
      attempt: attempts.rows[0],
    }).toMatchObject({
      posts: 0,
      refundPosts: 0,
      keys: [],
      attempt: { status: "unknown" },
    });
    expect(Number((issued.rows[0] as { total: number }).total)).toBe(0);
  });

  it.each([
    "dispatch-expired",
    "dispatch-replaced",
    "owner-replaced",
    "turn-replaced",
    "command-replaced",
    "policy-rejected",
  ] as const)(
    "denies a registered native refund when $0 changes at the final Stripe preflight GET",
    async (mutation) => {
      const caseId = `stripe-final-fence-${mutation}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let fingerprint = "";
      const observed = {
        posts: 0,
        accountGets: 0,
        gets: [] as string[],
        keys: [] as string[],
      };
      let releaseAccount!: () => void;
      let markAccountStarted!: () => void;
      let accountBarrier:
        { started: () => void; release: Promise<void> } | undefined;
      vi.stubGlobal(
        "fetch",
        nativeRefundStripeTransport({
          caseId,
          fingerprint: () => fingerprint,
          observed,
          barrier: (path) =>
            path === "/v1/refunds" ? accountBarrier : undefined,
        }),
      );
      const { app, caseStore, native } = await setup(
        caseId,
        undefined,
        undefined,
        undefined,
        {
          providerBindings: syntheticStripeBindings(caseId),
        },
      );
      fingerprint = (
        (await caseStore.getAction(
          caseId,
          "refund-command",
          native.fingerprint,
        )) as { fingerprint: string }
      ).fingerprint;
      const accountStarted = new Promise<void>((resolve) => {
        markAccountStarted = resolve;
      });
      accountBarrier = {
        started: () => markAccountStarted(),
        release: new Promise<void>((resolve) => {
          releaseAccount = resolve;
        }),
      };
      const staleApproval = approveNativeRefund(
        app,
        caseId,
        native.fingerprint,
      );
      await Promise.race([
        accountStarted,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `native approval did not reach final preflight GET: ${JSON.stringify(observed)}`,
                ),
              ),
            1_000,
          ),
        ),
      ]);
      const command = (await caseStore.getAction(
        caseId,
        "refund-command",
        native.fingerprint,
      )) as { idempotencyKey: string; reason: string };
      const dispatch = await caseStore.getClient().execute({
        sql: "SELECT id, lease_token FROM support_dispatch WHERE case_id = ? AND turn_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [caseId, native.turnId],
      });
      expect(dispatch.rows[0]).toMatchObject({
        id: expect.any(String),
        lease_token: expect.any(String),
      });
      if (mutation === "dispatch-expired")
        await caseStore.getClient().execute({
          sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ?",
          args: [new Date(0).toISOString(), dispatch.rows[0]!.id as string],
        });
      else if (mutation === "dispatch-replaced")
        await caseStore.getClient().execute({
          sql: "UPDATE support_dispatch SET lease_token = ?, lease_until = ? WHERE id = ?",
          args: [
            `replacement-${crypto.randomUUID()}`,
            new Date(Date.now() + 60_000).toISOString(),
            dispatch.rows[0]!.id as string,
          ],
        });
      else if (mutation === "owner-replaced" || mutation === "turn-replaced") {
        const current = await caseStore.get(caseId);
        await caseStore.update(caseId, {
          metadata: {
            ...(current!.metadata as Record<string, unknown>),
            ...(mutation === "owner-replaced"
              ? { ownerId: "customer-replaced" }
              : { activeTurnId: `turn-replaced-${crypto.randomUUID()}` }),
          },
        });
      } else if (mutation === "command-replaced")
        await caseStore.getClient().execute({
          sql: "UPDATE support_actions SET data = ? WHERE case_id = ? AND kind = 'refund-command' AND fingerprint = ?",
          args: [
            JSON.stringify({ ...command, reason: "replaced after preflight" }),
            caseId,
            native.fingerprint,
          ],
        });
      else {
        const current = await caseStore.get(caseId);
        await caseStore.update(caseId, {
          draft: {
            ...current!.draft!,
            requiresEscalation: true,
            escalationReason:
              "Policy replaced while Stripe preflight was held.",
          },
        });
      }
      releaseAccount();
      expect([409, 500]).toContain((await staleApproval).status);
      expect({
        observed,
        attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
        issued: await caseStore.idempotency(command.idempotencyKey),
      }).toMatchObject({
        observed: { posts: 0, accountGets: 1, keys: [] },
        attempt: { status: "prepared" },
        issued: undefined,
      });
    },
  );

  it.each([
    ["succeeded", "resolved", "executed"],
    ["failed", "escalated", "failed"],
    ["canceled", "escalated", "failed"],
  ] as const)(
    "finalizes an immediate native Stripe %s Refund payload without livemode with its audit and outbox",
    async (providerStatus, caseStatus, refundStatus) => {
      const caseId = `stripe-immediate-${providerStatus}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let fingerprint = "";
      let posts = 0;
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions")
          return Response.json({
            data: [
              {
                id: "ORD-1001",
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
        if (path === "/v1/checkout/sessions/ORD-1001/line_items")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/payment_intents/pi_1")
          return Response.json({
            id: "pi_1",
            amount_received: 102000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "GET")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "POST") {
          posts += 1;
          return Response.json({
            id: `re_${providerStatus}`,
            amount: 2000,
            currency: "usd",
            status: providerStatus,
            created: 2,
            metadata: {
              support_case_id: caseId,
              command_fingerprint: fingerprint,
            },
          });
        }
        throw new Error(
          `Unexpected immediate Stripe request ${request.method} ${path}`,
        );
      });
      const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(caseId, undefined, undefined, undefined, {
          providerBindings: syntheticStripeBindings(caseId),
        });
      fingerprint = (
        (await caseStore.getAction(
          caseId,
          "refund-command",
          native.fingerprint,
        )) as { fingerprint: string }
      ).fingerprint;
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      expect(
        await recoverApprovedNativeDecisions(mastra, caseStore, {
          disableScorers: true,
        }),
      ).toBe(1);
      expect(posts).toBe(1);
      expect(await caseStore.get(caseId)).toMatchObject({
        status: caseStatus,
        refundResult: { status: refundStatus },
      });
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      expect(Number((outbox.rows[0] as { total: number }).total)).toBe(1);
      if (refundStatus === "failed") {
        const audit = await caseStore.getAction(
          caseId,
          "refund-failure",
          native.fingerprint,
        );
        expect(audit).toMatchObject({ classification: "confirmed-failed" });
      }
    },
  );

  it.each(["preflight", "post-4xx"] as const)(
    "terminalizes a deterministic Stripe refund %s without reconciliation work",
    async (failure) => {
      const caseId = `stripe-no-effect-${failure}-${crypto.randomUUID()}`;
      enableSyntheticStripe();
      let posts = 0;
      let refundGets = 0;
      let denyPreflight = false;
      vi.stubGlobal("fetch", async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account")
          return Response.json({ id: "acct_test_123", livemode: false });
        if (path === "/v1/customers")
          return Response.json({
            data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
            has_more: false,
          });
        if (path === "/v1/checkout/sessions")
          return Response.json({
            data: [
              {
                id: "ORD-1001",
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
        if (path === "/v1/checkout/sessions/ORD-1001/line_items")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/payment_intents/pi_1")
          return Response.json({
            id: "pi_1",
            amount_received: 102000,
            currency: "usd",
            status: "succeeded",
            livemode: false,
          });
        if (path === "/v1/subscriptions")
          return Response.json({ data: [], has_more: false });
        if (path === "/v1/refunds" && request.method === "GET") {
          refundGets += 1;
          if (failure === "preflight" && denyPreflight)
            return Response.json({ error: "synthetic" }, { status: 400 });
          return Response.json({ data: [], has_more: false });
        }
        if (path === "/v1/refunds" && request.method === "POST") {
          posts += 1;
          return Response.json({ error: "synthetic" }, { status: 400 });
        }
        throw new Error(`Unexpected no-effect Stripe request ${path}`);
      });
      const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
        await setup(caseId, undefined, undefined, undefined, {
          providerBindings: syntheticStripeBindings(caseId),
        });
      const command = (await caseStore.getAction(
        caseId,
        "refund-command",
        native.fingerprint,
      )) as { idempotencyKey: string };
      denyPreflight = true;
      await caseStore.recordApprovalDecision({
        caseId,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      });
      const callsAfterEffect = { posts, refundGets };
      const { reconcileStripeRefundAttempts } =
        await import("../../src/mastra/providers/stripe/reconciliation");
      expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      });
      expect({
        callsAfterEffect,
        callsAfterRecovery: { posts, refundGets },
        attempt: await caseStore.stripeRefundAttempt(command.idempotencyKey),
        case: await caseStore.get(caseId),
        audit: await caseStore.getAction(
          caseId,
          "refund-failure",
          native.fingerprint,
        ),
      }).toMatchObject({
        callsAfterEffect: {
          posts: failure === "post-4xx" ? 1 : 0,
        },
        callsAfterRecovery: callsAfterEffect,
        attempt: { status: "failed", providerStatus: "confirmed-no-effect" },
        case: { status: "escalated" },
        audit: { classification: "confirmed-no-effect" },
      });
      const workflowRunId = (await caseStore.get(caseId))!.workflowRunId!;
      expect(
        await mastra
          .getWorkflow("resolveSupportCaseWorkflow")
          .getWorkflowRunById(workflowRunId),
      ).toMatchObject({ status: "canceled" });
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      expect(Number((outbox.rows[0] as { total: number }).total)).toBe(1);
    },
  );

  it("reuses one persisted Stripe payment target and idempotency key after a lost POST response, and quarantines after expiry", async () => {
    const caseId = `stripe-lost-response-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    let fingerprint = "";
    let remoteBalance = 102000;
    let posts = 0;
    const observed: Array<{ key: string | null; target: string | null }> = [];
    vi.stubGlobal("fetch", async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ id: "acct_test_123", livemode: false });
      if (path === "/v1/customers")
        return Response.json({
          data: [{ id: "cus_1", email: "alex@example.com", livemode: false }],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions")
        return Response.json({
          data: [
            {
              id: "ORD-1001",
              customer: "cus_1",
              customer_details: { email: "alex@example.com" },
              payment_intent: "pi_original",
              status: "complete",
              payment_status: "paid",
              livemode: false,
              created: 1,
            },
          ],
          has_more: false,
        });
      if (path === "/v1/checkout/sessions/ORD-1001/line_items")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/payment_intents/pi_original")
        return Response.json({
          id: "pi_original",
          amount_received: remoteBalance,
          currency: "usd",
          status: "succeeded",
          livemode: false,
        });
      if (path === "/v1/subscriptions")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "GET")
        return Response.json({ data: [], has_more: false });
      if (path === "/v1/refunds" && request.method === "POST") {
        posts += 1;
        const body = new URLSearchParams(await request.text());
        observed.push({
          key: request.headers.get("idempotency-key"),
          target: body.get("payment_intent"),
        });
        remoteBalance -= 2000;
        if (posts === 1) throw new Error("response lost after remote commit");
        return Response.json({
          id: "re_recovered",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
          created: 2,
          livemode: false,
          metadata: {
            support_case_id: caseId,
            command_fingerprint: fingerprint,
          },
        });
      }
      throw new Error(
        `Unexpected lost-response Stripe request ${request.method} ${path}`,
      );
    });
    const { caseStore, mastra, native, recoverApprovedNativeDecisions } =
      await setup(caseId, undefined, undefined, undefined, {
        providerBindings: syntheticStripeBindings(caseId),
      });
    const command = (await caseStore.getAction(
      caseId,
      "refund-command",
      native.fingerprint,
    )) as { fingerprint: string; idempotencyKey: string };
    fingerprint = command.fingerprint;
    await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: native.fingerprint,
      principalId: "approver-demo",
      approved: true,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
    expect(
      await recoverApprovedNativeDecisions(mastra, caseStore, {
        disableScorers: true,
      }),
    ).toBe(0);
    const attempt = await caseStore.stripeRefundAttempt(command.idempotencyKey);
    expect(attempt).toMatchObject({
      status: "unknown",
      stripeRequest: { paymentIntentId: "pi_original" },
    });
    const { reconcileStripeRefundAttempts } =
      await import("../../src/mastra/providers/stripe/reconciliation");
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(1);
    expect(observed).toEqual([
      { key: command.idempotencyKey, target: "pi_original" },
      { key: command.idempotencyKey, target: "pi_original" },
    ]);
    const recovered = await caseStore.stripeRefundAttempt(
      command.idempotencyKey,
    );
    await caseStore.getClient().execute({
      sql: "UPDATE support_stripe_refund_attempts SET status = 'unknown', refund_id = NULL, created_at = ?, next_attempt_at = ? WHERE idempotency_key = ?",
      args: [
        new Date(0).toISOString(),
        new Date(0).toISOString(),
        command.idempotencyKey,
      ],
    });
    expect(await reconcileStripeRefundAttempts(caseStore)).toBe(0);
    expect(
      await caseStore.stripeRefundAttempt(command.idempotencyKey),
    ).toMatchObject({ status: "quarantined" });
    expect(posts).toBe(2);
    expect(recovered).toMatchObject({ status: "succeeded" });
  });

  it("recovers a lost native Stripe cancellation after a SQLite restart without replacing a newer turn", async () => {
    const caseId = `cancel-restart-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: true,
    };
    vi.stubGlobal("fetch", cancellationStripeTransport(observed));
    const cancellationOptions = {
      providerBindings: syntheticStripeBindings(caseId),
      triage: {
        intent: "cancellation",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "explicit no-refund cancellation",
      },
      message:
        "Please cancel my subscription at the end of the period. I do not want a refund.",
      responseModel: jsonModel({
        draftResponse: "draft",
        citedSources: ["subscription-cancellation-policy"],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    };
    const initial = await setup(
      caseId,
      undefined,
      undefined,
      undefined,
      cancellationOptions,
    );
    const databasePath = initial.databasePath;
    const initialTurn = (await initial.caseStore.turns(caseId))[0]!;
    const commandRow = await initial.caseStore.getClient().execute({
      sql: "SELECT idempotency_key, subscription_id, status FROM support_subscription_cancellation_attempts WHERE case_id = ?",
      args: [caseId],
    });
    expect(commandRow.rows[0]).toMatchObject({
      subscription_id: "sub_cancel",
      status: "unknown",
    });
    expect(observed.posts).toBe(1);
    const initialOutbox = await initial.caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    const initialOutboxCount = Number(
      (initialOutbox.rows[0] as { total: number }).total,
    );
    await initial.mastra.shutdown();

    // A new customer message gets its own durable turn before the former
    // process restarts. Cancellation recovery owns the original turn only.
    const reopened = await setup(caseId, undefined, undefined, undefined, {
      ...cancellationOptions,
      databasePath,
      existingCase: true,
    });
    const followUp = await reopened.caseStore.appendFollowUp({
      caseId,
      eventId: `cancel-follow-up-${crypto.randomUUID()}`,
      runId: `cancel-follow-up-run-${crypto.randomUUID()}`,
      message: {
        id: `cancel-follow-up-message-${crypto.randomUUID()}`,
        author: "customer",
        body: "Can you also send me a renewal-date reminder?",
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp.appended).toBe(true);
    const { reconcileUnknownSubscriptionCancellations } =
      await import("../../src/mastra/providers/stripe/cancellation-reconciliation");
    const firstRecovery = await reconcileUnknownSubscriptionCancellations(
      reopened.caseStore,
    );
    const secondRecovery = await reconcileUnknownSubscriptionCancellations(
      reopened.caseStore,
    );
    const recoveredCase = await reopened.caseStore.get(caseId);
    const originalTurn = await reopened.caseStore.turn(caseId, initialTurn.id);
    const outbox = await reopened.caseStore.getClient().execute({
      sql: "SELECT originating_turn_id FROM support_outbox WHERE case_id = ? ORDER BY created_at, id",
      args: [caseId],
    });
    const durableEffect = await reopened.caseStore.idempotency(
      String(
        (commandRow.rows[0] as { idempotency_key: string }).idempotency_key,
      ),
    );
    expect({
      firstRecovery,
      secondRecovery,
      posts: observed.posts,
      exactRecoveryGets: observed.gets.filter(
        (path) => path === "/v1/subscriptions/sub_cancel",
      ).length,
      keys: observed.keys,
      durableEffect: durableEffect?.effect,
      originalOutcome: originalTurn?.outcome?.status,
      newerTurn: recoveredCase
        ? (recoveredCase.metadata as Record<string, unknown>).pendingTurnId
        : undefined,
      currentStatus: recoveredCase?.status,
      recoveryOutbox: outbox.rows.slice(initialOutboxCount),
    }).toMatchObject({
      firstRecovery: 1,
      secondRecovery: 0,
      posts: 1,
      exactRecoveryGets: 2,
      keys: [expect.stringMatching(new RegExp(`^cancel:${caseId}:`))],
      durableEffect: {
        subscriptionId: "sub_cancel",
        cancelAtPeriodEnd: true,
      },
      originalOutcome: "resolved",
      newerTurn: followUp.turnId,
      currentStatus: "new",
      recoveryOutbox: [{ originating_turn_id: initialTurn.id }],
    });
  });

  it("quarantines an unconfirmed cancellation older than 24 hours with one durable staff escalation", async () => {
    const caseId = `cancel-expired-${crypto.randomUUID()}`;
    enableSyntheticStripe();
    const observed = {
      posts: 0,
      gets: [] as string[],
      keys: [] as string[],
      scheduled: false,
      loseFirstPost: true,
    };
    vi.stubGlobal("fetch", cancellationStripeTransport(observed));
    const { caseStore } = await setup(caseId, undefined, undefined, undefined, {
      providerBindings: syntheticStripeBindings(caseId),
      triage: {
        intent: "cancellation",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview: false,
        confidence: 1,
        rationale: "explicit no-refund cancellation",
      },
      message:
        "Please cancel my subscription at the end of the period. I do not want a refund.",
      responseModel: jsonModel({
        draftResponse: "draft",
        citedSources: ["subscription-cancellation-policy"],
        recommendRefund: false,
        requiresEscalation: false,
      }) as never,
      allowInitialWorkflowFailure: true,
    });
    const attempt = await caseStore.getClient().execute({
      sql: "SELECT idempotency_key, fingerprint FROM support_subscription_cancellation_attempts WHERE case_id = ?",
      args: [caseId],
    });
    const initialOutbox = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS total FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    const initialOutboxCount = Number(
      (initialOutbox.rows[0] as { total: number }).total,
    );
    await caseStore.getClient().execute({
      sql: "UPDATE support_subscription_cancellation_attempts SET created_at = ? WHERE idempotency_key = ?",
      args: [
        new Date(Date.now() - 24 * 60 * 60 * 1_000 - 1).toISOString(),
        (attempt.rows[0] as { idempotency_key: string }).idempotency_key,
      ],
    });
    const { reconcileUnknownSubscriptionCancellations } =
      await import("../../src/mastra/providers/stripe/cancellation-reconciliation");
    await reconcileUnknownSubscriptionCancellations(caseStore);
    await reconcileUnknownSubscriptionCancellations(caseStore);
    const expired = await caseStore.getClient().execute({
      sql: "SELECT status FROM support_subscription_cancellation_attempts WHERE idempotency_key = ?",
      args: [(attempt.rows[0] as { idempotency_key: string }).idempotency_key],
    });
    const audit = await caseStore.getAction(
      caseId,
      "subscription-cancellation-failure",
      (attempt.rows[0] as { fingerprint: string }).fingerprint,
    );
    const outbox = await caseStore.getClient().execute({
      sql: "SELECT originating_turn_id, status FROM support_outbox WHERE case_id = ? ORDER BY created_at, id",
      args: [caseId],
    });
    expect({
      posts: observed.posts,
      attempt: expired.rows[0],
      case: await caseStore.get(caseId),
      audit,
      recoveryOutbox: outbox.rows.slice(initialOutboxCount),
    }).toMatchObject({
      posts: 1,
      attempt: { status: "quarantined" },
      case: {
        status: "escalated",
        escalationReason: expect.stringMatching(/could not be confirmed/i),
      },
      audit: { classification: "unconfirmed-expired" },
      recoveryOutbox: [{ status: "escalated" }],
    });
  });
});

async function localRefundCount(caseStore: {
  getClient(): { execute(sql: string): Promise<{ rows: unknown[] }> };
}) {
  const result = await caseStore
    .getClient()
    .execute("SELECT COUNT(*) AS total FROM local_refunds");
  return Number((result.rows[0] as { total?: number }).total ?? 0);
}
