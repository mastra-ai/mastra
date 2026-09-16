import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  budgetedLanguageModel,
  createValidationBudgetExecution,
} from "../../src/mastra/lib/eval-budget";
import {
  evaluateDatasetAssertions as evaluateAssertionSemantics,
  scorerInputFromObservation,
  trajectoryAuthorityForDatasetCase,
  truthForDatasetCase,
} from "./support/deterministic-semantics.js";
import { deterministicJsonModel } from "../fixtures/deterministic-language-model";

type DatasetCase = {
  id: string;
  critical: boolean;
  input: string;
  assertions: Record<string, unknown>;
};
type Dataset = { axis: string; cases: DatasetCase[] };
type AssertionObservation = {
  triage?: Record<string, unknown>;
  draft?: Record<string, unknown>;
  calls?: ObservedCall[];
  workflow?: Record<string, unknown>;
  authorization?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  historyEstablished?: boolean;
  refundEffects?: Record<string, unknown>;
  order?: unknown;
  turns?: Array<{ turn: number; answer: string }>;
};
type ObservedCall = {
  sequence: number;
  turn: number;
  name: string;
  input: Record<string, unknown>;
  result: unknown;
};
type Result = {
  id: string;
  axis: string;
  critical: boolean;
  score: number;
  evidence: Record<string, unknown>;
};
const results: Result[] = [];
const datasets: Dataset[] = [];
const ciEvaluationBudget = createValidationBudgetExecution("ci-eval");
const budgetedDeterministicModel = (model: LanguageModelV2) =>
  budgetedLanguageModel(model, ciEvaluationBudget);
const scorerMapping = JSON.parse(
  await readFile(
    new URL("../../evals/scorer-mapping.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { registryKey: string; scorerId: string }>;
const binding = (id: string, tenantId = "local-demo") => ({
  tenantId,
  providerKind: "local" as const,
  providerAccountId: `phase004-account-${id}`,
  externalConversationId: id,
});

const evaluationBinding = (caseId: string) => ({
  tenantId: "local-demo",
  providerKind: "local" as const,
  providerAccountId: `phase004-eval-authority-${caseId}`,
  externalConversationId: `phase004-eval-conversation-${caseId}`,
});
const expectedKnowledgeText = `# Duplicate Charge Policy

Duplicate charges happen when a payment retries due to a network error, or when a customer accidentally submits an order twice.

- If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**. The original charge is never refunded as part of a duplicate-charge claim.
- Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.
- Duplicate-charge refunds do not require the customer to return anything, since no extra product/service was fulfilled.
- These refunds are considered clear-cut and eligible for standard approval (not automatic execution - a human must still approve every refund).`;
const expectedKnowledgeEvidenceForCase = (caseId: string) => {
  const { measurementAt: _measurementAt, ...authority } =
    trajectoryAuthorityForDatasetCase(caseId);
  return {
    document: expectedKnowledgeText,
    score: 1,
    metadata: {
      title: "Duplicate Charge Policy",
      source: "duplicate-charge-policy",
      text: expectedKnowledgeText,
      version: "local-v1",
      documentHash: createHash("sha256")
        .update(
          JSON.stringify([
            "duplicate-charge-policy",
            "local-v1",
            expectedKnowledgeText,
          ]),
        )
        .digest("hex"),
      ...authority,
      providerKind: "local",
      providerAccountId: `phase004-eval-authority-${caseId}`,
    },
  };
};
const expectedKnowledgeEvidence = expectedKnowledgeEvidenceForCase(
  "registered-scorer-fixture",
);

function completeObservedCalls(caseId = "registered-scorer-fixture") {
  const trustedBinding = evaluationBinding(caseId);
  const search = (sequence: number, turn: number) => ({
    sequence,
    turn,
    name: "search_support_knowledge",
    input: {
      binding: trustedBinding,
      queryText: "duplicate charge policy",
      topK: 1,
    },
    result: {
      sources: [structuredClone(expectedKnowledgeEvidenceForCase(caseId))],
    },
  });
  const lookup = (sequence: number, turn: number) => ({
    sequence,
    turn,
    name: "lookup_order",
    input: {
      binding: trustedBinding,
      customerEmail: "alex@example.com",
      orderId: "ORD-1001",
    },
    result: {
      found: true,
      order: {
        orderId: "ORD-1001",
        customerEmail: "alex@example.com",
        product: "Pro Plan - Monthly",
        amount: 49,
        currency: "USD",
        status: "fulfilled",
        chargeCount: 2,
        placedAt: "2026-08-01T14:00:00.000Z",
      },
    },
  });
  return [search(1, 1), lookup(2, 1), search(3, 2), lookup(4, 2)];
}

async function pinDeterministicKnowledgeFixture(
  configured: ReturnType<typeof evaluationBinding>,
  authorityId: string,
) {
  const { caseStore } = await import("../../src/mastra/lib/case-store");
  const { publishKnowledge } =
    await import("../../src/mastra/lib/publish-knowledge");
  const authority = trajectoryAuthorityForDatasetCase(authorityId);
  const client = caseStore.getClient();
  await client.execute({
    sql: "UPDATE local_knowledge SET expires_at = ? WHERE tenant_id = ? AND provider_account_id = ? AND source = ?",
    args: [
      authority.expiresAt ?? null,
      configured.tenantId,
      configured.providerAccountId,
      "duplicate-charge-policy",
    ],
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(authority.indexedAt));
  const randomUUID = vi
    .spyOn(crypto, "randomUUID")
    .mockReturnValue(authority.generationId.slice("knowledge_".length));
  try {
    const candidate = await publishKnowledge(configured, {
      onlyIfMissing: true,
    });
    expect(candidate.generationId).toBe(authority.generationId);
  } finally {
    randomUUID.mockRestore();
    vi.useRealTimers();
  }
}

function completeObservedTurns() {
  return [
    {
      turn: 1,
      answer:
        "Order ORD-1001 is fulfilled; the duplicate-charge policy requires review before any refund.",
    },
    {
      turn: 2,
      answer:
        "Order ORD-1001 remains fulfilled; the earlier duplicate-charge review is unchanged.",
    },
  ];
}

function responseModel(options: {
  firstAnswer: string;
  citation: string;
  binding: ReturnType<typeof binding>;
  requiresEscalation?: boolean;
  recommendRefund?: boolean;
  followUpContradiction?: boolean;
}): LanguageModelV2 {
  let iteration = 0;
  return {
    specificationVersion: "v2",
    provider: "phase004-test",
    modelId: "observed-response-trajectory",
    supportedUrls: {},
    async doGenerate(request) {
      iteration += 1;
      if (iteration === 1)
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "observed-search",
              toolName: "search_support_knowledge",
              input: JSON.stringify({
                binding: options.binding,
                queryText: "duplicate charge policy",
                topK: 1,
              }),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      if (iteration === 2)
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "observed-order",
              toolName: "lookup_order",
              input: JSON.stringify({
                binding: options.binding,
                customerEmail: "alex@example.com",
                orderId: "ORD-1001",
              }),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      const receivedPrompt = JSON.stringify(request.prompt);
      const historyEstablished = receivedPrompt.includes(options.firstAnswer);
      const answer = historyEstablished
        ? options.followUpContradiction
          ? "Order ORD-1001 was cancelled."
          : "Order ORD-1001 remains fulfilled; the earlier duplicate-charge review is unchanged."
        : options.firstAnswer;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              draftResponse: answer,
              citedSources: [options.citation],
              recommendRefund: options.recommendRefund ?? false,
              requiresEscalation: options.requiresEscalation ?? false,
            }),
          },
        ],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("The deterministic evaluator only supports generate.");
    },
  };
}

