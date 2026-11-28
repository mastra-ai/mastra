import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../../storage/domains/source-control/base.js';
import { parsePlanDigest } from '../../tools/plan-digest.js';
import type { FactoryPlanApprovalRequest } from '../../tools/reports.js';
import {
  handlePlanApproveAction,
  PLAN_APPROVE_FORBIDDEN,
  PLAN_APPROVE_UNLINKED,
  withPlanApproveActions,
} from './plan-approval-actions.js';
import { planApproveActionId } from './plan-approval-card.js';
import { PlanApprovalCards } from './plan-approval-post.js';

const SESSION = {
  sessionId: 'session-w',
  orgId: 'org-1',
  userId: 'owner',
  factoryProjectId: 'factory-1',
  visibility: 'org',
} as unknown as SourceControlSession;

const PLAN = parsePlanDigest('.artifacts/plans/a.md', '# Add dark mode\n\n## Goal\nDark theme.\n');

/** A live session parked on `submit_plan`, answered through the real `answerParkedCall`. */
function parkedSession() {
  const respondToToolSuspension = vi.fn(async () => {
    suspensions.clear();
  });
  const suspensions = new Set(['addr-1']);
  const live = {
    approval: { list: () => [] },
    displayState: {
      get: () => ({
        pendingSuspensions: new Map([
          [
            'addr-1',
            {
              toolCallId: 'call-1',
              toolName: 'submit_plan',
              resumeSchema: JSON.stringify({
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['approved', 'rejected'] },
                  feedback: { type: 'string' },
                },
                required: ['action'],
              }),
            },
          ],
        ]),
      }),
    },
    claimToolSuspension: () => ({ accepted: true, address: 'addr-1', claimKey: 'claim-1' }),
    releaseToolResponse: () => {},
    respondToToolSuspension,
    suspensions,
  };
  return { live, respondToToolSuspension };
}

async function setup({
  linkedAs = 'owner' as string | null,
  follower = false,
  live = parkedSession().live as unknown,
} = {}) {
  const edit = vi.fn(async () => ({}));
  const cards = new PlanApprovalCards({
    channels: () =>
      ({
        buildRenderContextForThread: async (threadId: string) => ({
          platform: 'slack',
          chatThread: { post: async () => ({ edit: threadId === 'thread-a' ? vi.fn() : edit }) },
        }),
      }) as never,
    sessions: { getBySessionId: async () => SESSION },
  });
  await cards.post({
    sender: { sessionId: 'session-w', threadId: 'thread-w', userId: 'owner' },
    recipients: [
      { sessionId: 'a', threadId: 'thread-a', userId: 'owner' },
      { sessionId: 'b', threadId: 'thread-b', userId: 'owner' },
    ],
    toolCallId: 'call-1',
    plan: PLAN,
    subject: 'The work session for #7',
  } as FactoryPlanApprovalRequest);
  const record = vi.fn(async () => {});
  const editMessage = vi.fn(async () => ({}));
  const postEphemeral = vi.fn(async () => ({}));
  const getAccountLink = vi.fn(async () => (linkedAs ? { userId: linkedAs, orgId: 'org-1' } : null));
  const deps = {
    accountLinks: { getAccountLink } as never,
    getSession: async (id: string) =>
      id === 'session-w' ? SESSION : ({ ...SESSION, sessionId: id, userId: 'pat' } as never),
    workItems: {
      findActiveRunBindingForSession: async () => ({ workItemId: 'item-7' }) as never,
      get: async () => ({ createdBy: 'someone-else' }) as never,
      listWorkItemSubscribers: async () => (follower ? [{ sessionId: 'pats-session' }] : []) as never,
    },
    messaging: async () => ({ controller: { getSession: async () => live } }) as never,
    audit: { record } as never,
    cards,
  };
  const event = {
    actionId: planApproveActionId('session-w', 'call-1'),
    adapter: { name: 'slack', editMessage } as never,
    messageId: 'm-a',
    raw: { team: { id: 'T1' } },
    thread: { postEphemeral } as never,
    threadId: 'thread-a',
    user: { userId: 'U1' } as never,
  };
  return { deps, event, editMessage, postEphemeral, getAccountLink, record, edit };
}

