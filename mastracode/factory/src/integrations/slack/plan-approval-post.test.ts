import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parsePlanDigest } from '../../tools/plan-digest.js';
import type { FactoryPlanApprovalRequest } from '../../tools/reports.js';
import { observeSessionPlanCards, PlanApprovalCards } from './plan-approval-post.js';

const PLAN = parsePlanDigest(
  '.artifacts/plans/a.md',
  '# Add dark mode\n\n## Goal\nLet people switch to a dark theme.\n',
);

const REQUEST: FactoryPlanApprovalRequest = {
  sender: { sessionId: 'session-w', threadId: 'thread-w', userId: 'user-1' },
  recipients: [
    { sessionId: 'session-slack', threadId: 'thread-slack', userId: 'user-1' },
    { sessionId: 'session-web', threadId: 'thread-web', userId: 'user-1' },
  ],
  toolCallId: 'call-1',
  plan: PLAN,
  subject: 'The work session for #7',
} as FactoryPlanApprovalRequest;

function setup({ failCard = false, earlier = [] as Record<string, unknown>[] } = {}) {
  const edit = vi.fn(async () => ({}));
  const post = vi.fn(async (message: Record<string, unknown>) => {
    if (failCard && 'card' in message) throw new Error('invalid_blocks');
    return { edit };
  });
  const buildRenderContextForThread = vi.fn(async (threadId: string) =>
    threadId === 'thread-slack' ? { platform: 'slack', chatThread: { post } } : null,
  );
  const listNotifications = vi.fn(async () => earlier);
  const cards = new PlanApprovalCards({
    channels: () => ({ buildRenderContextForThread }) as unknown as AgentChannels,
    sessions: { getBySessionId: async () => ({ factoryProjectId: 'factory-1' }) as never },
    notifications: async () => ({ listNotifications }) as never,
  });
  return { cards, post, edit, buildRenderContextForThread, listNotifications };
}

describe('PlanApprovalCards', () => {
  beforeEach(() => vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com'));
  afterEach(() => vi.unstubAllEnvs());

  it('posts one card in each Slack thread, and none twice for the same call', async () => {
    const { cards, post } = setup();

    expect([...(await cards.post(REQUEST))]).toEqual(['thread-slack']);
    expect([...(await cards.post(REQUEST))]).toEqual(['thread-slack']);

    expect(post).toHaveBeenCalledTimes(1);
    const posted = JSON.stringify(post.mock.calls[0]);
    expect(posted).toContain('Let people switch to a dark theme.');
    expect(posted).toContain('factory_plan:approve:session-w:call-1');
    expect(posted).toContain('https://factory.example.com/factories/factory-1/workspaces/session-w/threads/thread-w');
  });

  it('does not post again a card an earlier report says is already in the thread', async () => {
    const { cards, post } = setup({ earlier: [{ attributes: { 'plan-card': 'posted', 'tool-call-id': 'call-1' } }] });

    expect([...(await cards.post(REQUEST))]).toEqual(['thread-slack']);
    expect(post).not.toHaveBeenCalled();
  });

  it('falls back to the plan as text when Slack refuses the card', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cards, post } = setup({ failCard: true });

    expect([...(await cards.post(REQUEST))]).toEqual([]);
    expect(post).toHaveBeenLastCalledWith({ markdown: expect.stringContaining('Let people switch to a dark theme.') });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('settles the cards when the plan is answered anywhere else', async () => {
    const { cards, edit } = setup();
    await cards.post(REQUEST);
    const listeners: ((event: AgentControllerEvent) => void)[] = [];
    observeSessionPlanCards({ subscribe: (listener: never) => (listeners.push(listener), () => {}) } as never, cards);
    const emit = (event: Record<string, unknown>) => listeners.forEach(listener => listener(event as never));

    emit({ type: 'tool_suspended', toolName: 'submit_plan', toolCallId: 'call-1' });
    emit({
      type: 'tool_end',
      toolCallId: 'call-1',
      result: { content: 'revise', submittedPlan: { action: 'rejected', feedback: 'Smaller please' } },
    });

    await vi.waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(edit.mock.calls[0])).toContain('Changes requested: Add dark mode');
    expect(JSON.stringify(edit.mock.calls[0])).not.toContain('factory_plan:approve');
    expect(cards.posted('call-1')).toBeUndefined();
  });

  it('ignores tool ends for calls that are not parked plans', async () => {
    const { cards, edit } = setup();
    await cards.post(REQUEST);
    const listeners: ((event: AgentControllerEvent) => void)[] = [];
    observeSessionPlanCards({ subscribe: (listener: never) => (listeners.push(listener), () => {}) } as never, cards);

    listeners.forEach(listener => listener({ type: 'tool_end', toolCallId: 'call-1', result: {} } as never));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(edit).not.toHaveBeenCalled();
  });
});