async function createCase(input: string, authorityId?: string) {
  const { caseStore } = await import("../../src/mastra/lib/case-store");
  const id = `phase004-eval-${randomUUID()}`;
  // The scenario authority is fixed independently of random case IDs and
  // observed tool calls, so a same-tenant account/conversation switch cannot
  // be normalized into a passing trajectory.
  const configured = authorityId ? evaluationBinding(authorityId) : binding(id);
  const now = new Date().toISOString();
  await caseStore.acceptInbound(
    {
      id,
      externalId: `${id}-event`,
      source: "mock-email",
      status: "new",
      subject: "Support evaluation",
      customer: { email: "alex@example.com" },
      messages: [
        {
          id: `${id}-message`,
          author: "customer",
          body: input,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      metadata: { ownerId: "customer-alex", providerBinding: configured },
    },
    `${id}-event`,
    `${id}-run`,
  );
  return { id, configured };
}

/** Runs registered agents/tools. Calls are captured by wrapping their actual execution boundary. */
async function observedReadTrajectory(
  input: string,
  options: {
    authorityId?: string;
    includeMemory?: boolean;
    followUpContradiction?: boolean;
  } = {},
) {
  const { mastra } = await import("../../src/mastra/index");
  const { ensureProviderFixtures } =
    await import("../../src/mastra/providers/registry");
  const { registerProviderRegistry } =
    await import("../../src/mastra/providers/registry");
  const { localRuntime } =
    await import("../../src/mastra/runtime/local-runtime");
  const { withTrustedCaseReadScope } =
    await import("../../src/mastra/lib/trusted-run-scope");
  const { triageResultSchema, draftResolutionSchema } =
    await import("../../src/mastra/domain/support-case");
  const { id, configured } = await createCase(input, options.authorityId);
  registerProviderRegistry(localRuntime, [configured]);
  await ensureProviderFixtures(configured);
  if (options.authorityId)
    await pinDeterministicKnowledgeFixture(configured, options.authorityId);
  else {
    const { publishKnowledge } =
      await import("../../src/mastra/lib/publish-knowledge");
    await publishKnowledge(configured, { onlyIfMissing: true });
  }
  const search = mastra.getTool("searchSupportKnowledgeTool");
  const lookup = mastra.getTool("lookupOrderTool");
  const calls: ObservedCall[] = [];
  let observedTurn = 0;
  const observe = (name: string, tool: typeof search) => {
    const original = tool.execute!.bind(tool);
    return vi
      .spyOn(tool, "execute")
      .mockImplementation(async (raw, context) => {
        const result = await original(raw, context);
        calls.push({
          sequence: calls.length + 1,
          turn: observedTurn,
          name,
          input: raw as Record<string, unknown>,
          result,
        });
        return result;
      });
  };
  const searchSpy = observe("search_support_knowledge", search);
  const lookupSpy = observe("lookup_order", lookup as typeof search);
  try {
    const triage = mastra.getAgent("triageAgent");
    triage.__updateModel({
      model: deterministicJsonModel({
        intent: input.includes("charged") ? "duplicate_charge" : "other",
        urgency: "normal",
        sentiment: "neutral",
        requiresHumanReview:
          input.includes("ignore") || input.includes("refund"),
        confidence: 1,
        rationale: "Observed deterministic classification.",
      }) as never,
    });
    const triageResult = await triage.generate(
      [{ role: "user", content: input }],
      {
        structuredOutput: { schema: triageResultSchema },
        model: budgetedLanguageModel(
          (await triage.getModel()) as never,
          ciEvaluationBudget,
        ),
      },
    );
    const response = mastra.getAgent("responseAgent");
    const thread = `phase004-eval-thread-${id}`;
    const resource = "local-demo:customer-alex";
    const firstAnswer =
      "Order ORD-1001 is fulfilled; the duplicate-charge policy requires review before any refund.";
    const runTurn = async (
      message: string,
      includeMemory: boolean,
      turn: number,
    ) => {
      observedTurn = turn;
      const model = responseModel({
        firstAnswer,
        citation: "Duplicate Charge Policy",
        binding: configured,
        followUpContradiction: options.followUpContradiction,
      });
      response.__updateModel({ model: model as never });
      return withTrustedCaseReadScope(
        { caseId: id, ownerId: "customer-alex", tenantId: configured.tenantId },
        () =>
          response.generate([{ role: "user", content: message }], {
            structuredOutput: { schema: draftResolutionSchema },
            memory: includeMemory ? { thread, resource } : undefined,
            model: budgetedLanguageModel(model as never, ciEvaluationBudget),
          }),
      );
    };
    const first = await runTurn(input, true, 1);
    const second = await runTurn(
      "Please confirm the earlier order status.",
      options.includeMemory ?? true,
      2,
    );
    const order = calls.find((call) => call.name === "lookup_order")?.result;
    const sources = calls.find(
      (call) => call.name === "search_support_knowledge",
    )?.result as { sources?: Array<{ metadata: { title: string } }> };
    return {
      caseId: id,
      binding: configured,
      triage: triageResult.object!,
      draft: first.object!,
      answers: [first.object!.draftResponse, second.object!.draftResponse],
      turns: [
        { turn: 1, answer: first.object!.draftResponse },
        { turn: 2, answer: second.object!.draftResponse },
      ],
      historyEstablished:
        second.object!.draftResponse.includes("remains fulfilled"),
      calls,
      order,
      sources: sources?.sources ?? [],
    };
  } finally {
    searchSpy.mockRestore();
    lookupSpy.mockRestore();
  }
}

async function workflowGuardEvidence(evidenceKind: "invalid" | "expired") {
  return (async () => {
    const { mastra } = await import("../../src/mastra/index");
    const { caseStore } = await import("../../src/mastra/lib/case-store");
    const { publishKnowledge } =
      await import("../../src/mastra/lib/publish-knowledge");
    const { registerProviderRegistry } =
      await import("../../src/mastra/providers/registry");
    const { localRuntime } =
      await import("../../src/mastra/runtime/local-runtime");
    const { id, configured } = await createCase(
      `refund ${evidenceKind} evidence policy`,
    );
    registerProviderRegistry(localRuntime, [configured]);
    await localRuntime.seed(configured);
    const expiresAt =
      evidenceKind === "expired"
        ? new Date(Date.now() + 60_000).toISOString()
        : undefined;
    if (evidenceKind === "expired")
      await caseStore.getClient().execute({
        sql: "UPDATE local_knowledge SET expires_at = ? WHERE tenant_id = ? AND provider_account_id = ? AND source = ?",
        args: [
          expiresAt,
          configured.tenantId,
          configured.providerAccountId,
          "duplicate-charge-policy",
        ],
      });
    await publishKnowledge(configured, { onlyIfMissing: true });
    if (expiresAt) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.parse(expiresAt) + 1));
    }
    try {
      const [turn] = await caseStore.turns(id);
      if (!turn) throw new Error("Expected immutable workflow turn.");
      mastra.getAgent("responseAgent").__updateModel({
        model: budgetedDeterministicModel(
          deterministicJsonModel({
            draftResponse: "Your refund has already been issued.",
            citedSources: evidenceKind === "invalid" ? ["Invented policy"] : [],
            recommendRefund: true,
            refundAmount: 49,
            refundCurrency: "USD",
            refundReason: "forged",
            requiresEscalation: false,
          }),
        ) as never,
      });
      await caseStore.update(id, {
        workflowRunId: `phase004-workflow-${id}`,
        metadata: {
          ...((await caseStore.get(id))!.metadata as Record<string, unknown>),
          activeTurnId: turn.id,
        },
      });
      await (
        await mastra
          .getWorkflow("resolveSupportCaseWorkflow")
          .createRun({ runId: `phase004-workflow-${id}`, disableScorers: true })
      ).start({ inputData: { caseId: id, turnId: turn.id } });
      const persisted = await caseStore.get(id);
      const outbox = await caseStore.getClient().execute({
        sql: "SELECT body FROM support_outbox WHERE case_id = ?",
        args: [id],
      });
      const outboxBodies = outbox.rows.map((row) => row.body);
      return {
        guarded:
          persisted?.status === "escalated" &&
          persisted?.finalResponse ===
            "Thanks for your patience. A support specialist needs to review the available information and will follow up shortly." &&
          outboxBodies.length === 1 &&
          outboxBodies[0] === persisted.finalResponse,
        status: persisted?.status,
        finalResponse: persisted?.finalResponse,
        outboxBodies,
        draft: persisted?.draft,
        order: persisted?.orderLookup,
        evidenceKind,
        policyMatchCount: persisted?.policyMatches?.length ?? 0,
      };
    } finally {
      if (expiresAt) vi.useRealTimers();
    }
  })();
}

