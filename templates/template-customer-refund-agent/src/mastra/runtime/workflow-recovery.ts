import type { Mastra } from "@mastra/core/mastra";
import {
  caseStore,
  type CaseStore,
  type DispatchRecord,
} from "../lib/case-store";
import { withDispatchLeaseScope } from "../lib/dispatch-lease-scope";
import { retryOrEscalateOperationalFailure } from "../lib/operational-alerts";
import { bindingsForPersistedCase } from "./provider-bindings";

/** Restarts interrupted Mastra work; suspended approvals remain suspended. */
export async function recoverLocalWorkflows(
  mastra: {
    getWorkflow(id: string): any;
    /** Present on the registered runtime; optional for narrow recovery fakes. */
    observability?: Mastra["observability"];
  },
  limit = 10,
  store: CaseStore = caseStore,
) {
  const retryOperationalFailure = async (
    dispatch: DispatchRecord,
    error: unknown,
  ): Promise<"retried" | "escalate"> => {
    // This is the operational recovery path, not a dashboard-only
    // classification. Attempts are durably bounded by CaseStore at three.
    const result = await retryOrEscalateOperationalFailure({
      signal: {
        providerOrTool: "resolve-support-case",
        occurredAt: new Date(),
        durationMs: 0,
        failed: true,
      },
      retry: () =>
        store.retryDispatch(
          dispatch.id,
          dispatch.caseId,
          error,
          dispatch.leaseToken,
        ),
      // Recovery must defer its case projection until it knows the retry has
      // exhausted. The caller owns the fenced escalation transition.
      escalate: async () => false,
    });
    return result.disposition === "retry" ? "retried" : "escalate";
  };
  let claimed = 0;
  while (claimed < limit) {
    // Workflow restarts are sequential; claiming ahead would let a waiting
    // dispatch expire before its run can be started.
    const [dispatch] = await store.claimDispatch(1);
    if (!dispatch) break;
    claimed += 1;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lostOwnership = false;
    const loseOwnership = () => {
      if (lostOwnership) return;
      lostOwnership = true;
    };
    const renew = async () => {
      try {
        if (
          !(await store.renewDispatchLease(dispatch.id, dispatch.leaseToken!))
        )
          loseOwnership();
      } catch {
        loseOwnership();
      }
    };
    try {
      const supportCase = await store.get(dispatch.caseId);
      if (!supportCase) {
        await store.completeDispatch(
          dispatch.id,
          "failed",
          "Case missing during recovery.",
          dispatch.leaseToken,
        );
        continue;
      }
      // Publication is a trusted worker responsibility, never a read-tool
      // side effect. This preserves the ordinary search capability as a pure
      // read while keeping the local quickstart operational after startup.
      const { publishKnowledge } = await import("../lib/publish-knowledge");
      await publishKnowledge(bindingsForPersistedCase(supportCase).knowledge, {
        onlyIfMissing: true,
        // The background worker is a real operational boundary. Its provider
        // reads need the registered observability instance just like a
        // foreground workflow, while lightweight recovery fakes remain pure.
        ...(mastra.observability ? { mastra: mastra as Mastra } : {}),
      });
      const workflow = mastra.getWorkflow("resolveSupportCaseWorkflow");
      const existing = await workflow.getWorkflowRunById?.(dispatch.runId);
      if (
        existing?.status === "suspended" ||
        existing?.status === "waiting" ||
        existing?.status === "paused"
      ) {
        await store.completeDispatch(
          dispatch.id,
          "suspended",
          undefined,
          dispatch.leaseToken,
        );
        continue;
      }
      // A persisted waiting_approval case only blocks recovery when the actual
      // Mastra snapshot is absent.  If a process died after resume accepted the
      // decision, its active snapshot is authoritative and must be resumed.
      if (supportCase.status === "waiting_approval" && !existing) {
        await store.completeDispatch(
          dispatch.id,
          "suspended",
          undefined,
          dispatch.leaseToken,
        );
        continue;
      }
      if (existing?.status === "success") {
        await store.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
        continue;
      }
      if (
        existing?.status === "failed" ||
        existing?.status === "cancelled" ||
        existing?.status === "canceled"
      ) {
        await store.failDispatchAndCase(
          dispatch.id,
          dispatch.caseId,
          `Workflow recovery failed: ${existing.status}`,
          dispatch.leaseToken,
          "escalated",
        );
        continue;
      }
      const run = await workflow.createRun({ runId: dispatch.runId });
      // Do not write even the public run pointer after a slow lookup has
      // revealed that another worker owns this dispatch.
      await renew();
      if (lostOwnership) break;
      if (!(await store.activateDispatch(dispatch))) break;
      // `restart()` only resumes an installed active run.  A process can die
      // after acceptance but before first start, which has no run record yet.
      // Renew immediately before this external workflow effect instead of
      // relying on the claim made before the earlier storage lookups.
      await renew();
      if (lostOwnership) break;
      heartbeat = setInterval(() => void renew(), 10_000);
      heartbeat.unref();
      const result = await withDispatchLeaseScope<{ status: string }>(
        {
          dispatchId: dispatch.id,
          caseId: dispatch.caseId,
          turnId: dispatch.turnId,
          leaseToken: dispatch.leaseToken!,
        },
        () =>
          existing?.status === "running" || existing?.status === "pending"
            ? run.restart()
            : run.start({
                inputData: {
                  caseId: dispatch.caseId,
                  turnId: dispatch.turnId,
                },
              }),
      );
      if (lostOwnership) break;
      if (result.status === "failed") {
        const recovery = await retryOperationalFailure(
          dispatch,
          "Workflow restart failed.",
        ).catch(() => "escalate" as const);
        if (recovery === "retried") continue;
        await store.failDispatchAndCase(
          dispatch.id,
          dispatch.caseId,
          "Workflow restart failed.",
          dispatch.leaseToken,
          "escalated",
        );
      } else
        await store.completeDispatch(
          dispatch.id,
          result.status === "suspended" ? "suspended" : "completed",
          undefined,
          dispatch.leaseToken,
        );
    } catch (error) {
      if (!lostOwnership) {
        const recovery = await retryOperationalFailure(dispatch, error).catch(
          () => "escalate" as const,
        );
        if (recovery !== "retried")
          await store
            .failDispatchAndCase(
              dispatch.id,
              dispatch.caseId,
              error,
              dispatch.leaseToken,
              "escalated",
            )
            .catch(() => undefined);
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
    if (lostOwnership) break;
  }
  return claimed;
}
