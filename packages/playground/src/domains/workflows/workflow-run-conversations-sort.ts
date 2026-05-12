import type { StorageThreadType } from '@mastra/core/memory';
import type { WorkflowStateStepResult } from '@mastra/core/workflows';

import { getWorkflowInvocationThreadMeta } from './workflow-invocation-thread-meta';

function dateMs(value: Date | string | undefined | null): number | undefined {
  if (value == null) return undefined;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Earliest step start in the run (foreach iterations share one logical step — use min `startedAt`).
 * Matches `steps` keys that equal `stepId` or end with `.<stepId>` for nested graphs.
 */
export function stepStartedAtFromRunSteps(
  steps: Record<string, WorkflowStateStepResult> | undefined,
  stepId: string,
): number | undefined {
  if (!stepId || !steps) return undefined;
  let minStart: number | undefined;
  for (const [key, value] of Object.entries(steps)) {
    const matches = key === stepId || key.endsWith(`.${stepId}`);
    if (!matches) continue;
    const arr = Array.isArray(value) ? value : [value];
    for (const entry of arr) {
      const t = entry?.startedAt;
      if (t !== undefined && (minStart === undefined || t < minStart)) {
        minStart = t;
      }
    }
  }
  return minStart;
}

/**
 * Run timeline order: prefer workflow step start times from the active run snapshot (correct when DB
 * timestamps tie or thread titles bump `updatedAt`). Otherwise fall back to `updatedAt`, then `createdAt`.
 */
export function sortWorkflowRunThreads(
  threads: StorageThreadType[],
  runSteps?: Record<string, WorkflowStateStepResult>,
): StorageThreadType[] {
  return [...threads].sort((a, b) => {
    const stepA = getWorkflowInvocationThreadMeta(a).stepId;
    const stepB = getWorkflowInvocationThreadMeta(b).stepId;
    const startA = stepStartedAtFromRunSteps(runSteps, stepA);
    const startB = stepStartedAtFromRunSteps(runSteps, stepB);
    if (startA !== undefined && startB !== undefined && startA !== startB) {
      return startA - startB;
    }
    if (startA !== undefined && startB === undefined) return -1;
    if (startA === undefined && startB !== undefined) return 1;

    const ua = dateMs(a.updatedAt) ?? dateMs(a.createdAt) ?? 0;
    const ub = dateMs(b.updatedAt) ?? dateMs(b.createdAt) ?? 0;
    if (ua !== ub) return ua - ub;

    const ca = dateMs(a.createdAt) ?? 0;
    const cb = dateMs(b.createdAt) ?? 0;
    if (ca !== cb) return ca - cb;

    return String(a.id).localeCompare(String(b.id));
  });
}
