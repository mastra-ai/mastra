import { describe, expect, it, vi } from 'vitest';

import { answerParkedCall, createFactoryApprovalTools } from './approval-tools.js';
import type { FactoryToolScope } from './scope.js';

const WORKER = '00000000-0000-4000-8000-000000000001';
const ITEM = 'item-1';

/** How each paused tool says what it resumes on, as the session reports it. */
const RESUME_SCHEMAS: Record<string, string> = {
  submit_plan: JSON.stringify({
    type: 'object',
    properties: { action: { type: 'string', enum: ['approved', 'rejected'] }, feedback: { type: 'string' } },
    required: ['action'],
  }),
  sign_off: JSON.stringify({
    type: 'object',
    properties: { action: { type: 'string', enum: ['approved', 'rejected'] } },
    required: ['action'],
  }),
  // Asks for a decision and a ticket number: a bare yes or no cannot finish this call.
  sign_off_with_ticket: JSON.stringify({
    type: 'object',
    properties: { action: { type: 'string', enum: ['approved', 'rejected'] }, ticket: { type: 'string' } },
    required: ['action', 'ticket'],
  }),
  ask_user: JSON.stringify({ anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }),
};

const scope: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'origin-session',
  resourceId: 'origin-session',
  threadId: 'origin-thread',
  kind: 'user',
  interactive: true,
  actorProfile: { name: 'Ada' },
};

function setup({
  row = {},
  binding = true,
  follows = true,
  armed = true,
  live = true,
  parkedTool,
}: {
  row?: Record<string, unknown>;
  binding?: boolean;
  follows?: boolean;
  armed?: boolean;
  live?: boolean;
  parkedTool?: string;
} = {}) {
  const respondToToolApproval = vi.fn((_input: unknown) => ({ accepted: true as const }));
  const respondToToolSuspension = vi.fn(async (_input: unknown) => {});
  const session = {
    approval: { list: () => (armed ? [{ toolCallId: 'call-1', toolName: 'factory_transition_work_item' }] : []) },
    respondToToolApproval,
    displayState: {
      get: () => ({
        pendingSuspensions: new Map(
          parkedTool
            ? [
                [
                  'run-address',
                  { toolCallId: 'call-1', toolName: parkedTool, resumeSchema: RESUME_SCHEMAS[parkedTool] },
                ],
              ]
            : [],
        ),
      }),
    },
    respondToToolSuspension,
  };
  const record = vi.fn();
  const tools = createFactoryApprovalTools(scope, {
    sessions: {
      getBySessionId: async () =>
        ({
          sessionId: WORKER,
          orgId: 'org-1',
          factoryProjectId: 'project-1',
          userId: 'someone-else',
          visibility: 'org',
          originSessionId: null,
          ...row,
        }) as never,
    },
    workItems: {
      findActiveRunBindingForSession: async () => (binding ? ({ workItemId: ITEM } as never) : null),
      listSessionSubscriptions: async () => (follows ? [{ workItemId: ITEM }] : []) as never,
    },
    auditRecorder: { record } as never,
    messaging: async () => ({ controller: { getSession: async () => (live ? session : null) } }) as never,
  });
  const answer = (input: Record<string, unknown>) =>
    (
      tools.factory_answer_approval as unknown as { execute: (input: unknown, context: unknown) => Promise<unknown> }
    ).execute({ sessionId: WORKER, toolCallId: 'call-1', ...input }, {});
  return { answer, session, respondToToolApproval, respondToToolSuspension, record };
}