async function observedFinancialEvidence(
  scenario:
    | "approval-required"
    | "unapproved-financial-denied"
    | "tampered-approved-command-denied"
    | "approved-replay-concurrency",
) {
  return (async () => {
    const { mastra } = await import("../../src/mastra/index");
    const { caseStore } = await import("../../src/mastra/lib/case-store");
    const { registerProviderRegistry } =
      await import("../../src/mastra/providers/registry");
    const { localRuntime, recoverApprovedNativeDecisions } =
      await import("../../src/mastra/runtime/local-runtime");
    const { id, configured } = await createCase(
      "Please refund the duplicate charge.",
    );
    registerProviderRegistry(localRuntime, [configured]);
    await localRuntime.seed(configured);
    mastra.getAgent("triageAgent").__updateModel({
      model: budgetedDeterministicModel(
        deterministicJsonModel({
          intent: "refund_request",
          urgency: "normal",
          sentiment: "neutral",
          requiresHumanReview: false,
          confidence: 1,
          rationale: "Observed refund request.",
        }),
      ) as never,
    });
    mastra.getAgent("responseAgent").__updateModel({
      model: budgetedDeterministicModel(
        deterministicJsonModel({
          draftResponse: "The duplicate charge can be reviewed for a refund.",
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
        }),
      ) as never,
    });
    let command: Record<string, unknown> = {};
    const approvedRefundModel = async () => {
      const current = await caseStore.get(id);
      if (!current)
        throw new Error("Financial workflow case was not persisted.");
      const activeTurnId = (current.metadata as Record<string, unknown>)
        .activeTurnId;
      const action = await caseStore.getClient().execute({
        sql: "SELECT action.data FROM support_actions AS action JOIN support_turns AS turn ON turn.case_id = action.case_id AND turn.command_fingerprint = action.fingerprint WHERE action.case_id = ? AND action.kind = 'refund-command' AND turn.id = ? LIMIT 1",
        args: [id, activeTurnId],
      });
      command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as Record<
        string,
        unknown
      >;
      const toolInput = {
        caseId: command.approvalCaseId,
        orderId: command.orderId,
        amount: 49,
        currency: "USD",
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
        fingerprint: command.fingerprint,
      };
      return budgetedDeterministicModel({
        specificationVersion: "v2",
        provider: "phase004-test",
        modelId: "approved-native-refund",
        supportedUrls: {},
        async doGenerate(options) {
          if (options.tools?.some((tool) => tool.type === "function"))
            return {
              content: [
                {
                  type: "tool-call" as const,
                  toolCallId: "phase004-approved-refund",
                  toolName: "issue_refund",
                  input: JSON.stringify(toolInput),
                },
              ],
              finishReason: "tool-calls" as const,
              usage: { inputTokens: 1, outputTokens: 1 },
              warnings: [],
            };
          return {
            content: [{ type: "text" as const, text: "completed" }],
            finishReason: "stop" as const,
            usage: { inputTokens: 1, outputTokens: 1 },
            warnings: [],
          };
        },
        async doStream() {
          throw new Error(
            "The deterministic evaluator only supports generate.",
          );
        },
      } as LanguageModelV2);
    };
    mastra.getAgent("refundExecutionAgent").__updateModel({
      model: approvedRefundModel,
    });
    const workflowRunId = `${id}-run`;
    const dispatch = await caseStore.claimDispatchForStart(id, workflowRunId);
    if (!dispatch) throw new Error("Expected financial workflow dispatch.");
    await caseStore.markDispatchStarted(dispatch.id, dispatch.leaseToken);
    await caseStore.update(id, {
      workflowRunId,
      metadata: {
        ...((await caseStore.get(id))!.metadata as Record<string, unknown>),
        activeTurnId: dispatch.turnId,
      },
    });
    const started = await (
      await mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .createRun({ runId: workflowRunId, disableScorers: true })
    ).start({ inputData: { caseId: id, turnId: dispatch.turnId } });
    await caseStore.completeDispatch(
      dispatch.id,
      started.status === "suspended" ? "suspended" : "completed",
      undefined,
      dispatch.leaseToken,
    );
    const waiting = await caseStore.get(id);
    if (!waiting)
      throw new Error("Financial workflow case disappeared before approval.");
    const native = (waiting.metadata as Record<string, unknown>)
      .nativeApproval as {
      runId: string;
      toolCallId: string;
      fingerprint: string;
      turnId: string;
    };
    if (!native)
      throw new Error(
        `Financial workflow did not suspend: ${JSON.stringify({ status: waiting?.status, draft: waiting?.draft, started })}`,
      );
    if (
      !native.runId ||
      !native.toolCallId ||
      !native.fingerprint ||
      !native.turnId
    )
      throw new Error(
        `Financial workflow native approval binding is incomplete: ${JSON.stringify(native)}`,
      );
    command = (await caseStore.getAction(
      id,
      "refund-command",
      native.fingerprint,
    )) as Record<string, unknown>;
    const input = {
      caseId: id,
      orderId: command.orderId,
      amount: 49,
      currency: "USD",
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    };
    let unapprovedError = "";
    try {
      await mastra.getTool("issueRefundTool").execute!(input, { mastra });
    } catch (error) {
      unapprovedError = String(error);
    }
    const approvalRequired =
      Boolean(native.runId) &&
      Boolean(native.toolCallId) &&
      Boolean(native.fingerprint) &&
      Boolean(native.turnId);
    let approvalRecordedBeforeTamper = false;
    let tamperedError = "";
    let effectsBeforeRecovery = 0;
    let recoveries: number[] = [];
    if (scenario !== "unapproved-financial-denied") {
      await caseStore.recordApprovalDecision({
        caseId: id,
        turnId: native.turnId,
        commandFingerprint: native.fingerprint,
        principalId: "approver-demo",
        approved: true,
        nativeRunId: native.runId,
        nativeToolCallId: native.toolCallId,
      });
      approvalRecordedBeforeTamper = true;
      if (scenario === "tampered-approved-command-denied") {
        try {
          await localRuntime.issueRefund({
            ...(command as never),
            fingerprint: "tampered",
          });
        } catch (error) {
          tamperedError = String(error);
        }
        effectsBeforeRecovery = (
          await localRuntime.refunds(configured, "ORD-1001")
        ).length;
      }
      if (scenario !== "approval-required")
        recoveries = await Promise.all([
          recoverApprovedNativeDecisions(mastra, caseStore, {
            disableScorers: true,
          }),
          recoverApprovedNativeDecisions(mastra, caseStore, {
            disableScorers: true,
          }),
        ]);
    }
    const refunds = await localRuntime.refunds(configured, "ORD-1001");
    const durableActions = await caseStore.getClient().execute({
      sql: "SELECT COUNT(*) AS count FROM support_actions WHERE case_id = ? AND kind IN ('refund-failure', 'refund-uncertain', 'refund-command')",
      args: [id],
    });
    return {
      scenario,
      approvalRequired,
      unapprovedDenied:
        /persisted approved|current durable workflow dispatch/i.test(
          unapprovedError,
        ),
      unapprovedError,
      approvalRecordedBeforeTamper,
      tamperedDenied: /fingerprint was tampered/i.test(tamperedError),
      tamperedError,
      effectsBeforeRecovery,
      approvedReplayCount: refunds.length,
      providerEffects: refunds.length,
      durableActions: Number(durableActions.rows[0]?.count ?? 0),
      originalCommandReplayIntegrity:
        refunds.length === 1 &&
        refunds[0]?.reason === command.reason &&
        refunds[0]?.orderId === command.orderId,
      concurrentRecoveries: recoveries.length,
      recoveryResults: recoveries,
    };
  })();
}

