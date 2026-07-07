import { describe, expect, it, vi } from 'vitest';

import { submitPlanTool } from './submit-plan';

type SubmitPlanExecute = NonNullable<typeof submitPlanTool.execute>;
type SubmitPlanInput = Parameters<SubmitPlanExecute>[0];
type SubmitPlanContext = Parameters<SubmitPlanExecute>[1];
type SubmitPlanAgentContext = NonNullable<SubmitPlanContext['agent']>;

const executeSubmitPlan = async (input: SubmitPlanInput, context: SubmitPlanContext) => {
  const execute = submitPlanTool.execute;
  if (!execute) {
    throw new Error('submitPlanTool must define execute');
  }

  return execute(input, context);
};

function makeAgentContext(overrides: Partial<SubmitPlanAgentContext> = {}) {
  const suspend = vi.fn<SubmitPlanAgentContext['suspend']>(async () => undefined);

  return {
    context: {
      agent: {
        agentId: 'agent-1',
        toolCallId: 'tc-1',
        messages: [],
        suspend,
        ...overrides,
      },
    },
    suspend,
  };
}

function makeDirectContext(): SubmitPlanContext {
  return {
    requestContext: undefined,
  };
}

describe('submitPlanTool (native suspend)', () => {
  it('suspends with the submitted path when no resumeData is present', async () => {
    const { context, suspend } = makeAgentContext();

    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, context);

    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledWith({ path: '.mastracode/plans/ship-it.md' }, undefined);
    // suspend short-circuits the step; the tool returns no output.
    expect(result).toBeUndefined();
  });

  it('suspends with optional title and plan body when provided', async () => {
    const { context, suspend } = makeAgentContext();

    const result = await executeSubmitPlan(
      {
        path: '.mastracode/plans/ship-it.md',
        title: 'Ship it',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      context,
    );

    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledWith(
      {
        path: '.mastracode/plans/ship-it.md',
        title: 'Ship it',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      undefined,
    );
    expect(result).toBeUndefined();
  });

  it('suspends with an inline plan body when no path is provided', async () => {
    const { context, suspend } = makeAgentContext();

    const result = await executeSubmitPlan(
      {
        title: 'Inline plan',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      context,
    );

    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledWith(
      {
        title: 'Inline plan',
        plan: '## Plan\n\n- Build it\n- Verify it',
      },
      undefined,
    );
    expect(result).toBeUndefined();
  });

  it('reports approval back to the model from resumeData', async () => {
    const { context, suspend } = makeAgentContext({
      resumeData: { action: 'approved', path: '.mastracode/plans/ship-it.md', title: 'Ship it', plan: 'Do it' },
    });

    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Plan approved. Proceed with implementation following the approved plan.',
      isError: false,
      action: 'approved',
      submittedPlan: { title: 'Ship it', path: '.mastracode/plans/ship-it.md', plan: 'Do it' },
    });
  });

  it('reports approval with a comment back to the model from resumeData', async () => {
    const { context } = makeAgentContext({ resumeData: { action: 'approved', feedback: 'Start with the migration.' } });

    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, context);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('approved');
    expect(result.feedback).toBe('Start with the migration.');
    expect(result.content).toContain('Plan approved');
    expect(result.content).toContain('User comment: Start with the migration.');
  });

  it('reports rejection with a comment back to the model from resumeData', async () => {
    const { context } = makeAgentContext({ resumeData: { action: 'rejected', feedback: 'Add tests' } });

    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, context);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('rejected');
    expect(result.feedback).toBe('Add tests');
    expect(result.content).toContain('The user wants revisions.');
    expect(result.content).toContain('User comment: Add tests');
  });

  it('tells the model to stop and wait when rejected without feedback', async () => {
    const { context } = makeAgentContext({ resumeData: { action: 'rejected' } });

    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, context);

    expect(result.isError).toBe(false);
    expect(result.action).toBe('rejected');
    expect(result.content).toContain('not approved');
    expect(result.content).toContain('Stop now');
    expect(result.content).toContain('next message');
    expect(result.content).not.toContain('User comment:');
  });

  it('falls back to readable text when no agent suspend is available', async () => {
    const result = await executeSubmitPlan({ path: '.mastracode/plans/ship-it.md' }, makeDirectContext());

    expect(result).toEqual({
      content: '[Plan submitted for review]\n\nPath: .mastracode/plans/ship-it.md',
      isError: false,
    });
  });

  it('falls back to readable text for inline plans when no agent suspend is available', async () => {
    const result = await executeSubmitPlan(
      { title: 'Inline plan', plan: '## Plan\n\n- Build it' },
      makeDirectContext(),
    );

    expect(result).toEqual({
      content: '[Plan submitted for review]\n\nTitle: Inline plan\n\n## Plan\n\n- Build it',
      isError: false,
    });
  });
});