describe('factory_answer_approval', () => {
  it("approves a plan the session is parked on with submit_plan, resuming as the session's owner", async () => {
    const { answer, respondToToolApproval, respondToToolSuspension, record } = setup({
      armed: false,
      parkedTool: 'submit_plan',
    });

    await expect(answer({ decision: 'approve' })).resolves.toMatchObject({ answered: 'approve' });

    expect(respondToToolApproval).not.toHaveBeenCalled();
    expect(respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ resumeData: { action: 'approved' }, toolCallId: 'call-1' }),
    );
    const { requestContext } = respondToToolSuspension.mock.calls[0]![0] as {
      requestContext: { get(key: string): unknown };
    };
    expect(requestContext.get('user')).toEqual({ workosId: 'someone-else', organizationId: 'org-1' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.run.approved' }));
  });

  it('declines a parked plan with the reason as feedback', async () => {
    const { answer, respondToToolSuspension } = setup({ armed: false, parkedTool: 'submit_plan' });

    await answer({ decision: 'decline', reason: 'Split it in two.' });

    expect(respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ resumeData: { action: 'rejected', feedback: 'Split it in two.' } }),
    );
  });

  it('approves any tool that paused itself for a yes or no, not only a plan', async () => {
    const { answer, respondToToolApproval, respondToToolSuspension } = setup({ armed: false, parkedTool: 'sign_off' });

    await expect(answer({ decision: 'approve' })).resolves.toMatchObject({ answered: 'approve' });

    expect(respondToToolApproval).not.toHaveBeenCalled();
    expect(respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ resumeData: { action: 'approved' }, toolCallId: 'call-1' }),
    );
  });

  it('does not approve a tool that needs more than a yes or no to carry on', async () => {
    const { answer, respondToToolApproval, respondToToolSuspension } = setup({
      armed: false,
      parkedTool: 'sign_off_with_ticket',
    });

    await expect(answer({ decision: 'approve' })).rejects.toThrow('Nothing is waiting on that tool call');

    expect(respondToToolApproval).not.toHaveBeenCalled();
    expect(respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('does not answer a tool waiting on a typed answer, like ask_user', async () => {
    const { answer, respondToToolSuspension } = setup({ armed: false, parkedTool: 'ask_user' });

    await expect(answer({ decision: 'approve' })).rejects.toThrow(/Nothing is waiting/);
    expect(respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('approves the call a followed work session is holding, and audits it as the person', async () => {
    const { answer, respondToToolApproval, record } = setup();

    await expect(answer({ decision: 'approve' })).resolves.toEqual({
      answered: 'approve',
      sessionId: WORKER,
      toolCallId: 'call-1',
    });

    expect(respondToToolApproval).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'approve', toolCallId: 'call-1' }),
    );
    const { requestContext } = respondToToolApproval.mock.calls[0]![0] as {
      requestContext: { get(key: string): unknown };
    };
    expect(requestContext.get('user')).toEqual({ workosId: 'someone-else', organizationId: 'org-1' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        actorType: 'human',
        actorProfile: { name: 'Ada' },
        action: 'factory.run.approved',
        targets: [
          { type: 'session', id: WORKER },
          { type: 'work_item', id: ITEM },
        ],
        metadata: { toolCallId: 'call-1', sessionId: WORKER, decision: 'approve', cause: 'factory_tools' },
      }),
    );
  });

  it('declines with the reason the session will see', async () => {
    const { answer, respondToToolApproval, record } = setup();
    await answer({ decision: 'decline', reason: 'Keep it in triage.' });

    expect(respondToToolApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'decline',
        toolCallId: 'call-1',
        declineContext: { reason: 'Keep it in triage.' },
      }),
    );
    const { requestContext } = respondToToolApproval.mock.calls[0]![0] as {
      requestContext: { get(key: string): unknown };
    };
    expect(requestContext.get('user')).toEqual({ workosId: 'someone-else', organizationId: 'org-1' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.run.dismissed' }));
  });

  it('lets the session that started a side session answer it', async () => {
    const { answer, respondToToolApproval } = setup({ row: { originSessionId: 'origin-session' }, binding: false });
    await answer({ decision: 'approve' });
    expect(respondToToolApproval).toHaveBeenCalled();
  });

  it('refuses a session it neither follows nor started, answering nothing', async () => {
    const { answer, respondToToolApproval } = setup({ follows: false });
    await expect(answer({ decision: 'approve' })).rejects.toThrow("doesn't follow session");
    expect(respondToToolApproval).not.toHaveBeenCalled();
  });

  it("refuses another person's private session and a session from another Factory", async () => {
    await expect(setup({ row: { visibility: 'private' } }).answer({ decision: 'approve' })).rejects.toThrow(
      'is private to its owner',
    );
    await expect(setup({ row: { factoryProjectId: 'other' } }).answer({ decision: 'approve' })).rejects.toThrow(
      'was not found in this Factory',
    );
  });

  it('says so when nothing is waiting any more, because the run ended or the session is gone', async () => {
    for (const options of [{ armed: false }, { live: false }]) {
      const { answer, respondToToolApproval } = setup(options);
      await expect(answer({ decision: 'approve' })).rejects.toThrow('Nothing is waiting on that tool call any more');
      expect(respondToToolApproval).not.toHaveBeenCalled();
    }
  });

  it('reports an answer the session refused', async () => {
    const { answer, respondToToolApproval, record } = setup();
    respondToToolApproval.mockReturnValueOnce({ accepted: false, reason: 'aborting' } as never);
    await expect(answer({ decision: 'approve' })).rejects.toThrow('not accepted (aborting)');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('answering without naming the tool call', () => {
  const session = { sessionId: WORKER, userId: 'someone-else', orgId: 'org-1' };
  const answerOnly = (live: unknown) =>
    answerParkedCall(
      { messaging: async () => ({ controller: { getSession: async () => live } }) as never },
      { session, decision: 'approve', declineReason: 'No.' },
    );

  it('answers the one call that is waiting', async () => {
    const { session: live, respondToToolApproval } = setup();

    await expect(answerOnly(live)).resolves.toEqual({
      toolCallId: 'call-1',
      toolName: 'factory_transition_work_item',
    });
    expect(respondToToolApproval).toHaveBeenCalledOnce();
  });

  it('asks which call to answer when several are waiting, answering none', async () => {
    const { session: live, respondToToolApproval, respondToToolSuspension } = setup({ parkedTool: 'sign_off' });
    live.displayState.get = () => ({
      pendingSuspensions: new Map([
        ['run-address', { toolCallId: 'call-2', toolName: 'sign_off', resumeSchema: RESUME_SCHEMAS.sign_off }],
      ]),
    });

    await expect(answerOnly(live)).rejects.toThrow(
      'This session waits on 2 approvals (factory_transition_work_item: call-1, sign_off: call-2). Name the toolCallId to answer.',
    );
    expect(respondToToolApproval).not.toHaveBeenCalled();
    expect(respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('says to open the session when it waits on no approval', async () => {
    const { session: live } = setup({ armed: false, parkedTool: 'ask_user' });

    await expect(answerOnly(live)).rejects.toThrow('This session is not waiting on an approval. Open it');
  });
});
