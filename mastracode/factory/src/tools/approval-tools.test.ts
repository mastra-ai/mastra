import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryApprovalTools } from './approval-tools.js';
import type { FactoryToolScope } from './scope.js';

const WORKER = '00000000-0000-4000-8000-000000000001';
const ITEM = 'item-1';

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
  paused,
}: {
  row?: Record<string, unknown>;
  binding?: boolean;
  follows?: boolean;
  armed?: boolean;
  live?: boolean;
  /** The tool paused on `call-1`, when nothing is armed. */
  paused?: string;
} = {}) {
  const respondToToolApproval = vi.fn((_input: unknown) => ({ accepted: true as const }));
  const respondToToolSuspension = vi.fn(async (_input: unknown) => {});
  const releaseToolResponse = vi.fn();
  const session = {
    approval: { isArmed: vi.fn(() => armed) },
    respondToToolApproval,
    suspensions: {
      resolveAddress: ({ toolCallId }: { toolCallId: string }) =>
        paused && toolCallId === 'call-1' ? { toolCallId, threadId: 't', runId: 'r', resourceId: WORKER } : undefined,
      get: () => (paused ? { toolName: paused } : undefined),
    },
    claimToolSuspension: vi.fn((toolCallId: string) => ({
      accepted: true as const,
      toolCallId,
      address: { toolCallId },
      claimKey: `claim:${toolCallId}`,
    })),
    respondToToolSuspension,
    releaseToolResponse,
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
    messaging: async () => ({ controller: { getSessionByResource: async () => (live ? session : null) } }) as never,
  });
  const answer = (input: Record<string, unknown>) =>
    (
      tools.factory_answer_approval as unknown as { execute: (input: unknown, context: unknown) => Promise<unknown> }
    ).execute({ sessionId: WORKER, toolCallId: 'call-1', ...input }, {});
  return { answer, session, respondToToolApproval, respondToToolSuspension, releaseToolResponse, record };
}

describe('factory_answer_approval', () => {
  it("approves a role's paused stage move, resuming it as the person", async () => {
    const { answer, respondToToolSuspension, releaseToolResponse, record } = setup({
      armed: false,
      paused: 'factory_transition_work_item',
    });

    await expect(answer({ decision: 'approve' })).resolves.toEqual({
      answered: 'approve',
      sessionId: WORKER,
      toolCallId: 'call-1',
    });

    expect(respondToToolSuspension).toHaveBeenCalledWith({
      address: { toolCallId: 'call-1' },
      resumeData: 'Approve',
      requestContext: expect.any(RequestContext),
    });
    const [{ requestContext }] = respondToToolSuspension.mock.calls[0] as [{ requestContext: RequestContext }];
    expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    await vi.waitFor(() => expect(releaseToolResponse).toHaveBeenCalledWith('claim:call-1'));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.run.approved', actorId: 'user-1' }));
  });

  it("declines a role's paused stage move with the reason", async () => {
    const { answer, respondToToolSuspension, record } = setup({ armed: false, paused: 'factory_transition_work_item' });

    await answer({ decision: 'decline', reason: 'Keep it open.' });

    expect(respondToToolSuspension).toHaveBeenCalledWith({
      address: { toolCallId: 'call-1' },
      resumeData: 'Decline: Keep it open.',
      requestContext: expect.any(RequestContext),
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.run.dismissed' }));
  });

  it('does not answer a pause that is not a request for approval', async () => {
    const { answer, respondToToolSuspension, record } = setup({ armed: false, paused: 'ask_user' });

    await expect(answer({ decision: 'approve' })).rejects.toThrow('Nothing is waiting on that tool call any more');
    expect(respondToToolSuspension).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('approves the call a followed work session is holding, and audits it as the person', async () => {
    const { answer, session, respondToToolApproval, record } = setup();

    await expect(answer({ decision: 'approve' })).resolves.toEqual({
      answered: 'approve',
      sessionId: WORKER,
      toolCallId: 'call-1',
    });

    expect(session.approval.isArmed).toHaveBeenCalledWith({ toolCallId: 'call-1' });
    expect(respondToToolApproval).toHaveBeenCalledWith({
      decision: 'approve',
      toolCallId: 'call-1',
      requestContext: expect.any(RequestContext),
    });
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

    expect(respondToToolApproval).toHaveBeenCalledWith({
      decision: 'decline',
      toolCallId: 'call-1',
      requestContext: expect.any(RequestContext),
      declineContext: { reason: 'Keep it in triage.' },
    });
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
