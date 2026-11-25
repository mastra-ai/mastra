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

/** A durable card store shared across "processes", like the integrations table. */
function memoryStore() {
  const rows: { id: string; targetKey: string; threadId: string | null; data: Record<string, unknown> }[] = [];
  return {
    rows,
    create: vi.fn(async (input: { targetKey: string; threadId?: string | null; data: Record<string, unknown> }) => {
      const row = {
        id: `row-${rows.length + 1}`,
        targetKey: input.targetKey,
        threadId: input.threadId ?? null,
        data: input.data,
      };
      rows.push(row);
      return row as never;
    }),
    listByTarget: vi.fn(async (targetKey: string) => rows.filter(row => row.targetKey === targetKey) as never),
    delete: vi.fn(async (id: string) => {
      const at = rows.findIndex(row => row.id === id);
      if (at >= 0) rows.splice(at, 1);
      return at >= 0;
    }),
  };
}

function setup({
  failCard = false,
  earlier = [] as Record<string, unknown>[],
  store = undefined as ReturnType<typeof memoryStore> | undefined,
} = {}) {
  const edit = vi.fn(async () => ({}));
  const post = vi.fn(async (message: Record<string, unknown>) => {
    if (failCard && 'card' in message) throw new Error('invalid_blocks');
    return { id: 'msg-1', edit };
  });
  const editMessage = vi.fn(async () => ({}));
  const buildRenderContextForThread = vi.fn(async (threadId: string) =>
    threadId === 'thread-slack'
      ? { platform: 'slack', adapter: { editMessage }, chatThread: { id: 'slack:C1:1.2', post } }
      : null,
  );
  const listNotifications = vi.fn(async () => earlier);
  const cards = new PlanApprovalCards({
    channels: () => ({ buildRenderContextForThread }) as unknown as AgentChannels,
    sessions: { getBySessionId: async () => ({ factoryProjectId: 'factory-1', orgId: 'org-1' }) as never },
    notifications: async () => ({ listNotifications }) as never,
    ...(store ? { store: () => store } : {}),
  });
  return { cards, post, edit, editMessage, buildRenderContextForThread, listNotifications };
}

function observe(cards: PlanApprovalCards) {
  const listeners: ((event: AgentControllerEvent) => void)[] = [];
  observeSessionPlanCards({ subscribe: (listener: never) => (listeners.push(listener), () => {}) } as never, cards);
  return (event: Record<string, unknown>) => listeners.forEach(listener => listener(event as never));
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

  it('takes the Approve button off a card posted before a restart when the plan is answered after it', async () => {
    const store = memoryStore();
    await setup({ store }).cards.post(REQUEST);
    expect(store.rows).toEqual([
      expect.objectContaining({
        targetKey: 'factory-plan-card:call-1',
        threadId: 'thread-slack',
        data: expect.objectContaining({ messageId: 'msg-1', title: 'Add dark mode' }),
      }),
    ]);

    // A fresh process: nothing in memory, and the call parked before it started.
    const restarted = setup({ store });
    observe(restarted.cards)({
      type: 'tool_end',
      toolCallId: 'call-1',
      result: { content: 'Plan approved.', submittedPlan: { action: 'approved' } },
    });

    await vi.waitFor(() => expect(restarted.editMessage).toHaveBeenCalledTimes(1));
    const [threadId, messageId, card] = restarted.editMessage.mock.calls[0] as unknown as [string, string, unknown];
    expect([threadId, messageId]).toEqual(['slack:C1:1.2', 'msg-1']);
    expect(JSON.stringify(card)).toContain('Plan approved: Add dark mode');
    expect(JSON.stringify(card)).not.toContain('factory_plan:approve');
    await vi.waitFor(() => expect(store.rows).toEqual([]));
  });

  it('settles a card posted before a restart when a click finds its plan no longer waiting', async () => {
    const store = memoryStore();
    await setup({ store }).cards.post(REQUEST);
    const restarted = setup({ store });

    await restarted.cards.resolve('call-1', { kind: 'stale' });

    expect(JSON.stringify(restarted.editMessage.mock.calls[0])).toContain('Plan no longer waiting: Add dark mode');
    expect(JSON.stringify(restarted.editMessage.mock.calls[0])).not.toContain('factory_plan:approve');
    expect(store.rows).toEqual([]);
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
