import { describe, expect, it, vi } from 'vitest';

import { submitPlanTool } from './submit-plan';

function makeAgentContext(overrides: Record<string, any> = {}) {
  return {
    agent: {
      agentId: 'agent-1',
      toolCallId: 'tc-1',
      messages: [],
      suspend: vi.fn(async () => undefined),
      ...overrides,
    },
  };
}

describe('submitPlanTool (native suspend)', () => {
  it('suspends with the submitted path when no resumeData is present', async () => {
    const ctx = makeAgentContext();

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(ctx.agent.suspend).toHaveBeenCalledTimes(1);
    expect((ctx.agent.suspend as any).mock.calls[0][0]).toEqual({ path: '.mastracode/plans/ship-it.md' });
    // suspend short-circuits the step; the tool returns no output.
    expect(result).toBeUndefined();
  });

  it('reports approval back to the model from resumeData', async () => {
    const ctx = makeAgentContext({
      resumeData: { action: 'approved', path: '.mastracode/plans/ship-it.md', title: 'Ship it', plan: 'Do it' },
    });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(ctx.agent.suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Plan approved. Proceed with implementation following the approved plan.',
      isError: false,
      submittedPlan: {
        action: 'approved',
        title: 'Ship it',
        path: '.mastracode/plans/ship-it.md',
        plan: 'Do it',
      },
    });
  });

  it('reports rejection with feedback back to the model from resumeData', async () => {
    const ctx = makeAgentContext({ resumeData: { action: 'rejected', feedback: 'Add tests' } });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.submittedPlan.action).toBe('rejected');
    expect(result.content).toContain('The user wants revisions.');
    expect(result.content).toContain('User feedback: Add tests');
  });

  it('tells the model to stop and wait when rejected without feedback', async () => {
    const ctx = makeAgentContext({ resumeData: { action: 'rejected' } });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.submittedPlan.action).toBe('rejected');
    expect(result.content).toContain('not approved');
    expect(result.content).toContain('Stop now');
    expect(result.content).toContain('next message');
    expect(result.content).not.toContain('User feedback:');
  });

  it('falls back to readable text when no agent suspend is available', async () => {
    const result = await (submitPlanTool as any).execute(
      { path: '.mastracode/plans/ship-it.md' },
      { requestContext: undefined },
    );

    expect(result).toEqual({
      content: '[Plan submitted for review]\n\nPath: .mastracode/plans/ship-it.md',
      isError: false,
    });
  });
});
