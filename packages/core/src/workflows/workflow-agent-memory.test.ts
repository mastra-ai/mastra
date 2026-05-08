import { describe, expect, it } from 'vitest';
import { WORKFLOW_AGENT_INVOCATION_SCOPE } from './constants';
import { buildWorkflowAgentThreadId, mergeWorkflowAgentMemory } from './workflow-agent-memory';

describe('mergeWorkflowAgentMemory', () => {
  const ctx = {
    workflowId: 'wf-1',
    runId: 'run-1',
    stepId: 'agent-step',
    agentId: 'agent-step',
    workflowResourceId: 'tenant-a',
  };

  it('creates deterministic thread id and linkage metadata', () => {
    const merged = mergeWorkflowAgentMemory(undefined, ctx);

    expect(merged.resource).toBe('tenant-a');
    expect(merged.thread.id).toBe(buildWorkflowAgentThreadId(ctx));
    expect(merged.thread.metadata).toMatchObject({
      scope: WORKFLOW_AGENT_INVOCATION_SCOPE,
      workflowRunId: 'run-1',
      workflowId: 'wf-1',
      workflowStepId: 'agent-step',
      mastraAgentId: 'agent-step',
    });
  });

  it('defaults resource to agent id when no run resource', () => {
    const merged = mergeWorkflowAgentMemory(undefined, {
      ...ctx,
      workflowResourceId: undefined,
    });
    expect(merged.resource).toBe('agent-step');
  });

  it('preserves caller thread metadata and overlays linkage', () => {
    const merged = mergeWorkflowAgentMemory(
      {
        resource: 'custom-res',
        thread: {
          id: 'custom-thread',
          metadata: { appLabel: 'x' },
        },
      },
      ctx,
    );

    expect(merged.resource).toBe('custom-res');
    expect(merged.thread.id).toBe('custom-thread');
    expect(merged.thread.metadata).toMatchObject({
      appLabel: 'x',
      workflowRunId: 'run-1',
      scope: WORKFLOW_AGENT_INVOCATION_SCOPE,
    });
  });
});
