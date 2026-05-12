import type { StorageThreadType } from '@mastra/core/memory';

/** Reads `mastraAgentId` / `workflowStepId` written onto workflow-scoped memory threads. */
export function getWorkflowInvocationThreadMeta(thread: StorageThreadType): {
  agentId: string;
  stepId: string;
} {
  const m = thread.metadata as Record<string, unknown> | undefined;
  return {
    agentId: typeof m?.mastraAgentId === 'string' ? m.mastraAgentId : '',
    stepId: typeof m?.workflowStepId === 'string' ? m.workflowStepId : '',
  };
}
