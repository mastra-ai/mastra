import { mastra } from "../../src/mastra/index";
import { caseStore } from "../../src/mastra/lib/case-store";
import { recoverLocalWorkflows } from "../../src/mastra/runtime/local-runtime";
import { responseAgent } from "../../src/mastra/agents/response-agent";
import { triageAgent } from "../../src/mastra/agents/triage-agent";
import { issueRefundTool } from "../../src/mastra/tools/issue-refund";
import {
  deterministicJsonModel,
  deterministicRefundModel,
} from "./deterministic-language-model";

triageAgent.__updateModel({
  model: deterministicJsonModel({
    intent: "duplicate_charge",
    urgency: "normal",
    sentiment: "negative",
    requiresHumanReview: false,
    confidence: 1,
    rationale: "two-process recovery fixture",
  }) as never,
});
responseAgent.__updateModel({
  model: deterministicJsonModel({
    draftResponse: "Two-process refund response",
    citedSources: ["duplicate-charge-policy"],
    selectedPolicyExcerpts: [
      {
        source: "duplicate-charge-policy",
        excerpt:
          "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
      },
    ],
    recommendRefund: true,
    refundAmount: 10,
    refundCurrency: "USD",
    refundReason: "duplicate",
    requiresEscalation: false,
  }) as never,
});
await caseStore.list();
const mode = process.argv[2];

if (mode === "init") {
  const createdAt = new Date().toISOString();
  await caseStore.acceptInbound(
    {
      id: "post-refund-recovery-case",
      externalId: "post-refund-recovery-event",
      source: "mock-email",
      status: "new",
      subject: "charged twice",
      customer: { email: "alex@example.com" },
      messages: [
        {
          id: "post-refund-recovery-message",
          author: "customer",
          body: "refund duplicate",
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
      metadata: { ownerId: "customer-alex" },
    },
    "post-refund-recovery-event",
    "post-refund-recovery-run",
  );
  const executionModel = async () => {
    const action = await caseStore.getClient().execute({
      sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'refund-command'",
      args: ["post-refund-recovery-case"],
    });
    const command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as {
      orderId?: string;
      amount?: { minor?: number; currency?: string };
      reason?: string;
      idempotencyKey?: string;
      fingerprint?: string;
    };
    return deterministicRefundModel({
      caseId: "post-refund-recovery-case",
      orderId: command.orderId,
      amount: (command.amount?.minor ?? 0) / 100,
      currency: command.amount?.currency,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    }) as never;
  };
  mastra.getAgent("refundExecutionAgent").__updateModel({
    model: executionModel,
  });
  await recoverLocalWorkflows(mastra);
  const suspended = await caseStore.get("post-refund-recovery-case");
  if (!suspended) throw new Error("Expected native approval suspension.");
  const native = (suspended.metadata as Record<string, unknown>)
    .nativeApproval as {
    runId: string;
    toolCallId: string;
    turnId: string;
    fingerprint: string;
  };
  const command = (suspended.metadata as Record<string, unknown>)
    .refundCommand as {
    orderId: string;
    amount: number;
    currency: string;
    reason: string;
    idempotencyKey: string;
    fingerprint: string;
  };
  if (!native?.runId || !native.toolCallId || !native.turnId || !command)
    throw new Error("Expected a real native approval snapshot and command.");
  const decision = await caseStore.recordApprovalDecision({
    caseId: "post-refund-recovery-case",
    turnId: native.turnId,
    commandFingerprint: native.fingerprint,
    principalId: "approver-demo",
    approved: true,
    nativeRunId: native.runId,
    nativeToolCallId: native.toolCallId,
  });
  if (!decision.won) throw new Error("Expected the first durable decision.");
  const original = issueRefundTool.execute!;
  issueRefundTool.execute = async (...args: any[]) => {
    const effect = await (original as any)(...args);
    console.log("POST_REFUND_EFFECT", JSON.stringify(effect));
    process.exit(71);
  };
  const dispatch = await caseStore.claimDispatchForResume(
    "post-refund-recovery-case",
    "post-refund-recovery-run",
    native.turnId,
  );
  if (!dispatch) throw new Error("Expected a resume dispatch lease.");
  const { withDispatchLeaseScope } =
    await import("../../src/mastra/lib/dispatch-lease-scope");
  const { resumeApprovedNativeTool } =
    await import("../../src/mastra/providers/native-execution");
  await withDispatchLeaseScope(
    {
      dispatchId: dispatch.id,
      caseId: dispatch.caseId,
      turnId: dispatch.turnId,
      leaseToken: dispatch.leaseToken!,
    },
    () =>
      resumeApprovedNativeTool({
        mastra,
        approved: true,
        scope: {
          caseId: dispatch.caseId,
          turnId: dispatch.turnId,
          nativeRunId: native.runId,
          nativeToolCallId: native.toolCallId,
          commandFingerprint: native.fingerprint,
          dispatchId: dispatch.id,
          leaseToken: dispatch.leaseToken!,
        },
      }),
  );
} else if (mode === "recover") {
  await caseStore
    .getClient()
    .execute(
      "UPDATE support_dispatch SET lease_until = '2000-01-01' WHERE case_id = 'post-refund-recovery-case'",
    );
  const { recoverApprovedNativeDecisions } =
    await import("../../src/mastra/runtime/local-runtime");
  await recoverApprovedNativeDecisions(mastra, caseStore, {
    disableScorers: true,
  });
  await recoverLocalWorkflows(mastra);
  const supportCase = await caseStore.get("post-refund-recovery-case");
  const counts = await caseStore
    .getClient()
    .execute(
      "SELECT (SELECT COUNT(*) FROM local_refunds) refunds, (SELECT COUNT(*) FROM support_outbox) outbox, (SELECT COUNT(*) FROM local_deliveries) deliveries",
    );
  console.log(
    "POST_REFUND_RECOVERY_RESULT",
    JSON.stringify({
      case: supportCase,
      counts: counts.rows[0],
    }),
  );
  await mastra.shutdown();
} else {
  throw new Error("Expected init or recover mode.");
}
