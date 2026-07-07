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

  it('suspends with optional title and plan body when provided', async () => {
    const ctx = makeAgentContext();

    const result = await (submitPlanTool as any).execute(
      {
        path: '.mastracode/plans/ship-it.md',
        title: 'Ship it',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      ctx,
    );

    expect(ctx.agent.suspend).toHaveBeenCalledTimes(1);
    expect((ctx.agent.suspend as any).mock.calls[0][0]).toEqual({
      path: '.mastracode/plans/ship-it.md',
      title: 'Ship it',
      plan: '## Plan\n\n- Build it\n- Verify it',
    });
    expect(result).toBeUndefined();
  });

  it('suspends with an inline plan body when no path is provided', async () => {
    const ctx = makeAgentContext();

    const result = await (submitPlanTool as any).execute(
      {
        title: 'Inline plan',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      ctx,
    );

    expect(ctx.agent.suspend).toHaveBeenCalledTimes(1);
    expect((ctx.agent.suspend as any).mock.calls[0][0]).toEqual({
      title: 'Inline plan',
      plan: '## Plan\n\n- Build it\n- Verify it',
    });
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
      action: 'approved',
      submittedPlan: { title: 'Ship it', path: '.mastracode/plans/ship-it.md', plan: 'Do it' },
    });
  });

  it('reports approval with a comment back to the model from resumeData', async () => {
    const ctx = makeAgentContext({ resumeData: { action: 'approved', feedback: 'Start with the migration.' } });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('approved');
    expect(result.feedback).toBe('Start with the migration.');
    expect(result.content).toContain('Plan approved');
    expect(result.content).toContain('User comment: Start with the migration.');
  });

  it('reports rejection with a comment back to the model from resumeData', async () => {
    const ctx = makeAgentContext({ resumeData: { action: 'rejected', feedback: 'Add tests' } });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('rejected');
    expect(result.feedback).toBe('Add tests');
    expect(result.content).toContain('The user wants revisions.');
    expect(result.content).toContain('User comment: Add tests');
  });

  it('tells the model to stop and wait when rejected without feedback', async () => {
    const ctx = makeAgentContext({ resumeData: { action: 'rejected' } });

    const result = await (submitPlanTool as any).execute({ path: '.mastracode/plans/ship-it.md' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('rejected');
    expect(result.content).toContain('not approved');
    expect(result.content).toContain('Stop now');
    expect(result.content).toContain('next message');
    expect(result.content).not.toContain('User comment:');
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

  it('falls back to readable text for inline plans when no agent suspend is available', async () => {
    const result = await (submitPlanTool as any).execute(
      { title: 'Inline plan', plan: '## Plan\n\n- Build it' },
      { requestContext: undefined },
    );

    expect(result).toEqual({
      content: '[Plan submitted for review]\n\nTitle: Inline plan\n\n## Plan\n\n- Build it',
      isError: false,
    });
  });
});
