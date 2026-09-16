import type { Mastra } from "@mastra/core/mastra";

/** Recover the crash window after the durable decision commit but before the
 * HTTP process resumed Mastra. A missing native snapshot is never authority;
 * it is tolerated only when the same immutable provider effect already exists. */
type NativeRecoveryMastra = Mastra;

type WorkflowRetentionStorage = NonNullable<
  ReturnType<NonNullable<NativeRecoveryMastra["getStorage"]>>
>;

/** Delete only snapshots whose app-owned copies have already expired. This
 * enumerates Mastra's supported workflow store so native suspension names are
 * not guessed from a resolution run id or deleted through direct SQL. */
export async function purgeExpiredWorkflowSnapshots(
  storage: WorkflowRetentionStorage | undefined,
  retention: {
    rawWorkflowSnapshotBefore: string;
    expiredCaseIds: readonly string[];
    expiredWorkflowRunIds: readonly string[];
  },
) {
  const workflows = await storage?.getStore?.("workflows");
  const expiredRunIds = new Set(retention.expiredWorkflowRunIds);
  const expiredCaseIds = new Set(retention.expiredCaseIds);
  const inboundWorkflowNames = new Set([
    "ingest-support-case",
    "ingestSupportCaseWorkflow",
  ]);
  const recoverableWorkflowNames = new Set([
    "resolve-support-case",
    "resolveSupportCaseWorkflow",
    "agentic-loop",
    "durable-agentic-loop",
    // Installed registered refundExecutionAgent currently persists its native
    // suspension under this storage workflow name.
    "executionWorkflow",
  ]);
  const runs = await workflows?.listWorkflowRuns({ perPage: false });
  const deleted: string[] = [];
  const snapshotContainsExpiredCase = (snapshot: unknown) => {
    const visit = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return false;
      if (Array.isArray(value)) return value.some(visit);
      for (const [key, nested] of Object.entries(value)) {
        if (key === "caseId" && expiredCaseIds.has(String(nested))) return true;
        if (visit(nested)) return true;
      }
      return false;
    };
    try {
      return visit(
        typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot,
      );
    } catch {
      return false;
    }
  };
  for (const run of runs?.runs ?? []) {
    const isExpiredInbound =
      inboundWorkflowNames.has(run.workflowName) &&
      run.createdAt.toISOString() < retention.rawWorkflowSnapshotBefore;
    const isExpiredAuthority =
      recoverableWorkflowNames.has(run.workflowName) &&
      (expiredRunIds.has(run.runId) ||
        snapshotContainsExpiredCase(run.snapshot));
    if (!isExpiredInbound && !isExpiredAuthority) continue;
    await workflows?.deleteWorkflowRunById({
      workflowName: run.workflowName,
      runId: run.runId,
    });
    deleted.push(`${run.workflowName}:${run.runId}`);
  }
  return deleted;
}
