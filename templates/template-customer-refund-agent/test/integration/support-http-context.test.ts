import { rm } from "node:fs/promises";
import { RequestContext } from "@mastra/core/request-context";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicSupportCaseSchema } from "../../src/mastra/domain/support-case";
import { caseStore } from "../../src/mastra/lib/case-store";
import { inboundSupportResponseSchema } from "../../src/mastra/server/contracts";
import {
  supportCaseApproveRoute,
  supportCaseRejectRoute,
} from "../../src/mastra/server/routes";
import { issueLocalSession } from "../../src/mastra/server/auth";
import {
  deterministicRefundModel,
  type DeterministicRefundModel,
} from "../fixtures/deterministic-language-model";
import { temporaryDatabasePath } from "../support/temp-path";

const databaseFiles: string[] = [];
const mastraRuntimes: Array<{ shutdown(): Promise<void> }> = [];
const closeSharedClients: Array<() => Promise<void>> = [];
const approverHeaders = {
  authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
};
const supportAgentHeaders = {
  authorization: `Bearer ${issueLocalSession({ id: "support-agent-demo" })}`,
};
const customerHeaders = {
  authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
};
const jordanHeaders = {
  authorization: `Bearer ${issueLocalSession({ id: "customer-jordan" })}`,
};
const otherTenantHeaders = {
  authorization: `Bearer ${issueLocalSession({ id: "other-tenant-agent" })}`,
};

async function bindApprovalFixture(store: typeof caseStore, caseId: string) {
  const fingerprint = `fingerprint-${caseId}`;
  const current = await store.get(caseId);
  const turnId = current!.metadata.activeTurnId;
  if (typeof turnId !== "string")
    throw new Error("Expected the durable dispatch turn for approval binding.");
  await store.update(caseId, {
    metadata: {
      ...current!.metadata,
      refundCommand: {
        approvalCaseId: caseId,
        orderId: "ORD-1001",
        amount: 25,
        currency: "USD",
        reason: "duplicate charge",
        idempotencyKey: `refund-${caseId}`,
        fingerprint,
      },
      nativeApproval: {
        runId: `native-${caseId}`,
        toolCallId: `tool-${caseId}`,
        fingerprint,
        // The native approval must bind to the same durable dispatch turn.
        // A made-up legacy turn makes the route correctly fence the request
        // before the mocked resume can begin.
        turnId,
      },
    },
  });
  await store.saveAction(caseId, "refund-command", fingerprint, {
    approvalCaseId: caseId,
    orderId: "ORD-1001",
    amount: 25,
    currency: "USD",
    reason: "duplicate charge",
    idempotencyKey: `refund-${caseId}`,
    fingerprint,
  });
  return fingerprint;
}

function supportApp(mastra: unknown) {
  const app = new Hono();
  app.use("/support/*", async (c, next) => {
    const requestContext = new RequestContext();
    requestContext.setRaw("correlationId", c.req.header("x-correlation-id"));
    c.set("mastra", mastra as never);
    c.set("requestContext", requestContext);
    await next();
  });
  return app;
}

function approvalApp(mastra: unknown) {
  const app = supportApp(mastra);
  app.post("/support/cases/:caseId/approve", supportCaseApproveRoute.handler);
  app.post("/support/cases/:caseId/reject", supportCaseRejectRoute.handler);
  return app;
}

async function loadDeterministicRuntime() {
  const databasePath = temporaryDatabasePath("phase001-http-context");
  databaseFiles.push(
    databasePath,
    `${databasePath}-shm`,
    `${databasePath}-wal`,
  );
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.LOCAL_DEMO_DATABASE_URL = `file:${databasePath}`;
  process.env.SUPPORT_SOURCE = "mock";
  vi.resetModules();
  // The HTTP boundary exercises registered agents and workflows, but not the
  // evaluator product. Prevent the composition root from registering a judge
  // model that could make an unrelated provider request in the background.
  vi.doMock("../../src/mastra/evals", () => ({
    responseAgentScorers: {},
    triageAgentScorers: {},
    liveSupportScorerRegistry: {},
    liveResponseAgentScorers: {},
    liveTriageAgentScorers: {},
  }));
  vi.doMock("@mastra/core/llm", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@mastra/core/llm")>();
    return {
      ...actual,
      ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {},
    };
  });

  // index loads the provider registry through a circular workflow graph. Load
  // it before leaves so vi.resetModules cannot expose a partially initialized
  // local-runtime export to concurrent dynamic imports.
  const { mastra } = await import("../../src/mastra/index");
  const { closeSharedLocalSqliteClient } =
    await import("../../src/mastra/lib/sqlite-client");
  const { issueRefundTool } =
    await import("../../src/mastra/tools/issue-refund");
  const { lookupOrderTool } =
    await import("../../src/mastra/tools/lookup-order");
  const { responseAgent } =
    await import("../../src/mastra/agents/response-agent");
  const { searchSupportKnowledgeTool } =
    await import("../../src/mastra/tools/search-support-knowledge");
  const { triageAgent } = await import("../../src/mastra/agents/triage-agent");
  const { refundExecutionAgent } =
    await import("../../src/mastra/agents/refund-execution-agent");
  const routes = await import("../../src/mastra/server/routes");

  vi.spyOn(triageAgent, "generate").mockResolvedValue({
    object: {
      intent: "duplicate_charge",
      urgency: "normal",
      sentiment: "negative",
      requiresHumanReview: false,
      confidence: 1,
      rationale: "Deterministic HTTP context test.",
    },
    usage: { inputTokens: 1, outputTokens: 1 },
    response: { modelId: "deterministic/triage" },
  } as never);
  vi.spyOn(responseAgent, "generate").mockResolvedValue({
    object: {
      draftResponse: "A deterministic refund response.",
      citedSources: ["duplicate-charge-policy"],
      selectedPolicyExcerpts: [
        {
          source: "duplicate-charge-policy",
          excerpt:
            "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
        },
      ],
      recommendRefund: true,
      refundAmount: 49,
      refundCurrency: "USD",
      refundReason: "duplicate charge",
      requiresEscalation: false,
    },
    usage: { inputTokens: 1, outputTokens: 1 },
    response: { modelId: "deterministic/response" },
  } as never);
  // Keep the registered search implementation: the workflow must carry its
  // trusted read scope and decision-time authoritative provenance checks.
  // The spy still verifies RequestContext propagation below.
  vi.spyOn(searchSupportKnowledgeTool, "execute");
  vi.spyOn(issueRefundTool, "execute");
  let refundModel: DeterministicRefundModel | undefined;
  const executionModel = async () => {
    if (refundModel) return refundModel;
    const action = await (
      await import("../../src/mastra/lib/case-store")
    ).caseStore
      .getClient()
      .execute(
        "SELECT data FROM support_actions WHERE kind = 'refund-command' ORDER BY created_at DESC LIMIT 1",
      );
    const command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as {
      approvalCaseId: string;
      orderId: string;
      amount: { minor: number; currency: string };
      reason: string;
      idempotencyKey: string;
      fingerprint: string;
    };
    refundModel = deterministicRefundModel({
      caseId: command.approvalCaseId,
      orderId: command.orderId,
      amount: command.amount.minor / 100,
      currency: command.amount.currency,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    });
    return refundModel;
  };
  refundExecutionAgent.__updateModel({ model: executionModel });
  mastra
    .getAgent("refundExecutionAgent")
    .__updateModel({ model: executionModel });
  mastraRuntimes.push(mastra);
  closeSharedClients.push(closeSharedLocalSqliteClient);

  const app = supportApp(mastra);
  app.post("/support/inbound", routes.supportInboundRoute.handler);
  app.get("/support/cases/:caseId", routes.supportCaseDetailRoute.handler);
  app.post(
    "/support/cases/:caseId/approve",
    routes.supportCaseApproveRoute.handler,
  );
  app.post(
    "/support/cases/:caseId/reject",
    routes.supportCaseRejectRoute.handler,
  );
  app.post(
    "/support/cases/:caseId/follow-ups",
    routes.supportCaseFollowUpRoute.handler,
  );
  app.post(
    "/support/cases/:caseId/feedback",
    routes.supportCaseFeedbackRoute.handler,
  );
  app.post(
    "/support/cases/:caseId/supervisor",
    routes.supportCaseSupervisorRoute.handler,
  );
  return {
    app,
    mastra,
    caseStore: (await import("../../src/mastra/lib/case-store")).caseStore,
    issueRefundTool,
    lookupOrderTool,
    responseAgent,
    searchSupportKnowledgeTool,
    triageAgent,
  };
}

