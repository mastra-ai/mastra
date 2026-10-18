import type { WorkflowRunStatus } from '@mastra/core/workflows';

export function verifySeedRunStatus(runId: string, status: WorkflowRunStatus, expected: WorkflowRunStatus): void {
  if (status !== expected) throw new Error(`Preview seed ${runId}: expected ${expected}, received ${status}.`);
}
