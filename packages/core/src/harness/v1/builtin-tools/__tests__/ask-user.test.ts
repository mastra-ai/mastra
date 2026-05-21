import { describe, expect, it } from 'vitest';

import { RequestContext } from '../../../../request-context';
import type { ToolExecutionContext } from '../../../../tools/types';
import { ASK_USER_TOOL_ID, askUser } from '../index';

type AskUserCtx = ToolExecutionContext<Record<string, never>, { answer: unknown }>;

function makeAgentCtx(opts: {
  resumeData?: { answer: unknown };
  suspend?: (p: Record<string, never>) => Promise<void>;
}): AskUserCtx {
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

function makeWorkflowCtx(): AskUserCtx {
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

describe('askUser tool (standalone)', () => {
  it('has the stable ID the Harness routes on', () => {
    expect(askUser.id).toBe(ASK_USER_TOOL_ID);
    expect(askUser.id).toBe('ask_user');
  });

  it('suspends when no resumeData is provided', async () => {
    let suspended = false;
    let suspendPayload: unknown;

    await expect(
      askUser.execute!(
        { question: 'What is the capital of France?' },
        makeAgentCtx({
          suspend: async p => {
            suspended = true;
            suspendPayload = p;
            // Mirror the agent-loop convention: suspend() throws to halt downstream code.
            throw new Error('SUSPEND_MARKER');
          },
        }),
      ),
    ).rejects.toThrow('SUSPEND_MARKER');

    expect(suspended).toBe(true);
    expect(suspendPayload).toEqual({});
  });

  it('registers a Harness question before suspending when the harness slot is present', async () => {
    const requestContext = new RequestContext();
    const registrations: unknown[] = [];
    requestContext.set('harness', {
      registerQuestion: async (params: unknown) => {
        registrations.push(params);
      },
    });

    await expect(
      askUser.execute!(
        { question: 'Pick one', options: [{ label: 'a' }], selectionMode: 'single_select' },
        {
          ...makeAgentCtx({
            suspend: async () => {
              throw new Error('SUSPEND_MARKER');
            },
          }),
          requestContext,
          agent: {
            agentId: 'test-agent',
            runId: 'run-1',
            toolCallId: 'call-1',
            messages: [],
            suspend: async () => {
              throw new Error('SUSPEND_MARKER');
            },
          },
        },
      ),
    ).rejects.toThrow('SUSPEND_MARKER');

    expect(registrations).toEqual([
      {
        questionId: 'call-1',
        question: 'Pick one',
        options: [{ label: 'a' }],
        selectionMode: 'single_select',
        runId: 'run-1',
        toolCallId: 'call-1',
      },
    ]);
  });

  it('returns resumeData when present (acts as identity on second pass)', async () => {
    const result = await askUser.execute!(
      { question: 'Pick one', options: [{ label: 'a' }, { label: 'b' }], selectionMode: 'single_select' },
      makeAgentCtx({ resumeData: { answer: 'a' } }),
    );

    expect(result).toEqual({ answer: 'a' });
  });

  it('throws when no agent context is available (e.g. workflow step)', async () => {
    await expect(askUser.execute!({ question: 'q' }, makeWorkflowCtx())).rejects.toThrow(
      /ask_user requires an agent execution context/,
    );
  });
});