afterEach(async () => {
  await Promise.allSettled(
    mastraRuntimes.splice(0).map((runtime) => runtime.shutdown()),
  );
  await Promise.allSettled(
    closeSharedClients.splice(0).map((close) => close()),
  );
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.doUnmock("../../src/mastra/evals");
  vi.doUnmock("@mastra/core/llm");
  await Promise.all(
    databaseFiles.splice(0).map((file) => rm(file, { force: true })),
  );
});

describe("support approval HTTP boundary", () => {
  it.each([
    ["approve", undefined, false],
    ["approve", '{"commandFingerprint":"fingerprint","note":"ok"}', true],
    ["approve", "  \n", false],
    ["approve", "{not-json", false],
    ["reject", undefined, false],
    ["reject", '{"commandFingerprint":"fingerprint","note":"ok"}', true],
    ["reject", "  \n", false],
    ["reject", "{not-json", false],
  ])(
    "%s honors optional and malformed request bodies through Hono",
    async (action, body, shouldResume) => {
      const resume = vi.fn().mockResolvedValue({ status: "success" });
      const mastra = {
        getAgent: () => ({
          approveToolCallGenerate: vi.fn(),
          declineToolCallGenerate: vi.fn(),
        }),
        getWorkflow: () => ({
          createRun: async () => ({ resume }),
        }),
      };
      vi.spyOn(caseStore, "get").mockResolvedValue({
        id: "case-waiting",
        customer: { email: "alex@example.com" },
        status: "waiting_approval",
        workflowRunId: "run-waiting",
        metadata: {
          providerBinding: { tenantId: "local-demo" },
          refundCommand: { fingerprint: "fingerprint" },
          nativeApproval: {
            runId: "native-run",
            toolCallId: "native-call",
            fingerprint: "fingerprint",
            turnId: "turn-waiting",
          },
        },
      } as never);
      vi.spyOn(caseStore, "recordApprovalDecision").mockResolvedValue({
        won: true,
      });
      vi.spyOn(caseStore, "claimDispatchForResume").mockResolvedValue({
        id: "dispatch-waiting",
        caseId: "case-waiting",
        runId: "run-waiting",
        state: "claimed",
        attempts: 1,
        wasStarted: true,
        leaseToken: "lease-waiting",
      });
      vi.spyOn(caseStore, "update").mockResolvedValue({
        id: "case-waiting",
        status: "processing",
      } as never);
      vi.spyOn(caseStore, "renewDispatchLease").mockResolvedValue(true);
      vi.spyOn(caseStore, "completeDispatch").mockResolvedValue(true);
      const app = approvalApp(mastra);
      const response = await app.request(
        `http://support.test/support/cases/case-waiting/${action}`,
        {
          method: "POST",
          headers: approverHeaders,
          ...(body === undefined ? {} : { body }),
        },
      );

      expect(response.status).toBe(shouldResume ? 200 : 400);
      expect(resume).toHaveBeenCalledTimes(shouldResume ? 1 : 0);
      if (shouldResume) {
        expect(resume).toHaveBeenCalledWith(
          expect.objectContaining({
            requestContext: expect.any(RequestContext),
            resumeData: expect.objectContaining({
              approved: action === "approve",
              approverId: "approver-demo",
            }),
          }),
        );
      } else {
        await expect(response.json()).resolves.toEqual({
          error: "Invalid approval payload.",
        });
      }
    },
  );
});

