import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { WorkflowRunState } from '../../workflows';
import { getRunFence } from './execution-fence';

/** Separate from the resumable agentic-loop snapshots, which are deleted at termination. */
export const DURABLE_AGENT_OUTCOME_WORKFLOW = 'durable-agent-outcome';
export const DURABLE_AGENT_OUTCOME_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface DurableRunOutcome {
  version: 1;
  runId: string;
  agentId: string;
  resourceId?: string;
  status: 'success' | 'failed' | 'tripwire' | 'canceled';
  result?: {
    text?: string;
    usage: unknown;
    steps: unknown[];
    finishReason: string;
    object?: unknown;
    tripwire?: unknown;
  };
  error?: { name: string; message: string };
  completedAt: string;
}

export async function readDurableRunOutcome(
  mastra: Mastra | undefined,
  runId: string,
): Promise<DurableRunOutcome | null> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  const row = await store?.getWorkflowRunById({ workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW, runId });
  const snapshot = typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
  const record = (snapshot?.result as DurableRunOutcome | undefined) ?? null;
  if (record && Date.parse(record.completedAt) + DURABLE_AGENT_OUTCOME_RETENTION_MS < Date.now()) {
    await store?.deleteWorkflowRunById({ workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW, runId });
    return null;
  }
  return record;
}

/** Bounded opportunistic cleanup; no process-local timer is required for correctness. */
export async function pruneDurableRunOutcomes(mastra: Mastra): Promise<void> {
  const store = await mastra.getStorage()?.getStore('workflows');
  if (!store) return;
  const expired = await store.listWorkflowRuns({
    workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW,
    toDate: new Date(Date.now() - DURABLE_AGENT_OUTCOME_RETENTION_MS),
    page: 0,
    perPage: 50,
  });
  for (const row of expired.runs) {
    await store.deleteWorkflowRunById({ workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW, runId: row.runId });
  }
}

/**
 * An existing outcome wins. Recovery claims the run before entering this path,
 * so an earlier owner cannot write a competing outcome after the read.
 */
export async function commitDurableRunOutcome(
  mastra: Mastra | undefined,
  requestContext: RequestContext | undefined,
  outcome: DurableRunOutcome,
): Promise<DurableRunOutcome> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!store) throw new Error('Durable run outcomes require workflow storage');
  const existingRow = await store.getWorkflowRunById({
    workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW,
    runId: outcome.runId,
  });
  const existing = existingRow ? await readDurableRunOutcome(mastra, outcome.runId) : null;
  if (existing) return existing;
  // The retained record is read by a different process and returned as JSON.
  // Normalize it here rather than relying on adapter-specific snapshot codecs.
  const safeOutcome = JSON.parse(JSON.stringify(outcome)) as DurableRunOutcome;
  const snapshot = outcomeSnapshot(safeOutcome);
  await store.persistWorkflowSnapshot({
    workflowName: DURABLE_AGENT_OUTCOME_WORKFLOW,
    runId: outcome.runId,
    resourceId: outcome.resourceId,
    snapshot,
    fence: getRunFence(requestContext, outcome.runId, 'workflows'),
  });
  return safeOutcome;
}

function outcomeSnapshot(outcome: DurableRunOutcome): WorkflowRunState {
  return {
    runId: outcome.runId,
    status: outcome.status,
    result: outcome as unknown as Record<string, any>,
    value: {},
    context: {},
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: Date.now(),
  };
}