async function foreignBindingEvidence(
  trajectory: Awaited<ReturnType<typeof observedReadTrajectory>>,
) {
  const { mastra } = await import("../../src/mastra/index");
  const { publishKnowledge } =
    await import("../../src/mastra/lib/publish-knowledge");
  const { ensureProviderFixtures } =
    await import("../../src/mastra/providers/registry");
  const { registerProviderRegistry } =
    await import("../../src/mastra/providers/registry");
  const { localRuntime } =
    await import("../../src/mastra/runtime/local-runtime");
  const { withTrustedCaseReadScope } =
    await import("../../src/mastra/lib/trusted-run-scope");
  const foreign = binding(`foreign-${randomUUID()}`, "other-tenant");
  registerProviderRegistry(localRuntime, [foreign]);
  await ensureProviderFixtures(foreign);
  await publishKnowledge(foreign, { onlyIfMissing: true });
  let error = "";
  try {
    await withTrustedCaseReadScope(
      {
        caseId: trajectory.caseId,
        ownerId: "customer-alex",
        tenantId: "local-demo",
      },
      () =>
        mastra.getTool("searchSupportKnowledgeTool").execute!(
          { queryText: "duplicate charge policy", topK: 1, binding: foreign },
          { mastra },
        ),
    );
  } catch (value) {
    error = String(value);
  }
  return {
    foreignBindingDenied:
      /does not match the durable case|does not match the trusted case/i.test(
        error,
      ),
    error,
    twoRegisteredBindings: true,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Every dataset assertion is executable; an undeclared assertion is a test failure. */
function evaluateDatasetAssertions(
  assertions: Record<string, unknown>,
  observed: AssertionObservation,
  evaluationCaseId?: string,
) {
  const evaluated = evaluateAssertionSemantics(
    assertions,
    observed as Record<string, unknown>,
    evaluationCaseId,
  );
  for (const [name, actual] of Object.entries(evaluated))
    expect(actual, `dataset assertion ${name}`).toBe(true);
  return evaluated;
}

async function caseRefundEffects(
  caseId: string,
  configured: ReturnType<typeof binding>,
) {
  const { caseStore } = await import("../../src/mastra/lib/case-store");
  const { localRuntime } =
    await import("../../src/mastra/runtime/local-runtime");
  const actions = await caseStore.getClient().execute({
    sql: "SELECT COUNT(*) AS count FROM support_actions WHERE case_id = ? AND kind IN ('refund-command', 'refund-failure', 'refund-uncertain')",
    args: [caseId],
  });
  return {
    providerEffects: (await localRuntime.refunds(configured, "ORD-1001"))
      .length,
    durableActions: Number(actions.rows[0]?.count ?? 0),
  };
}

function truth(
  axis: string,
  item: DatasetCase,
  _evidence: AssertionObservation,
) {
  return truthForDatasetCase(axis, item.assertions, item.id);
}

describe("Phase 004 deterministic native evaluation", () => {
  it("records six registered scorer measurements from native tools, two turns, workflow guards, and financial recovery", async () => {
    expect(process.env.SUPPORT_KNOWLEDGE_RETRIEVAL).not.toBe("vector");
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    const directory = new URL("../../evals/datasets/", import.meta.url);
    for (const file of (await readdir(directory))
      .filter((entry) => entry.endsWith(".json"))
      .sort())
      datasets.push(
        JSON.parse(await readFile(new URL(file, directory), "utf8")) as Dataset,
      );
    const { supportEvalScorerRegistry } =
      await import("./support/dataset-scorers");
    for (const dataset of datasets)
      for (const item of dataset.cases) {
        const read = await observedReadTrajectory(item.input, {
          authorityId: item.id,
        });
        const observed: AssertionObservation = {
          triage: read.triage,
          draft: read.draft,
          calls: read.calls,
          order: read.order,
          historyEstablished: read.historyEstablished,
          refundEffects: await caseRefundEffects(read.caseId, read.binding),
        };
        if (
          item.id === "unsupported-policy" ||
          item.id === "workflow-guard-mutation" ||
          item.id === "evidence-required" ||
          item.id === "insufficient-evidence"
        ) {
          const evidenceKind =
            item.id === "unsupported-policy" ||
            item.id === "workflow-guard-mutation"
              ? "invalid"
              : item.id === "evidence-required"
                ? "expired"
                : "expired";
          const workflow = await workflowGuardEvidence(evidenceKind);
          observed.workflow = workflow;
          observed.draft = asRecord(workflow.draft);
          observed.order = workflow.order;
        }
        if (item.id === "cross-tenant-denied")
          observed.authorization = await foreignBindingEvidence(read);
        if (dataset.axis === "policy-compliance" && !observed.workflow)
          observed.financial = await observedFinancialEvidence(
            item.id as Parameters<typeof observedFinancialEvidence>[0],
          );
        const assertionResults = evaluateDatasetAssertions(
          item.assertions,
          observed,
          item.id,
        );
        const output = scorerInputFromObservation(dataset.axis, {
          ...observed,
          answers: read.answers,
          turns: read.turns,
        });
        const scorer =
          supportEvalScorerRegistry[
            scorerMapping[dataset.axis]?.registryKey ?? ""
          ];
        if (!scorer)
          throw new Error(
            `Dataset axis has no declared registered scorer: ${dataset.axis}`,
          );
        expect(scorer.id).toBe(scorerMapping[dataset.axis]?.scorerId);
        const scored = await scorer.run({
          output,
          groundTruth: truth(dataset.axis, item, observed),
        });
        expect(scored.score, `${dataset.axis}/${item.id}`).toBe(1);
        // Preserve the native boundary's complete raw result. Replay must be
        // able to independently validate the document text, hash, provenance,
        // applicability, and generation rather than trusting a compact claim.
        const toolCalls =
          dataset.axis === "tool-call-correctness" ||
          dataset.axis === "multi-turn-consistency"
            ? (observed.calls ?? []).map((call) => ({
                sequence: call.sequence,
                turn: call.turn,
                name: call.name,
                input: call.input,
                result: call.result,
                rawResultHash: createHash("sha256")
                  .update(JSON.stringify(call.result))
                  .digest("hex"),
              }))
            : [];
        const axisEvidence =
          dataset.axis === "routing-accuracy"
            ? { modelOutputs: { triage: observed.triage } }
            : dataset.axis === "groundedness"
              ? {
                  modelOutputs: { draft: observed.draft },
                  order: observed.order,
                  sources: read.sources.map((source) => ({
                    title: source.metadata.title,
                  })),
                  workflow: observed.workflow,
                }
              : dataset.axis === "tool-call-correctness"
                ? {
                    order: observed.order,
                    refundEffects: observed.refundEffects,
                  }
                : dataset.axis === "multi-turn-consistency"
                  ? {
                      modelOutputs: {
                        answers: read.answers,
                        turns: read.turns,
                      },
                      order: observed.order,
                      toolCalls,
                      historyEstablished: observed.historyEstablished,
                      authorization: observed.authorization,
                    }
                  : dataset.axis === "policy-compliance"
                    ? {
                        modelOutputs: { draft: observed.draft },
                        financial: observed.financial,
                        workflow: observed.workflow,
                      }
                    : {
                        modelOutputs: { draft: observed.draft },
                        order: observed.order,
                        workflow: observed.workflow,
                      };
        results.push({
          id: item.id,
          axis: dataset.axis,
          critical: item.critical,
          score: scored.score,
          evidence: {
            schemaVersion: 1,
            // Dataset identity is the authoritative scenario correlation;
            // the runtime case UUID is deliberately not report authority.
            caseId: item.id,
            scorerId: scorer.id,
            score: scored.score,
            assertions: assertionResults,
            modelOutputs: {},
            toolCalls,
            ...axisEvidence,
          },
        });
      }
  }, 180_000);

  it("makes registered scorers reject mutated observed arguments, results, and answers", async () => {
    const { supportEvalScorerRegistry } =
      await import("./support/dataset-scorers");
    const toolTruth = truthForDatasetCase("tool-call-correctness", {
      readOnlyToolsFirst: true,
    });
    const multiTurnTruth = truthForDatasetCase("multi-turn-consistency", {
      sameThread: true,
    });
    const scoreTool = (
      calls: ReturnType<typeof completeObservedCalls>,
      groundTruth = toolTruth,
    ) =>
      supportEvalScorerRegistry.toolCallCorrectness.run({
        output: {
          toolCalls: calls,
          refundEffects: { providerEffects: 0, durableActions: 0 },
        },
        groundTruth,
      });
    const scoreTurns = (turns: ReturnType<typeof completeObservedTurns>) =>
      supportEvalScorerRegistry.multiTurnConsistency.run({
        output: {
          turns,
          toolCalls: completeObservedCalls(),
          historyEstablished: true,
        },
        groundTruth: multiTurnTruth,
      });
    const scoreTrajectory = (
      calls: ReturnType<typeof completeObservedCalls>,
      groundTruth = multiTurnTruth,
    ) =>
      supportEvalScorerRegistry.multiTurnConsistency.run({
        output: {
          turns: completeObservedTurns(),
          toolCalls: calls,
          historyEstablished: true,
        },
        groundTruth,
      });
    const factualResponse =
      "Order ORD-1001 is fulfilled; the duplicate-charge policy requires review before any refund.";
    const scoreResolution = (draftResponse: string) =>
      supportEvalScorerRegistry.resolutionQuality.run({
        output: {
          draftResponse,
          order: completeObservedCalls()[1].result,
          requiresEscalation: false,
        },
        groundTruth: truthForDatasetCase("resolution-quality", {
          customerFacing: true,
        }),
      });
    const scoreGroundedness = (draftResponse: string) =>
      supportEvalScorerRegistry.groundedness.run({
        output: {
          draftResponse,
          citedSources: ["Duplicate Charge Policy"],
          order: completeObservedCalls()[1].result,
        },
        groundTruth: truthForDatasetCase("groundedness", {
          requiresCitation: true,
        }),
      });
    const escalationResponse =
      "Thanks for your patience. A support specialist needs to review the available information and will follow up shortly.";
    const scoreEscalation = (
      axis: "groundedness" | "policy-compliance" | "resolution-quality",
      output: Record<string, unknown>,
    ) => {
      const scorer =
        axis === "groundedness"
          ? supportEvalScorerRegistry.groundedness
          : axis === "policy-compliance"
            ? supportEvalScorerRegistry.policyCompliance
            : supportEvalScorerRegistry.resolutionQuality;
      return scorer.run({
        output,
        groundTruth: truthForDatasetCase(axis, { requiresEscalation: true }),
      });
    };
    const safeEscalationOutput = () => ({
      draftResponse: escalationResponse,
      citedSources: [],
      recommendRefund: false,
      requiresEscalation: true,
      workflow: {
        guarded: true,
        status: "escalated",
        finalResponse: escalationResponse,
        outboxBodies: [escalationResponse],
      },
    });
    await expect(scoreTool(completeObservedCalls())).resolves.toMatchObject({
      score: 1,
    });
    await expect(scoreTurns(completeObservedTurns())).resolves.toMatchObject({
      score: 1,
    });
    await expect(scoreResolution(factualResponse)).resolves.toMatchObject({
      score: 1,
    });
    await expect(scoreGroundedness(factualResponse)).resolves.toMatchObject({
      score: 1,
    });
    for (const axis of [
      "groundedness",
      "policy-compliance",
      "resolution-quality",
    ] as const) {
      await expect(
        scoreEscalation(axis, safeEscalationOutput()),
      ).resolves.toMatchObject({
        score: 1,
      });
      for (const mutate of [
        (output: ReturnType<typeof safeEscalationOutput>) => {
          delete (output as { draftResponse?: unknown }).draftResponse;
        },
        (output: ReturnType<typeof safeEscalationOutput>) => {
          (output as { draftResponse: unknown }).draftResponse = {
            unknown: true,
          };
        },
        (output: ReturnType<typeof safeEscalationOutput>) => {
          output.draftResponse =
            "Your refund was issued. No support review is needed.";
        },
        (output: ReturnType<typeof safeEscalationOutput>) => {
          output.workflow.finalResponse = `${escalationResponse} Extra claim.`;
        },
        (output: ReturnType<typeof safeEscalationOutput>) => {
          output.workflow.outboxBodies = [
            "Your refund was issued. No support review is needed.",
          ];
        },
      ]) {
        const output = safeEscalationOutput();
        mutate(output);
        await expect(scoreEscalation(axis, output)).resolves.toMatchObject({
          score: 0,
        });
      }
    }
    const rejectedToolMutations = [
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[2].input.queryText = "foreign policy";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[0].input.binding = { tenantId: "foreign" };
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[1].input.binding.providerAccountId = "wrong-account";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[2].input.binding.providerAccountId = "wrong-account";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[3].input.binding.providerAccountId = "wrong-account";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[2].input.untrusted = "extra";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[2].result as {
            sources: Array<{ metadata: { documentHash: string } }>;
          }
        ).sources[0].metadata.documentHash = "0".repeat(64);
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[3].input.customerEmail = "mallory@example.com";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[3].input.orderId = "ORD-9999";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[3].result as { order: { customerEmail: string } }
        ).order.customerEmail = "mallory@example.com";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (calls[3].result as { order: { status: string } }).order.status =
          "cancelled";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[2].result = { sources: [{}] } as never;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[2].result as { sources: Array<Record<string, unknown>> }
        ).sources.push(structuredClone(expectedKnowledgeEvidence));
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[2].result as { sources: Array<Record<string, unknown>> }
        ).sources.push({
          title: "Foreign policy",
          source: "foreign-policy",
          documentHash: "a".repeat(64),
        });
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[2].result as { sources: Array<Record<string, unknown>> }
        ).sources[0] = {};
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (
          calls[2].result as { sources: Array<Record<string, unknown>> }
        ).sources[0].untrusted = "extra";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        delete (calls[3] as { result?: unknown }).result;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls.pop();
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls.push(structuredClone(calls[0]));
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        calls[2] = structuredClone(calls[0]);
      },
    ];
    for (const mutate of rejectedToolMutations) {
      const calls = completeObservedCalls();
      mutate(calls);
      await expect(scoreTool(calls)).resolves.toMatchObject({ score: 0 });
      await expect(scoreTrajectory(calls)).resolves.toMatchObject({ score: 0 });
    }
    const source = (calls: ReturnType<typeof completeObservedCalls>) =>
      (
        calls[2].result as {
          sources: Array<{
            document: string;
            metadata: Record<string, unknown>;
          }>;
        }
      ).sources[0];
    const exactAuthoritySwitch = (
      calls: ReturnType<typeof completeObservedCalls>,
      index: 2 | 3,
    ) => {
      calls[index].input.binding = {
        tenantId: "local-demo",
        providerKind: "local",
        providerAccountId:
          "phase004-eval-authority-registered-scorer-fixture-foreign",
        externalConversationId:
          "phase004-eval-conversation-registered-scorer-fixture-foreign",
      };
    };
    const completeEvidenceMutations = [
      (calls: ReturnType<typeof completeObservedCalls>) =>
        exactAuthoritySwitch(calls, 2),
      (calls: ReturnType<typeof completeObservedCalls>) =>
        exactAuthoritySwitch(calls, 3),
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).document = "Refunds are unconditional.";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.text = "Refunds are unconditional.";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).document = "Attacker-controlled replacement.";
        source(calls).metadata.text = source(calls).document;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        const entry = source(calls);
        entry.document = "Attacker-controlled replacement.";
        entry.metadata.text = entry.document;
        entry.metadata.documentHash = createHash("sha256")
          .update(
            JSON.stringify([
              "duplicate-charge-policy",
              "local-v1",
              entry.document,
            ]),
          )
          .digest("hex");
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.version = "invented-v99";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.effectiveAt = "not-a-date";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.indexedAt = "2026-01-01T00:00:00Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.expiresAt = "2026-01-01T00:00:00.000Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.providerAccountId = "foreign-account";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        const documentHash = source(calls).metadata.documentHash;
        calls[2].result = {
          sources: [
            {
              title: "Duplicate Charge Policy",
              source: "duplicate-charge-policy",
              documentHash,
            },
          ],
        };
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        delete source(calls).metadata.version;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        source(calls).metadata.untrusted = true;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        (calls[2].result as { sources: unknown[] }).sources.push(
          structuredClone(source(calls)),
        );
      },
    ];
    for (const [index, mutate] of completeEvidenceMutations.entries()) {
      const calls = completeObservedCalls();
      mutate(calls);
      await expect(
        scoreTool(calls),
        `tool mutation ${index}`,
      ).resolves.toMatchObject({
        score: 0,
      });
      await expect(
        scoreTrajectory(calls),
        `trajectory mutation ${index}`,
      ).resolves.toMatchObject({ score: 0 });
    }
    const sourceAt = (
      calls: ReturnType<typeof completeObservedCalls>,
      index: 0 | 2,
    ) =>
      (
        calls[index].result as {
          sources: Array<{ metadata: Record<string, unknown> }>;
        }
      ).sources[0].metadata;
    const orderAt = (
      calls: ReturnType<typeof completeObservedCalls>,
      index: 1 | 3,
    ) => (calls[index].result as { order: Record<string, unknown> }).order;
    const rejectTrajectoryIntegrity = (
      mutate: (calls: ReturnType<typeof completeObservedCalls>) => void,
    ) => {
      const calls = completeObservedCalls();
      mutate(calls);
      return Promise.all([
        expect(scoreTool(calls)).resolves.toMatchObject({ score: 0 }),
        expect(scoreTrajectory(calls)).resolves.toMatchObject({ score: 0 }),
      ]);
    };
    // The registered scorers own their fixture authority and reject a
    // replayer changing one observation or coordinating both observations.
    for (const mutate of [
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 0).expiresAt = "2026-01-01T00:00:01.000Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 0).expiresAt = "2026-01-01T00:00:00.500Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 2).expiresAt = "2026-01-01T00:00:03.000Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 0).expiresAt = "2026-01-01T00:00:03.000Z";
        sourceAt(calls, 2).expiresAt = "2026-01-01T00:00:04.000Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 2).indexedAt = "2026-01-01T00:00:01.500Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 0).indexedAt = "2026-01-01T00:00:03.000Z";
        sourceAt(calls, 2).indexedAt = "2026-01-01T00:00:03.000Z";
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        sourceAt(calls, 0).generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
        sourceAt(calls, 2).generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
      },
    ])
      await rejectTrajectoryIntegrity(mutate);
    for (const [key, value] of [
      ["amount", 1],
      ["currency", "BTC"],
      ["product", "Tampered Plan"],
      ["chargeCount", 0],
      ["placedAt", "2026-08-02T14:00:00.000Z"],
    ] as const) {
      await rejectTrajectoryIntegrity((calls) => {
        orderAt(calls, 3)[key] = value;
      });
      await rejectTrajectoryIntegrity((calls) => {
        orderAt(calls, 1)[key] = value;
        orderAt(calls, 3)[key] = value;
      });
    }
    for (const mutate of [
      (calls: ReturnType<typeof completeObservedCalls>) => {
        delete orderAt(calls, 3).amount;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        orderAt(calls, 3).untrusted = true;
      },
      (calls: ReturnType<typeof completeObservedCalls>) => {
        delete (calls[3].result as { found?: unknown }).found;
      },
    ])
      await rejectTrajectoryIntegrity(mutate);
    const futureExpiryId = "registered-scorer-fixture-future-expiry";
    const futureExpiryCalls = completeObservedCalls(futureExpiryId);
    const futureToolTruth = truthForDatasetCase(
      "tool-call-correctness",
      { readOnlyToolsFirst: true },
      futureExpiryId,
    );
    const futureMultiTurnTruth = truthForDatasetCase(
      "multi-turn-consistency",
      { sameThread: true },
      futureExpiryId,
    );
    await expect(
      scoreTool(futureExpiryCalls, futureToolTruth),
    ).resolves.toMatchObject({
      score: 1,
    });
    await expect(
      scoreTrajectory(futureExpiryCalls, futureMultiTurnTruth),
    ).resolves.toMatchObject({ score: 1 });
    const contradictoryResponses = [
      "Order ORD-1001 is fulfilled, but it was cancelled.",
      "Order ORD-1001 is fulfilled, but it is unfulfilled.",
      "Order ORD-1001 is fulfilled, but it is not fulfilled.",
      "Order ORD-1001 is fulfilled, but it is no longer fulfilled.",
      "Order ORD-1001 is fulfilled, but not fulfilled.",
      "Order ORD-1001 is fulfilled; actually its status is pending.",
      "It is false that Order ORD-1001 is fulfilled.",
      "Order ORD-1001 is fulfilled; it has never been fulfilled.",
      `Please note: ${factualResponse}`,
      `${factualResponse} Please contact support for more details.`,
    ];
    for (const contradiction of contradictoryResponses) {
      const turns = completeObservedTurns();
      turns[1].answer = contradiction;
      await expect(scoreTurns(turns)).resolves.toMatchObject({ score: 0 });
      await expect(scoreResolution(contradiction)).resolves.toMatchObject({
        score: 0,
      });
      await expect(scoreGroundedness(contradiction)).resolves.toMatchObject({
        score: 0,
      });
      expect(
        evaluateAssertionSemantics(
          { customerFacing: true },
          {
            draft: { draftResponse: contradiction },
            order: completeObservedCalls()[1].result,
          },
        ),
      ).toEqual({ customerFacing: false });
    }
    for (const mutate of [
      (turns: ReturnType<typeof completeObservedTurns>) => {
        turns.pop();
      },
      (turns: ReturnType<typeof completeObservedTurns>) => {
        turns[1].turn = 1;
      },
      (turns: ReturnType<typeof completeObservedTurns>) => {
        turns.push(structuredClone(turns[0]));
      },
    ]) {
      const turns = completeObservedTurns();
      mutate(turns);
      await expect(scoreTurns(turns)).resolves.toMatchObject({ score: 0 });
    }
    await expect(
      supportEvalScorerRegistry.toolCallCorrectness.run({
        output: {
          toolCalls: [
            {
              name: "lookup_order",
              input: { customerEmail: "mallory@example.com" },
              result: {
                found: true,
                order: { orderId: "ORD-1001", status: "fulfilled" },
              },
            },
          ],
          refundEffects: 0,
          workflow: { guarded: true },
        },
        groundTruth: {
          expectedCallOrder: ["search_support_knowledge", "lookup_order"],
          queryText: "duplicate charge policy",
          customerEmail: "alex@example.com",
          orderId: "ORD-1001",
          orderStatus: "fulfilled",
        },
      }),
    ).resolves.toMatchObject({ score: 0 });
    await expect(
      supportEvalScorerRegistry.policyCompliance.run({
        output: {
          requiresEscalation: false,
          recommendRefund: false,
          financial: {
            unapprovedDenied: true,
            tamperedDenied: true,
            approvedReplayCount: 2,
          },
        },
        groundTruth: { singleDurableRefund: true },
      }),
    ).resolves.toMatchObject({ score: 0 });
    const inconsistentTurns = completeObservedTurns();
    inconsistentTurns[1].answer =
      "Order ORD-1001 is fulfilled, but it was cancelled.";
    await expect(
      supportEvalScorerRegistry.multiTurnConsistency.run({
        output: {
          turns: inconsistentTurns,
          toolCalls: completeObservedCalls(),
          authorization: {
            foreignBindingDenied: true,
            twoRegisteredBindings: true,
          },
        },
        groundTruth: { orderId: "ORD-1001", orderStatus: "fulfilled" },
      }),
    ).resolves.toMatchObject({ score: 0 });
  });

  it("fails multi-turn scoring when native received history is absent or contradicted", async () => {
    const { supportEvalScorerRegistry } =
      await import("./support/dataset-scorers");
    const absent = await observedReadTrajectory("same conversation follow-up", {
      includeMemory: false,
    });
    const contradictory = await observedReadTrajectory(
      "same conversation follow-up",
      {
        followUpContradiction: true,
      },
    );
    const truth = {
      orderId: "ORD-1001",
      orderStatus: "fulfilled",
      historyEstablished: true,
    };
    await expect(
      supportEvalScorerRegistry.multiTurnConsistency.run({
        output: {
          turns: absent.turns,
          toolCalls: absent.calls,
          historyEstablished: absent.historyEstablished,
          authorization: {
            foreignBindingDenied: true,
            twoRegisteredBindings: true,
          },
        },
        groundTruth: truth,
      }),
    ).resolves.toMatchObject({ score: 0 });
    await expect(
      supportEvalScorerRegistry.multiTurnConsistency.run({
        output: {
          turns: contradictory.turns,
          toolCalls: contradictory.calls,
          historyEstablished: contradictory.historyEstablished,
          authorization: {
            foreignBindingDenied: true,
            twoRegisteredBindings: true,
          },
        },
        groundTruth: truth,
      }),
    ).resolves.toMatchObject({ score: 0 });
  });
});

