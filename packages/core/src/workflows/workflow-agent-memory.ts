import type { AgentMemoryOption } from '../agent/types';
import type { StorageThreadType } from '../memory/types';
import { WORKFLOW_AGENT_INVOCATION_SCOPE } from './constants';

/** Stable thread id for an agent step inside a workflow run (concatenates loop iterations). */
export function buildWorkflowAgentThreadId(params: { workflowId: string; runId: string; stepId: string }): string {
  return `mastra:wflow:${params.workflowId}:${params.runId}:step:${params.stepId}`;
}

/**
 * Binds agent {@link AgentMemoryOption} to workflow execution context so Studio can list and open
 * transcripts for workflow runs without app-defined boilerplate.
 */
export function mergeWorkflowAgentMemory(
  agentMemory: AgentMemoryOption | undefined,
  ctx: {
    workflowId: string;
    runId: string;
    stepId: string;
    agentId: string;
    /** From {@link ExecuteFunctionParams.resourceId} when the workflow run was scoped to a resource */
    workflowResourceId?: string;
  },
): AgentMemoryOption {
  const derivedThreadId = buildWorkflowAgentThreadId({
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    stepId: ctx.stepId,
  });

  const resource = agentMemory?.resource ?? ctx.workflowResourceId ?? ctx.agentId;

  const linkageMetadata: Record<string, string> = {
    scope: WORKFLOW_AGENT_INVOCATION_SCOPE,
    workflowRunId: ctx.runId,
    workflowId: ctx.workflowId,
    workflowStepId: ctx.stepId,
    mastraAgentId: ctx.agentId,
  };

  let baseThread: Partial<StorageThreadType> & { id: string };

  if (typeof agentMemory?.thread === 'string') {
    baseThread = { id: agentMemory.thread };
  } else if (agentMemory?.thread && typeof agentMemory.thread === 'object') {
    baseThread = { ...agentMemory.thread };
    if (!baseThread.id) {
      baseThread.id = derivedThreadId;
    }
  } else {
    baseThread = { id: derivedThreadId };
  }

  const existingMeta =
    typeof agentMemory?.thread === 'object' && agentMemory.thread.metadata
      ? { ...(agentMemory.thread.metadata as Record<string, unknown>) }
      : {};

  return {
    ...agentMemory,
    resource,
    thread: {
      ...baseThread,
      id: baseThread.id,
      metadata: {
        ...existingMeta,
        ...linkageMetadata,
      },
    },
    options: agentMemory?.options,
  };
}