describe("support workflow HTTP context propagation", () => {
  it("uses server acceptance time and denies fresh staff content on tombstones", async () => {
    const { app, caseStore: runtimeCaseStore } =
      await loadDeterministicRuntime();
    const conversationId = `retention-http-${crypto.randomUUID()}`;
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `retention-http-event-${crypto.randomUUID()}`,
        conversationId,
        from: "alex@example.com",
        subject: "future timestamp",
        body: "synthetic retention body",
        receivedAt: "2099-01-01T00:00:00.000Z",
      }),
    });
    expect(inbound.status).toBe(200);
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const client = runtimeCaseStore.getClient();
    const accepted = await client.execute({
      sql: "SELECT accepted_at FROM support_cases WHERE id = ?",
      args: [caseId],
    });
    expect(String(accepted.rows[0]?.accepted_at)).not.toBe(
      "2099-01-01T00:00:00.000Z",
    );
    await client.execute({
      sql: "UPDATE support_cases SET accepted_at = ? WHERE id = ?",
      args: ["2026-01-01T00:00:00.000Z", caseId],
    });
    await runtimeCaseStore.enforceRetention(
      () => new Date("2026-05-01T00:00:00.000Z"),
    );
    const feedback = await app.request(
      `http://support.test/support/cases/${caseId}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...supportAgentHeaders },
        body: JSON.stringify({ rating: "up", comment: "must not persist" }),
      },
    );
    expect(feedback.status).toBe(410);
    const staffInbound = await app.request(
      "http://support.test/support/inbound",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...supportAgentHeaders },
        body: JSON.stringify({
          externalId: `retention-http-late-${crypto.randomUUID()}`,
          conversationId,
          from: "alex@example.com",
          subject: "late",
          body: "must not persist",
        }),
      },
    );
    expect(staffInbound.status).toBe(410);
  });

  it("rejects cross-tenant and cross-owner inbound conversation mutation before dispatch", async () => {
    const { app, caseStore: runtimeCaseStore } =
      await loadDeterministicRuntime();
    const conversationId = `owner-scope-${crypto.randomUUID()}`;
    const alex = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `owner-scope-alex-${crypto.randomUUID()}`,
        conversationId,
        from: "alex@example.com",
        subject: "Alex request",
        body: "Please help with my duplicate charge.",
      }),
    });
    expect(alex.status).toBe(200);
    const alexBody = inboundSupportResponseSchema.parse(await alex.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(alexBody.caseId))?.status).toBe(
        "waiting_approval",
      ),
    );

    const crossOwner = await app.request(
      "http://support.test/support/inbound",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...jordanHeaders },
        body: JSON.stringify({
          externalId: `owner-scope-jordan-${crypto.randomUUID()}`,
          conversationId,
          from: "jordan@example.com",
          subject: "Jordan request",
          body: "Append this to Alex's conversation.",
        }),
      },
    );
    expect(crossOwner.status).toBe(403);

    const crossTenant = await app.request(
      "http://support.test/support/inbound",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...otherTenantHeaders,
        },
        body: JSON.stringify({
          externalId: `tenant-scope-${crypto.randomUUID()}`,
          from: "alex@example.com",
          subject: "Wrong tenant",
          body: "This must not allocate a run.",
        }),
      },
    );
    expect(crossTenant.status).toBe(403);
  });

  it("uses verified workflow scope for commerce reads and omits staff-only fields from the customer case DTO", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      lookupOrderTool,
    } = await loadDeterministicRuntime();
    await expect(
      lookupOrderTool.execute({ customerEmail: "alex@example.com" }),
    ).rejects.toThrow("verified workflow turn scope");

    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `customer-dto-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "DTO projection",
        body: "Please help with a duplicate charge.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const current = await runtimeCaseStore.get(caseId);
    const { withTrustedCommerceScope } =
      await import("../../src/mastra/lib/trusted-run-scope");
    await expect(
      withTrustedCommerceScope(
        { caseId, ownerId: "customer-alex", tenantId: "local-demo" },
        () => lookupOrderTool.execute({ orderId: "ORD-1002" }),
      ),
    ).resolves.toEqual({ found: false });
    await runtimeCaseStore.update(caseId, {
      escalationReason: "Internal staff-only reason",
      metadata: {
        ...current!.metadata,
        rawPayload: { secret: "must not leak" },
      },
    });
    const detail = await app.request(
      `http://support.test/support/cases/${caseId}`,
      { headers: customerHeaders },
    );
    expect(detail.status).toBe(200);
    const dto = (await detail.json()) as Record<string, unknown>;
    expect(dto).not.toHaveProperty("escalationReason");
    expect(dto.metadata).toEqual({});
  });

  it("renews the persisted approval dispatch lease while a real API resume is slow", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const caseId = `slow-resume-${crypto.randomUUID()}`;
    const runId = `slow-resume-run-${crypto.randomUUID()}`;
    const createdAt = "2026-09-05T00:00:00.000Z";
    await runtimeCaseStore.acceptInbound(
      {
        id: caseId,
        externalId: `event-${caseId}`,
        source: "mock-email",
        status: "new",
        customer: { email: "alex@example.com" },
        subject: "Slow approval",
        messages: [
          {
            id: `message-${caseId}`,
            author: "customer",
            body: "Please refund the duplicate charge.",
            createdAt,
          },
        ],
        createdAt,
        updatedAt: createdAt,
        metadata: {
          ownerId: "customer-alex",
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: `conversation-${caseId}`,
          },
        },
      },
      `event-${caseId}`,
      runId,
    );
    await runtimeCaseStore.update(caseId, {
      status: "waiting_approval",
      workflowRunId: runId,
    });
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'suspended', lease_until = NULL, lease_token = NULL WHERE case_id = ?",
      args: [caseId],
    });
    const fingerprint = await bindApprovalFixture(runtimeCaseStore, caseId);

    let resumeStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resumeStarted = resolve;
    });
    let release!: (result: { status: "success" }) => void;
    const slowResult = new Promise<{ status: "success" }>((resolve) => {
      release = resolve;
    });
    vi.spyOn(mastra, "getWorkflow").mockReturnValue({
      createRun: async () => ({
        resume: async () => {
          resumeStarted();
          return slowResult;
        },
      }),
    } as never);
    vi.spyOn(mastra, "getAgent").mockReturnValue({
      approveToolCallGenerate: async () => {
        resumeStarted();
        await slowResult;
        const executedAt = new Date().toISOString();
        await runtimeCaseStore.recordEffect(`refund-${caseId}`, fingerprint, {
          refundId: `refund-${caseId}`,
          orderId: "ORD-1001",
          amount: { currency: "USD", minor: 2500 },
          idempotencyKey: `refund-${caseId}`,
          executedAt,
          replayed: false,
        });
        await runtimeCaseStore.projectRefundToolExecution({
          caseId,
          turnId: (await runtimeCaseStore.get(caseId))!.metadata.nativeApproval!
            .turnId,
          fingerprint,
          idempotencyKey: `refund-${caseId}`,
          result: {
            refundId: `refund-${caseId}`,
            orderId: "ORD-1001",
            amount: 25,
            currency: "USD",
            status: "executed",
            idempotencyKey: `refund-${caseId}`,
            executedAt,
          },
        });
      },
      declineToolCallGenerate: async () => undefined,
    } as never);

    // Keep SQLite's retry backoff on real timers while driving only the
    // approval heartbeat interval deterministically.
    vi.useFakeTimers({ doNotFake: ["setTimeout", "nextTick", "setImmediate"] });
    try {
      const request = app.request(
        `http://support.test/support/cases/${caseId}/approve`,
        {
          method: "POST",
          headers: approverHeaders,
          body: JSON.stringify({ commandFingerprint: fingerprint }),
        },
      );
      await started;
      await vi.advanceTimersByTimeAsync(30_000);
      const lease = await runtimeCaseStore.getClient().execute({
        sql: "SELECT state, lease_until FROM support_dispatch WHERE case_id = ?",
        args: [caseId],
      });
      expect(lease.rows[0]).toMatchObject({ state: "claimed" });
      expect(Date.parse(String(lease.rows[0].lease_until))).toBeGreaterThan(
        Date.now(),
      );
      expect(await runtimeCaseStore.claimDispatch()).toEqual([]);
      release({ status: "success" });
      expect((await request).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a conflict without a stale failure projection when approval renewal loses ownership", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const caseId = `lost-resume-${crypto.randomUUID()}`;
    const runId = `lost-resume-run-${crypto.randomUUID()}`;
    const createdAt = "2026-09-05T00:00:00.000Z";
    await runtimeCaseStore.acceptInbound(
      {
        id: caseId,
        externalId: `event-${caseId}`,
        source: "mock-email",
        status: "new",
        customer: { email: "alex@example.com" },
        subject: "Lost approval lease",
        messages: [
          {
            id: `message-${caseId}`,
            author: "customer",
            body: "Please refund the duplicate charge.",
            createdAt,
          },
        ],
        createdAt,
        updatedAt: createdAt,
        metadata: {
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: `conversation-${caseId}`,
          },
        },
      },
      `event-${caseId}`,
      runId,
    );
    await runtimeCaseStore.update(caseId, {
      status: "waiting_approval",
      workflowRunId: runId,
    });
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'suspended', lease_until = NULL, lease_token = NULL WHERE case_id = ?",
      args: [caseId],
    });
    const fingerprint = await bindApprovalFixture(runtimeCaseStore, caseId);

    let resumeStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resumeStarted = resolve;
    });
    let release!: (result: { status: "success" }) => void;
    const slowResult = new Promise<{ status: "success" }>((resolve) => {
      release = resolve;
    });
    vi.spyOn(mastra, "getWorkflow").mockReturnValue({
      createRun: async () => ({
        resume: async () => {
          resumeStarted();
          return slowResult;
        },
      }),
    } as never);
    vi.spyOn(mastra, "getAgent").mockReturnValue({
      approveToolCallGenerate: async () => {
        resumeStarted();
        await slowResult;
        const executedAt = new Date().toISOString();
        await runtimeCaseStore.recordEffect(`refund-${caseId}`, fingerprint, {
          refundId: `refund-${caseId}`,
          orderId: "ORD-1001",
          amount: { currency: "USD", minor: 2500 },
          idempotencyKey: `refund-${caseId}`,
          executedAt,
          replayed: false,
        });
        await runtimeCaseStore.projectRefundToolExecution({
          caseId,
          turnId: (await runtimeCaseStore.get(caseId))!.metadata.nativeApproval!
            .turnId,
          fingerprint,
          idempotencyKey: `refund-${caseId}`,
          result: {
            refundId: `refund-${caseId}`,
            orderId: "ORD-1001",
            amount: 25,
            currency: "USD",
            status: "executed",
            idempotencyKey: `refund-${caseId}`,
            executedAt,
          },
        });
      },
      declineToolCallGenerate: async () => undefined,
    } as never);

    vi.useFakeTimers({ doNotFake: ["setTimeout", "nextTick", "setImmediate"] });
    try {
      const request = app.request(
        `http://support.test/support/cases/${caseId}/approve`,
        {
          method: "POST",
          headers: approverHeaders,
          body: JSON.stringify({ commandFingerprint: fingerprint }),
        },
      );
      await started;
      await runtimeCaseStore.getClient().execute({
        sql: "UPDATE support_dispatch SET lease_token = ? WHERE case_id = ?",
        args: ["current-owner", caseId],
      });
      await vi.advanceTimersByTimeAsync(10_000);
      release({ status: "success" });
      expect((await request).status).toBe(409);
      expect(
        (
          await runtimeCaseStore.getClient().execute({
            sql: "SELECT state, lease_token FROM support_dispatch WHERE case_id = ?",
            args: [caseId],
          })
        ).rows[0],
      ).toMatchObject({ state: "claimed", lease_token: "current-owner" });
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("processing");
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers a persisted pre-start Mastra run and then approves it through the real API", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const { recoverLocalWorkflows } =
      await import("../../src/mastra/runtime/local-runtime");
    const id = `recovered-${crypto.randomUUID()}`;
    const createdAt = "2026-09-05T00:00:00.000Z";
    const runId = crypto.randomUUID();
    await runtimeCaseStore.acceptInbound(
      {
        id,
        externalId: `event-${id}`,
        source: "mock-email",
        status: "new",
        customer: { email: "alex@example.com" },
        subject: "Recovered pre-start refund",
        messages: [
          {
            id: `message-${id}`,
            author: "customer",
            body: "Please refund the duplicate charge.",
            createdAt,
          },
        ],
        createdAt,
        updatedAt: createdAt,
        metadata: {
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: `conversation-${id}`,
          },
          ownerId: "customer-alex",
        },
      },
      `event-${id}`,
      runId,
    );
    await recoverLocalWorkflows(mastra, 10, runtimeCaseStore);
    await vi.waitFor(async () => {
      const recovered = await runtimeCaseStore.get(id);
      expect(recovered?.status).toBe("waiting_approval");
      expect(recovered?.workflowRunId).toEqual(expect.any(String));
    });
    const approved = await app.request(
      `http://support.test/support/cases/${id}/approve`,
      {
        method: "POST",
        headers: approverHeaders,
        body: JSON.stringify({
          commandFingerprint:
            (
              (await runtimeCaseStore.get(id))!.metadata as Record<
                string,
                unknown
              >
            ).refundCommand &&
            (
              (
                (await runtimeCaseStore.get(id))!.metadata as Record<
                  string,
                  unknown
                >
              ).refundCommand as { fingerprint: string }
            ).fingerprint,
        }),
      },
    );
    expect(approved.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(id))?.status).toBe("resolved"),
    );
    const recovered = (await runtimeCaseStore.get(id))!;
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body, state FROM support_outbox WHERE case_id = ?",
      args: [id],
    });
    expect(recovered.refundResult).toMatchObject({
      orderId: "ORD-1001",
      amount: 49,
      currency: "USD",
    });
    expect(recovered.finalResponse).toBe(
      "Your refund of 49 USD has been issued.",
    );
    expect(String(outbox.rows[0]?.body)).toBe(recovered.finalResponse);
    expect(outbox.rows[0]?.state).toBe("delivered");
  });

  it("passes the Hono RequestContext from inbound and approval requests to specialists and registered tools", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      issueRefundTool,
      mastra,
      responseAgent,
      searchSupportKnowledgeTool,
      triageAgent,
    } = await loadDeterministicRuntime();

    const inbound = await app.request("http://support.test/support/inbound", {
      body: JSON.stringify({
        externalId: `http-context-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "I was charged twice",
        body: "Please refund the duplicate subscription charge.",
      }),
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "inbound-correlation",
        ...customerHeaders,
      },
      method: "POST",
    });
    expect(inbound.status).toBe(200);
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());

    await vi.waitFor(async () => {
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      );
    });
    for (const requestContext of [
      vi.mocked(triageAgent.generate).mock.calls[0]?.[1]?.requestContext,
      vi.mocked(responseAgent.generate).mock.calls[0]?.[1]?.requestContext,
      vi.mocked(searchSupportKnowledgeTool.execute).mock.calls[0]?.[1]
        ?.requestContext,
    ]) {
      expect(requestContext).toBeInstanceOf(RequestContext);
      expect(requestContext?.getRaw("correlationId")).toBe(
        "inbound-correlation",
      );
    }
    expect(
      vi.mocked(searchSupportKnowledgeTool.execute).mock.calls[0]?.[1]
        ?.tracingContext,
    ).toBeDefined();
    const caseTraceId = (await runtimeCaseStore.get(caseId))?.traceId;
    expect(caseTraceId).toBeTruthy();
    await mastra.observability.flush();
    const observability = (await mastra
      .getStorage()
      ?.getStore("observability")) as {
      getTrace(args: { traceId: string }): Promise<{
        spans: Array<{ metadata?: Record<string, unknown> }>;
      } | null>;
    };
    const trace = await observability.getTrace({ traceId: caseTraceId! });
    const operationalNames = trace!.spans
      .filter(
        (span) =>
          span.metadata?.operationalKind === "tool" ||
          span.metadata?.operationalKind === "provider",
      )
      .map((span) => String(span.metadata?.operation));
    expect(operationalNames).toEqual(
      expect.arrayContaining([
        "tool.search_support_knowledge",
        "tool.lookup_order",
        "commerce.find_order",
      ]),
    );

    const approveNative = vi.spyOn(
      mastra.getAgent("refundExecutionAgent"),
      "approveToolCallGenerate",
    );

    const approved = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        headers: {
          "x-correlation-id": "approval-correlation",
          ...approverHeaders,
        },
        method: "POST",
        body: JSON.stringify({
          commandFingerprint: (
            (
              (await runtimeCaseStore.get(caseId))!.metadata as Record<
                string,
                unknown
              >
            ).refundCommand as { fingerprint: string }
          ).fingerprint,
        }),
      },
    );
    expect(approved.status).toBe(200);
    expect(
      publicSupportCaseSchema.safeParse(await approved.json()).success,
    ).toBe(true);
    expect(vi.mocked(issueRefundTool.execute)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requestContext: expect.any(RequestContext),
      }),
    );
    expect(
      vi
        .mocked(issueRefundTool.execute)
        .mock.calls[0]?.[1]?.requestContext?.getRaw("correlationId"),
    ).toBe("inbound-correlation");
    // Native Agent snapshots retain the context from the tool-call run. The
    // approval boundary still supplies the new Hono context to the official
    // resume API, where its authenticated decision is durably recorded.
    expect(
      approveNative.mock.calls[0]?.[0]?.requestContext?.getRaw("correlationId"),
    ).toBe("approval-correlation");
  });

  it("executes the registered supervisor through an authenticated case scope without mutating reachable domain state", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `supervisor-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Duplicate charge",
        body: "Please review order ORD-1001.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    let call = 0;
    mastra.getAgent("supportSupervisorAgent").__updateModel({
      model: {
        specificationVersion: "v2",
        provider: "phase004-test",
        modelId: "trusted-supervisor",
        supportedUrls: {},
        async doGenerate() {
          const tool = call++ === 0 ? "agent-triageAgent" : "lookup_order";
          return call <= 2
            ? {
                content: [
                  {
                    type: "tool-call" as const,
                    toolCallId: `supervisor-${call}`,
                    toolName: tool,
                    input: JSON.stringify(
                      tool === "lookup_order"
                        ? { orderId: "ORD-1001" }
                        : { prompt: "Classify this case." },
                    ),
                  },
                ],
                finishReason: "tool-calls" as const,
                usage: { inputTokens: 1, outputTokens: 1 },
                warnings: [],
              }
            : {
                content: [
                  {
                    type: "text" as const,
                    text: "I completed a read-only investigation; refund approval remains required.",
                  },
                ],
                finishReason: "stop" as const,
                usage: { inputTokens: 1, outputTokens: 1 },
                warnings: [],
              };
        },
        async doStream() {
          throw new Error("deterministic test model only supports generate");
        },
      } as never,
    });
    const client = runtimeCaseStore.getClient();
    const counts = async () =>
      client.execute(
        "SELECT (SELECT COUNT(*) FROM support_cases) cases, (SELECT COUNT(*) FROM support_actions) actions, (SELECT COUNT(*) FROM support_outbox) outbox, (SELECT COUNT(*) FROM local_orders) orders, (SELECT COUNT(*) FROM local_knowledge) knowledge, (SELECT COUNT(*) FROM support_knowledge_generations) generations",
      );
    const before = JSON.stringify((await counts()).rows[0]);
    const response = await app.request(
      `http://support.test/support/cases/${caseId}/supervisor`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...supportAgentHeaders },
        body: JSON.stringify({ message: "Inspect the order and classify it." }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      toolNames: ["agent-triageAgent", "lookup_order"],
    });
    expect(JSON.stringify((await counts()).rows[0])).toBe(before);
    const denied = await app.request(
      `http://support.test/support/cases/${caseId}/supervisor`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...otherTenantHeaders },
        body: JSON.stringify({ message: "Inspect it." }),
      },
    );
    expect(denied.status).toBe(403);
  });

  it("runs the registered supervisor's actual validation transport through the sandbox ledger", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `budgeted-supervisor-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Budgeted supervisor validation",
        body: "Please inspect my order.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const transport = vi.fn(async () => ({
      content: [
        {
          type: "text" as const,
          text: "I completed a read-only budgeted validation.",
        },
      ],
      finishReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    mastra.getAgent("supportSupervisorAgent").__updateModel({
      model: {
        specificationVersion: "v2",
        provider: "phase004-test",
        modelId: "budgeted-supervisor",
        supportedUrls: {},
        doGenerate: transport,
        async doStream() {
          throw new Error("deterministic validation only supports generate");
        },
      } as never,
    });
    const response = await app.request(
      `http://support.test/support/cases/${caseId}/supervisor`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...supportAgentHeaders },
        body: JSON.stringify({
          message: "Perform the validation.",
          validation: { mode: "sandbox" },
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      text: "I completed a read-only budgeted validation.",
    });
    expect(transport).toHaveBeenCalledTimes(1);

    const unpricedTransport = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "must not run" }],
      finishReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    mastra.getAgent("supportSupervisorAgent").__updateModel({
      model: {
        specificationVersion: "v2",
        provider: "unpriced-validation-provider",
        modelId: "unknown-price",
        supportedUrls: {},
        doGenerate: unpricedTransport,
        async doStream() {
          throw new Error("must not stream");
        },
      } as never,
    });
    const blocked = await app.request(
      `http://support.test/support/cases/${caseId}/supervisor`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...supportAgentHeaders },
        body: JSON.stringify({
          message: "Attempt an unpriced validation.",
          validation: { mode: "sandbox" },
        }),
      },
    );
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toMatchObject({
      error: expect.stringContaining("unknown model price"),
    });
    expect(unpricedTransport).not.toHaveBeenCalled();
  });

  it("replaces unsupported refund prose before finalization and outbox delivery", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      responseAgent,
    } = await loadDeterministicRuntime();
    vi.mocked(responseAgent.generate).mockResolvedValueOnce({
      object: {
        draftResponse: "Your refund has already been issued.",
        citedSources: [],
        recommendRefund: true,
        refundAmount: 49,
        refundCurrency: "USD",
        refundReason: "invented",
        requiresEscalation: false,
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      response: { modelId: "deterministic/unsafe" },
    } as never);
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `unsupported-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Refund request",
        body: "Refund me.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated"),
    );
    const supportCase = await runtimeCaseStore.get(caseId);
    if (!supportCase) throw new Error("Expected escalated support case.");
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    expect(supportCase?.finalResponse).toContain("specialist needs to review");
    expect(supportCase?.finalResponse).not.toContain("already been issued");
    expect(String(outbox.rows[0]?.body)).toBe(supportCase?.finalResponse);
    const metadata = supportCase!.metadata as Record<string, unknown>;
    expect(metadata.rejectedDraftForStaff).toMatchObject({
      draftResponse: "Your refund has already been issued.",
    });
  });

  it.each([
    "Your refund has already been issued.",
    "The reimbursement was completed and the funds are on their way.",
    "We processed the credit, so your card will be refunded.",
  ])(
    "never promotes a valid-citation, effectless financial completion claim: %s",
    async (draftResponse) => {
      const {
        app,
        caseStore: runtimeCaseStore,
        responseAgent,
      } = await loadDeterministicRuntime();
      vi.mocked(responseAgent.generate).mockResolvedValueOnce({
        object: {
          draftResponse,
          // The registered retrieval fixture exposes this active, applicable
          // policy title. Both model flags deliberately avoid approval.
          citedSources: ["Duplicate Charge Policy"],
          selectedPolicyExcerpts: [
            {
              source: "Duplicate Charge Policy",
              excerpt:
                "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.",
            },
          ],
          recommendRefund: false,
          requiresEscalation: false,
        },
        usage: { inputTokens: 1, outputTokens: 1 },
        response: { modelId: "deterministic/hostile-valid-citation" },
      } as never);
      const inbound = await app.request("http://support.test/support/inbound", {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          externalId: `valid-citation-hostile-${crypto.randomUUID()}`,
          from: "alex@example.com",
          subject: "Order status",
          body: "Please confirm my order status.",
        }),
      });
      const { caseId } = inboundSupportResponseSchema.parse(
        await inbound.json(),
      );
      await vi.waitFor(async () =>
        expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
      );
      const supportCase = await runtimeCaseStore.get(caseId);
      if (!supportCase) throw new Error("Expected resolved support case.");
      const outbox = await runtimeCaseStore.getClient().execute({
        sql: "SELECT body, state FROM support_outbox WHERE case_id = ?",
        args: [caseId],
      });
      const durable = await runtimeCaseStore.getClient().execute({
        sql: "SELECT (SELECT COUNT(*) FROM support_decisions WHERE case_id = ?) AS approvals, (SELECT COUNT(*) FROM support_idempotency) AS effects, (SELECT COUNT(*) FROM local_refunds) AS refunds",
        args: [caseId],
      });
      expect(supportCase.finalResponse).toBe(
        "The published Duplicate Charge Policy says: “Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.” Your order ORD-1001 is currently recorded as fulfilled. Your Pro Plan - Monthly subscription is currently recorded as active.",
      );
      expect(supportCase.finalResponse).not.toContain(draftResponse);
      expect(String(outbox.rows[0]?.body)).toBe(supportCase.finalResponse);
      expect(outbox.rows[0]?.state).toBe("delivered");
      expect(durable.rows[0]).toMatchObject({
        approvals: 0,
        effects: 0,
        refunds: 0,
      });
    },
  );

  it("renders an ordinary grounded order answer from durable order state", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      responseAgent,
    } = await loadDeterministicRuntime();
    vi.mocked(responseAgent.generate).mockResolvedValueOnce({
      object: {
        draftResponse: "Your order is fulfilled and no refund is needed.",
        citedSources: ["Duplicate Charge Policy"],
        selectedPolicyExcerpts: [
          {
            source: "Duplicate Charge Policy",
            excerpt:
              "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.",
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      response: { modelId: "deterministic/ordinary-order" },
    } as never);
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `ordinary-order-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Order status",
        body: "Where is my order?",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
    );
    const supportCase = (await runtimeCaseStore.get(caseId))!;
    expect(supportCase.finalResponse).toBe(
      "The published Duplicate Charge Policy says: “Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.” Your order ORD-1001 is currently recorded as fulfilled. Your Pro Plan - Monthly subscription is currently recorded as active.",
    );
  });

  it("renders completed refund status only after native approval creates its matching durable effect", async () => {
    const { app, caseStore: runtimeCaseStore } =
      await loadDeterministicRuntime();
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `completed-refund-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Refund request",
        body: "Please refund my duplicate charge.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const command = (await runtimeCaseStore.get(caseId))!.metadata
      .refundCommand as { fingerprint: string };
    const approved = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...approverHeaders },
        body: JSON.stringify({ commandFingerprint: command.fingerprint }),
      },
    );
    expect(approved.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
    );
    const supportCase = (await runtimeCaseStore.get(caseId))!;
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body, state FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    const effect = await runtimeCaseStore.idempotency(
      supportCase.refundResult!.idempotencyKey,
    );
    expect(effect?.fingerprint).toBe(command.fingerprint);
    expect(supportCase.finalResponse).toBe(
      "Your refund of 49 USD has been issued.",
    );
    expect(String(outbox.rows[0]?.body)).toBe(supportCase.finalResponse);
    expect(outbox.rows[0]?.state).toBe("delivered");
  });

  it("does not claim a completed refund when native approval is rejected without an effect", async () => {
    const { app, caseStore: runtimeCaseStore } =
      await loadDeterministicRuntime();
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `rejected-refund-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Refund request",
        body: "Please refund my duplicate charge.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const command = (await runtimeCaseStore.get(caseId))!.metadata
      .refundCommand as { fingerprint: string };
    const rejected = await app.request(
      `http://support.test/support/cases/${caseId}/reject`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...approverHeaders },
        body: JSON.stringify({ commandFingerprint: command.fingerprint }),
      },
    );
    expect(rejected.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated"),
    );
    const supportCase = (await runtimeCaseStore.get(caseId))!;
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body, state FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    const effects = await runtimeCaseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS count FROM support_idempotency",
    });
    expect(effects.rows[0]?.count).toBe(0);
    expect(supportCase.refundResult).toBeUndefined();
    expect(supportCase.finalResponse).toContain(
      "specialist is going to take a closer look",
    );
    expect(supportCase.finalResponse).not.toContain("has been issued");
    expect(String(outbox.rows[0]?.body)).toBe(supportCase.finalResponse);
    expect(outbox.rows[0]?.state).toBe("delivered");
  });

  it("never delivers an already-escalated uncited financial claim", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      responseAgent,
    } = await loadDeterministicRuntime();
    vi.mocked(responseAgent.generate).mockResolvedValueOnce({
      object: {
        draftResponse: "Your refund has already been issued.",
        citedSources: [],
        recommendRefund: false,
        requiresEscalation: true,
        escalationReason: "Please review this manually.",
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      response: { modelId: "deterministic/unsafe-escalation" },
    } as never);
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `uncited-escalation-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Refund request",
        body: "Refund me.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated"),
    );
    const supportCase = await runtimeCaseStore.get(caseId);
    if (!supportCase) throw new Error("Expected escalated support case.");
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    expect(supportCase.finalResponse).toContain("specialist needs to review");
    expect(supportCase.finalResponse).not.toContain("already been issued");
    expect(String(outbox.rows[0]?.body)).toBe(supportCase.finalResponse);
    expect(
      (supportCase.metadata as Record<string, unknown>).rejectedDraftForStaff,
    ).toMatchObject({ draftResponse: "Your refund has already been issued." });
  });

  it("replaces an expired-policy draft before finalization and outbox delivery", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      responseAgent,
    } = await loadDeterministicRuntime();
    const initial = new Date();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(initial);
    const expiresAt = new Date(initial.getTime() + 1_000).toISOString();
    const afterExpiry = new Date(initial.getTime() + 1_001);
    const { defaultLocalBinding, localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    await localRuntime.seed(defaultLocalBinding());
    // The workflow publishes this source row before it seals the candidate
    // generation. Advancing the deterministic clock later makes the sealed
    // authority expired without mutating its immutable document row.
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE local_knowledge SET expires_at = ? WHERE tenant_id = ? AND provider_account_id = ?",
      args: [expiresAt, "local-demo", "local-demo"],
    });
    vi.mocked(responseAgent.generate).mockImplementationOnce(async () => {
      // Retrieval has already persisted its policy matches. Advance past the
      // construction-time applicability window while generation is in flight
      // to exercise the decision-time publication recheck.
      vi.setSystemTime(afterExpiry);
      return {
        object: {
          draftResponse: "The duplicate-charge policy confirms your refund.",
          citedSources: ["duplicate-charge-policy"],
          recommendRefund: false,
          requiresEscalation: false,
        },
        usage: { inputTokens: 1, outputTokens: 1 },
        response: { modelId: "deterministic/expired-policy" },
      } as never;
    });
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `expired-policy-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Duplicate charge",
        body: "I was charged twice for order ORD-1001.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated"),
    );
    const supportCase = await runtimeCaseStore.get(caseId);
    if (!supportCase) throw new Error("Expected escalated support case.");
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT body FROM support_outbox WHERE case_id = ?",
      args: [caseId],
    });
    expect(supportCase.finalResponse).toContain("specialist needs to review");
    expect(supportCase.finalResponse).not.toContain("duplicate-charge policy");
    expect(String(outbox.rows[0]?.body)).toBe(supportCase.finalResponse);
    expect(
      (supportCase.metadata as Record<string, unknown>).rejectedDraftForStaff,
    ).toMatchObject({
      draftResponse: "The duplicate-charge policy confirms your refund.",
    });
  });

  it("authorizes delayed response feedback and retains two turn-bound ratings through export failure and reopen", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
    } = await loadDeterministicRuntime();
    const caseId = `feedback-history-${crypto.randomUUID()}`;
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: `feedback-history-conversation-${caseId}`,
    };
    const createdAt = new Date().toISOString();
    await runtimeCaseStore.acceptInbound(
      {
        id: caseId,
        externalId: `feedback-history-event-${caseId}`,
        source: "mock-email",
        customer: { email: "alex@example.com" },
        subject: "Feedback history",
        messages: [
          {
            id: `feedback-history-message-${caseId}`,
            author: "customer",
            body: "Please resolve this request.",
            createdAt,
          },
        ],
        status: "new",
        createdAt,
        updatedAt: createdAt,
        metadata: { ownerId: "customer-alex", providerBinding: binding },
      },
      `feedback-history-event-${caseId}`,
      "feedback-history-run-a",
    );
    const firstTurn = (await runtimeCaseStore.turns(caseId))[0]!;
    const current = await runtimeCaseStore.get(caseId);
    await runtimeCaseStore.update(caseId, {
      status: "resolved",
      metadata: { ...current!.metadata, activeTurnId: firstTurn.id },
    });
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_turns SET state = 'resolved', outcome_data = ? WHERE id = ? AND case_id = ?",
      args: [
        JSON.stringify({
          status: "resolved",
          finalResponse: "Original synthetic final response.",
          telemetry: { traceId: "feedback-trace-a" },
        }),
        firstTurn.id,
        caseId,
      ],
    });
    const second = await runtimeCaseStore.appendFollowUp({
      caseId,
      eventId: `feedback-history-follow-up-${caseId}`,
      runId: "feedback-history-run-b",
      expectedOwnerId: "customer-alex",
      message: {
        id: `feedback-history-follow-up-message-${caseId}`,
        author: "customer",
        body: "A second completed response.",
        createdAt: new Date().toISOString(),
      },
    });
    const secondTurn = await runtimeCaseStore.turn(caseId, second.turnId!);
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_turns SET state = 'resolved', outcome_data = ? WHERE id = ? AND case_id = ?",
      args: [
        JSON.stringify({
          status: "resolved",
          finalResponse: "Follow-up synthetic final response.",
          telemetry: { traceId: "feedback-trace-b" },
        }),
        secondTurn!.id,
        caseId,
      ],
    });
    vi.spyOn(mastra.observability, "addFeedback").mockRejectedValue(
      new Error("synthetic observability export failure"),
    );

    const delayed = await app.request(
      `http://support.test/support/cases/${caseId}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          rating: "up",
          comment: "This was for the original response.",
          responseMessageId: `msg_${caseId}_${firstTurn.id}_final`,
        }),
      },
    );
    expect(delayed.status).toBe(200);
    const currentTurn = await app.request(
      `http://support.test/support/cases/${caseId}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          rating: "down",
          comment: "This was for the new response.",
          responseMessageId: `msg_${caseId}_${secondTurn!.id}_final`,
        }),
      },
    );
    expect(currentTurn.status).toBe(200);
    expect(vi.mocked(mastra.observability.addFeedback)).toHaveBeenCalledTimes(
      2,
    );
    expect(await runtimeCaseStore.feedback([caseId])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feedback: expect.objectContaining({
            turnId: firstTurn.id,
            runId: "feedback-history-run-a",
            traceId: "feedback-trace-a",
          }),
        }),
        expect.objectContaining({
          feedback: expect.objectContaining({
            turnId: secondTurn!.id,
            runId: "feedback-history-run-b",
            traceId: "feedback-trace-b",
          }),
        }),
      ]),
    );
    const { CaseStore } = await import("../../src/mastra/lib/case-store");
    const reopened = new CaseStore({ url: process.env.DATABASE_URL! });
    expect(await reopened.feedback([caseId])).toHaveLength(2);
    await reopened.close();
  });

  it("accepts feedback for actual approved and non-refund follow-up completions after dispatch completion", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
      responseAgent,
    } = await loadDeterministicRuntime();
    const inbound = await app.request("http://support.test/support/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...customerHeaders },
      body: JSON.stringify({
        externalId: `feedback-real-${crypto.randomUUID()}`,
        conversationId: `feedback-real-conversation-${crypto.randomUUID()}`,
        from: "alex@example.com",
        subject: "Actual completed feedback",
        body: "Please refund my duplicate charge.",
      }),
    });
    const { caseId } = inboundSupportResponseSchema.parse(await inbound.json());
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe(
        "waiting_approval",
      ),
    );
    const firstTurn = (await runtimeCaseStore.turns(caseId))[0]!;
    const command = (await runtimeCaseStore.get(caseId))!.metadata
      .refundCommand as { fingerprint: string };
    const approved = await app.request(
      `http://support.test/support/cases/${caseId}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...approverHeaders },
        body: JSON.stringify({ commandFingerprint: command.fingerprint }),
      },
    );
    expect(approved.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
    );
    expect(await runtimeCaseStore.turn(caseId, firstTurn.id)).toMatchObject({
      state: "resolved",
      outcome: { finalResponse: expect.any(String) },
    });
    const firstOutcome = (await runtimeCaseStore.turn(caseId, firstTurn.id))!
      .outcome!;
    const firstTraceId = (firstOutcome.telemetry as { traceId?: string })
      ?.traceId;
    expect(firstTraceId).toEqual(expect.any(String));
    const firstOutboxId = `outbox_${caseId}_${firstTurn.id}_final`;
    // Leave the first finalized reply pending, then process a real follow-up.
    // The replayed worker attempt below must remain attached to this trace,
    // rather than the mutable trace on the second active turn.
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_outbox SET state = 'pending', receipt = NULL, lease_until = NULL, lease_token = NULL WHERE id = ?",
      args: [firstOutboxId],
    });
    const observability = (await mastra
      .getStorage()
      ?.getStore("observability")) as {
      getTrace(args: { traceId: string }): Promise<{
        spans: Array<{ metadata?: Record<string, unknown> }>;
      } | null>;
    };
    const deliveryCount = async (traceId: string) =>
      (await observability.getTrace({ traceId }))?.spans.filter(
        (span) => span.metadata?.operation === "support.deliver",
      ).length ?? 0;
    await mastra.observability.flush();
    const firstBeforeFollowUp = await deliveryCount(firstTraceId!);
    // Simulate an upgraded Phase 003 projection. It must be migrated before
    // the later turn's feedback overwrites the current-case projection.
    await runtimeCaseStore.update(caseId, {
      feedback: {
        rating: "up",
        submittedAt: "2026-09-05T00:00:00.000Z",
        actorId: "customer-alex",
        turnId: firstTurn.id,
        runId: firstTurn.runId,
        traceId: (firstOutcome.telemetry as { traceId?: string })?.traceId,
      },
    });
    responseAgent.generate.mockResolvedValueOnce({
      object: {
        draftResponse: "Your order is fulfilled and no refund is needed.",
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
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      response: { modelId: "deterministic/follow-up" },
    } as never);
    const followUp = await app.request(
      `http://support.test/support/cases/${caseId}/follow-ups`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({ body: "What is the current order status?" }),
      },
    );
    expect(followUp.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
    );
    const turns = await runtimeCaseStore.turns(caseId);
    const secondTurn = turns.at(-1)!;
    expect(secondTurn.id).not.toBe(firstTurn.id);
    expect(secondTurn).toMatchObject({
      state: "resolved",
      outcome: {
        finalResponse:
          "The published Duplicate Charge Policy says: “Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.” Your order ORD-1001 is currently recorded as fulfilled. Your Pro Plan - Monthly subscription is currently recorded as active.",
      },
    });
    const secondTraceId = (await runtimeCaseStore.get(caseId))?.traceId;
    expect(secondTraceId).toEqual(expect.any(String));
    expect(secondTraceId).not.toBe(firstTraceId);
    const outbox = await runtimeCaseStore.getClient().execute({
      sql: "SELECT originating_turn_id, originating_run_id, originating_trace_id, correlation_state FROM support_outbox WHERE id = ?",
      args: [firstOutboxId],
    });
    expect(outbox.rows[0]).toMatchObject({
      originating_turn_id: firstTurn.id,
      originating_run_id: firstTurn.runId,
      originating_trace_id: firstTraceId,
      correlation_state: "known",
    });
    await mastra.observability.flush();
    // The follow-up's background sweep retried the pending turn-one reply.
    // Its provider span stays on turn one; turn two contains only its own
    // final delivery, despite now owning the case's current trace.
    expect(await deliveryCount(firstTraceId!)).toBe(firstBeforeFollowUp + 1);
    expect(await deliveryCount(secondTraceId!)).toBe(1);
    // Submit the later-turn rating first: this is the migration boundary that
    // previously hid the original feedback on the same case.
    for (const [turn, rating] of [
      [secondTurn, "down"],
      [firstTurn, "up"],
    ] as const) {
      const response = await app.request(
        `http://support.test/support/cases/${caseId}/feedback`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...customerHeaders },
          body: JSON.stringify({
            rating,
            responseMessageId: `msg_${caseId}_${turn.id}_final`,
          }),
        },
      );
      expect(response.status).toBe(200);
    }
    const exactDuplicate = await app.request(
      `http://support.test/support/cases/${caseId}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          rating: "down",
          responseMessageId: `msg_${caseId}_${secondTurn.id}_final`,
        }),
      },
    );
    expect(exactDuplicate.status).toBe(200);
    const durableFeedback = await runtimeCaseStore.feedback([caseId]);
    expect(durableFeedback).toHaveLength(2);
    expect(durableFeedback.map((entry) => entry.feedback.turnId)).toEqual(
      expect.arrayContaining([firstTurn.id, secondTurn.id]),
    );
    const { CaseStore } = await import("../../src/mastra/lib/case-store");
    const reopened = new CaseStore({ url: process.env.DATABASE_URL! });
    expect(await reopened.feedback([caseId])).toHaveLength(2);
    await reopened.close();
  }, 20_000);

  it("durably retries then escalates injected inbound and follow-up provider failures without restarting failed runs", async () => {
    const {
      app,
      caseStore: runtimeCaseStore,
      mastra,
      responseAgent,
    } = await loadDeterministicRuntime();
    const { recoverLocalWorkflows } =
      await import("../../src/mastra/runtime/local-runtime");
    responseAgent.generate.mockRejectedValueOnce(
      new Error("injected inbound response provider failure"),
    );
    const failedInbound = await app.request(
      "http://support.test/support/inbound",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          externalId: `failure-inbound-${crypto.randomUUID()}`,
          from: "alex@example.com",
          subject: "Injected inbound failure",
          body: "Please inspect this order.",
        }),
      },
    );
    const { caseId: inboundCaseId } = inboundSupportResponseSchema.parse(
      await failedInbound.json(),
    );
    await vi.waitFor(async () =>
      expect(
        (
          await runtimeCaseStore.getClient().execute({
            sql: "SELECT state FROM support_dispatch WHERE case_id = ?",
            args: [inboundCaseId],
          })
        ).rows[0],
      ).toMatchObject({ state: "pending" }),
    );
    await recoverLocalWorkflows(mastra, 10, runtimeCaseStore);
    expect((await runtimeCaseStore.get(inboundCaseId))?.status).toBe(
      "escalated",
    );

    responseAgent.generate.mockResolvedValue({
      object: {
        draftResponse: "Your order is fulfilled.",
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
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      response: { modelId: "deterministic/nonrefund" },
    } as never);
    const healthyInbound = await app.request(
      "http://support.test/support/inbound",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({
          externalId: `failure-follow-up-${crypto.randomUUID()}`,
          from: "alex@example.com",
          subject: "Healthy initial turn",
          body: "Where is my order?",
        }),
      },
    );
    const { caseId } = inboundSupportResponseSchema.parse(
      await healthyInbound.json(),
    );
    await vi.waitFor(async () =>
      expect((await runtimeCaseStore.get(caseId))?.status).toBe("resolved"),
    );
    responseAgent.generate.mockRejectedValueOnce(
      new Error("injected follow-up response provider failure"),
    );
    const failedFollowUp = await app.request(
      `http://support.test/support/cases/${caseId}/follow-ups`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...customerHeaders },
        body: JSON.stringify({ body: "Please check again." }),
      },
    );
    expect(failedFollowUp.status).toBe(500);
    const dispatch = await runtimeCaseStore.getClient().execute({
      sql: "SELECT state FROM support_dispatch WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [caseId],
    });
    expect(dispatch.rows[0]).toMatchObject({ state: "pending" });
    await recoverLocalWorkflows(mastra, 10, runtimeCaseStore);
    expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated");
  }, 20_000);

  it("projects an exhausted dispatch lease to a durable escalation", async () => {
    const { caseStore: runtimeCaseStore } = await loadDeterministicRuntime();
    const caseId = `exhausted-dispatch-${crypto.randomUUID()}`;
    await runtimeCaseStore.acceptInbound(
      {
        id: caseId,
        externalId: `${caseId}-event`,
        source: "mock-email",
        customer: { email: "alex@example.com" },
        subject: "Exhausted dispatch",
        messages: [
          {
            id: `${caseId}-message`,
            author: "customer",
            body: "Please recover this exhausted dispatch.",
            createdAt: new Date().toISOString(),
          },
        ],
        status: "processing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          ownerId: "customer-alex",
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: caseId,
          },
        },
      },
      `${caseId}-event`,
      `${caseId}-run`,
    );
    await runtimeCaseStore.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'claimed', attempts = 3, lease_until = ? WHERE case_id = ?",
      args: ["2000-01-01T00:00:00.000Z", caseId],
    });
    expect(await runtimeCaseStore.claimDispatch()).toEqual([]);
    expect((await runtimeCaseStore.get(caseId))?.status).toBe("escalated");
    expect((await runtimeCaseStore.turns(caseId))[0]).toMatchObject({
      state: "escalated",
      outcome: { operationalFailure: { disposition: "escalate" } },
    });
  });
});