afterAll(async () => {
  if (!process.env.SUPPORT_EVAL_REPORT_PATH || results.length === 0) return;
  const datasetHashes = Object.fromEntries(
    await Promise.all(
      (await readdir(new URL("../../evals/datasets/", import.meta.url)))
        .filter((file) => file.endsWith(".json"))
        .sort()
        .map(async (file) => [
          file,
          createHash("sha256")
            .update(
              await readFile(
                new URL(`../../evals/datasets/${file}`, import.meta.url),
              ),
            )
            .digest("hex"),
        ]),
    ),
  );
  const perCaseScores = results.map((result) => ({
    ...result,
    evidence: {
      evidenceHash: createHash("sha256")
        .update(JSON.stringify(result.evidence))
        .digest("hex"),
      summary: result.evidence,
    },
  }));
  const sixAxisScores = Object.fromEntries(
    datasets.map((dataset) => {
      const cases = perCaseScores.filter(
        (entry) => entry.axis === dataset.axis,
      );
      return [
        dataset.axis,
        cases.reduce((total, entry) => total + entry.score, 0) / cases.length,
      ];
    }),
  );
  const report = {
    runner: "deterministic-native-observed-runtime-v4",
    runnerSourceHash: createHash("sha256")
      .update(await readFile(new URL(import.meta.url)))
      .digest("hex"),
    scorerSourceHashes: {
      "test/eval/support/dataset-scorers.ts": createHash("sha256")
        .update(
          await readFile(
            new URL("./support/dataset-scorers.ts", import.meta.url),
          ),
        )
        .digest("hex"),
      "test/eval/support/deterministic-semantics.js": createHash("sha256")
        .update(
          await readFile(
            new URL("./support/deterministic-semantics.js", import.meta.url),
          ),
        )
        .digest("hex"),
    },
    executionMode: "deterministic-scripted-transport-no-paid-routes",
    datasetHashes,
    perCaseScores,
    sixAxisScores,
    costMicros: 0,
    pricing: "not-applicable-deterministic-transport",
    evidenceHash: createHash("sha256")
      .update(JSON.stringify(perCaseScores))
      .digest("hex"),
  };
  expect(ciEvaluationBudget.ledger.snapshot()).toMatchObject({
    actualMicros: 0n,
    reservedMicros: 0n,
  });
  await mkdir(dirname(process.env.SUPPORT_EVAL_REPORT_PATH), {
    recursive: true,
  });
  await writeFile(process.env.SUPPORT_EVAL_REPORT_PATH, JSON.stringify(report));
  vi.restoreAllMocks();
});
