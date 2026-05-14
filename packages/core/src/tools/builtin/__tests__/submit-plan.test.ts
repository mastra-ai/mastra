import { describe, expect, it } from 'vitest';

import { RequestContext } from '../../../request-context';
import type { ToolExecutionContext } from '../../types';
import { SUBMIT_PLAN_TOOL_ID, submitPlan } from '../index';

type SubmitPlanResume = { approved: boolean; revision?: string; transitionToMode?: string };
type SubmitPlanCtx = ToolExecutionContext<Record<string, never>, SubmitPlanResume>;

function makeAgentCtx(opts: {
  resumeData?: SubmitPlanResume;
  suspend?: (p: Record<string, never>) => Promise<void>;
}): SubmitPlanCtx {
  return {
    requestContext: new RequestContext(),
    agent: {
      agentId: 'test-agent',
      toolCallId: 'call-1',
      messages: [],
      suspend: opts.suspend ?? (async () => {}),
      resumeData: opts.resumeData,
    },
  };
}

function makeWorkflowCtx(): SubmitPlanCtx {
  return {
    requestContext: new RequestContext(),
    workflow: {
      runId: 'r',
      workflowId: 'w',
      state: {},
      setState: () => {},
      suspend: async () => {},
    },
  };
}

describe('submitPlan tool (standalone)', () => {
  it('has the stable ID the Harness routes on', () => {
    expect(submitPlan.id).toBe(SUBMIT_PLAN_TOOL_ID);
    expect(submitPlan.id).toBe('submit_plan');
  });

  it('suspends when no resumeData is provided', async () => {
    let suspended = false;
    await expect(
      submitPlan.execute!(
        { title: 'Add darkmode', plan: '# Overview\nSteps...' },
        makeAgentCtx({
          suspend: async () => {
            suspended = true;
            throw new Error('SUSPEND_MARKER');
          },
        }),
      ),
    ).rejects.toThrow('SUSPEND_MARKER');
    expect(suspended).toBe(true);
  });

  it('returns the resume payload on second pass (approval path)', async () => {
    const result = await submitPlan.execute!({ plan: '...' }, makeAgentCtx({ resumeData: { approved: true } }));
    expect(result).toEqual({ approved: true });
  });

  it('returns revision + transitionToMode when supplied by reviewer', async () => {
    const result = await submitPlan.execute!(
      { plan: '...' },
      makeAgentCtx({
        resumeData: { approved: true, revision: 'Use TS strict mode', transitionToMode: 'build' },
      }),
    );
    expect(result).toEqual({ approved: true, revision: 'Use TS strict mode', transitionToMode: 'build' });
  });

  it('returns rejection with revision guidance', async () => {
    const result = await submitPlan.execute!(
      { plan: '...' },
      makeAgentCtx({ resumeData: { approved: false, revision: 'Add tests section' } }),
    );
    expect(result).toEqual({ approved: false, revision: 'Add tests section' });
  });

  it('throws when no agent context is available', async () => {
    await expect(submitPlan.execute!({ plan: 'p' }, makeWorkflowCtx())).rejects.toThrow(
      /submit_plan requires an agent execution context/,
    );
  });
});