describe('handlePlanApproveAction', () => {
  it('approves the parked plan as the linked owner, and settles every card naming them', async () => {
    const parked = parkedSession();
    const { deps, event, editMessage, getAccountLink, record, edit } = await setup({ live: parked.live });

    expect(await handlePlanApproveAction(deps, event)).toBe(true);

    expect(getAccountLink).toHaveBeenCalledWith({ platform: 'slack', externalTeamId: 'T1', externalUserId: 'U1' });
    expect(parked.respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'addr-1', resumeData: { action: 'approved' } }),
    );
    const clicked = JSON.stringify(editMessage.mock.calls[0]);
    expect(clicked).toContain('✅ Plan approved: Add dark mode');
    expect(clicked).toContain('Approved by <@U1>.');
    expect(clicked).not.toContain('factory_plan:approve');
    expect(JSON.stringify(edit.mock.calls[0])).toContain('Approved by <@U1>.');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'owner',
        action: 'factory.run.approved',
        targets: [
          { type: 'session', id: 'session-w' },
          { type: 'work_item', id: 'item-7' },
        ],
        metadata: expect.objectContaining({ toolCallId: 'call-1', toolName: 'submit_plan', cause: 'slack' }),
      }),
    );
  });

  it('lets someone whose session follows the card approve', async () => {
    const parked = parkedSession();
    const { deps, event } = await setup({ linkedAs: 'pat', follower: true, live: parked.live });
    await handlePlanApproveAction(deps, event);
    expect(parked.respondToToolSuspension).toHaveBeenCalled();
  });

  it('refuses an unlinked Slack user and anyone else, without answering', async () => {
    for (const [linkedAs, message] of [
      [null, PLAN_APPROVE_UNLINKED],
      ['stranger', PLAN_APPROVE_FORBIDDEN],
    ] as const) {
      const parked = parkedSession();
      const { deps, event, postEphemeral, editMessage, record } = await setup({ linkedAs, live: parked.live });
      expect(await handlePlanApproveAction(deps, event)).toBe(true);
      expect(postEphemeral).toHaveBeenCalledWith({ userId: 'U1' }, message, { fallbackToDM: false });
      expect(parked.respondToToolSuspension).not.toHaveBeenCalled();
      expect(editMessage).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    }
  });

  it('marks the card no longer waiting when the plan was already answered', async () => {
    const { deps, event, editMessage, postEphemeral, record } = await setup({ live: null });

    await handlePlanApproveAction(deps, event);

    expect(JSON.stringify(editMessage.mock.calls[0])).toContain('📋 Plan no longer waiting: Add dark mode');
    expect(postEphemeral).toHaveBeenCalledWith(
      { userId: 'U1' },
      expect.stringContaining('Nothing is waiting on that tool call any more'),
      { fallbackToDM: false },
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('leaves every other action to the channel’s own handler', async () => {
    const { deps, event } = await setup();
    const own = vi.fn(async () => {});
    const defaultHandler = vi.fn(async () => {});
    const config = withPlanApproveActions({ adapters: {}, handlers: { onAction: own } } as never, deps);

    await config.handlers!.onAction!({ ...event, actionId: 'tool_approve:x' } as never, defaultHandler, {} as never);
    expect(own).toHaveBeenCalledTimes(1);

    const bare = withPlanApproveActions({ adapters: {} } as never, deps);
    await bare.handlers!.onAction!({ ...event, actionId: 'run_continue' } as never, defaultHandler, {} as never);
    expect(defaultHandler).toHaveBeenCalledTimes(1);
  });

  it('keeps the cards and their Approve button when the answer did not reach a call that still waits', async () => {
    const parked = parkedSession();
    // The resume fails to start: the call stays parked.
    parked.respondToToolSuspension.mockImplementation(async () => {});
    const { deps, event, editMessage, postEphemeral, record, edit } = await setup({ live: parked.live });

    expect(await handlePlanApproveAction(deps, event)).toBe(true);

    expect(postEphemeral).toHaveBeenCalledWith(
      event.user,
      expect.stringContaining('The answer did not reach submit_plan'),
      expect.anything(),
    );
    expect(editMessage).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(deps.cards.posted('call-1')).toBeDefined();
    expect(record).not.toHaveBeenCalled();
  });
});
