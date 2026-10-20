import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { deliverFactorySessionNotification, resolveSessionThread } from './deliver.js';
import type { FactoryDeliveryController } from './deliver.js';

const ROW = {
  sessionId: 'session-b',
  orgId: 'org-1',
  userId: 'user-b',
  factoryProjectId: 'project-1',
  projectRepositoryId: 'repo-link-1',
} as SourceControlSession;

const MESSAGE = { kind: 'message', summary: 'Can you check the failing test?', priority: 'medium' as const };

function fakeSession(currentThreadId: string, running = false) {
  return {
    thread: { getId: vi.fn(() => currentThreadId), switch: vi.fn() },
    state: { get: () => ({}), set: vi.fn() },
    stream: { isActive: () => running },
    sendNotificationSignal: vi.fn(),
  };
}

function setup({
  thread = { id: 'thread-stored', resourceId: 'session-b' } as { id: string; resourceId: string } | null,
  offline = false,
  row = ROW as SourceControlSession | null,
  action = 'deliver',
  liveThreadId = 'thread-other',
  running = false,
} = {}) {
  const live = offline ? undefined : fakeSession(liveThreadId, running);
  const calls: string[] = [];
  const created = fakeSession('thread-stored');
  const agent = {
    sendNotificationSignal: vi.fn(async () => {
      calls.push('send');
      return { record: { id: 'notification-1' }, decision: { action }, persisted: Promise.resolve() };
    }),
  };
  const controller = {
    queryThreadById: vi.fn(async () => thread),
    queryThreads: vi.fn(async () => []),
    getSessionByResource: vi.fn(async () => live),
    createSession: vi.fn(async () => {
      calls.push('create');
      return created;
    }),
    getCurrentAgent: vi.fn(() => agent),
  };
  const sessions = { getBySessionId: vi.fn(async () => row) };
  return {
    calls,
    live,
    agent,
    created,
    controller,
    sessions,
    deliver: (options: { onlyIfLive?: boolean } = {}) =>
      deliverFactorySessionNotification({
        controller: controller as unknown as FactoryDeliveryController,
        sessions,
        target: { sessionId: 'session-b', threadId: 'thread-stored' },
        notification: MESSAGE,
        ...options,
      }),
  };
}

describe('deliverFactorySessionNotification', () => {
  it('sends to a live target through its agent on the stored thread, without switching threads', async () => {
    const { agent, controller, live, deliver } = setup();

    await expect(deliver()).resolves.toEqual({ delivered: 'woken', notificationId: 'notification-1' });

    expect(agent.sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(agent.sendNotificationSignal).toHaveBeenCalledWith(
      { ...MESSAGE, source: 'factory-session' },
      { resourceId: 'session-b', threadId: 'thread-stored' },
    );
    expect(live?.sendNotificationSignal).not.toHaveBeenCalled();
    expect(live?.thread.switch).not.toHaveBeenCalled();
    expect(controller.createSession).not.toHaveBeenCalled();
  });

  it('says mid-run only when the target thread itself is running (#27742)', async () => {
    await expect(setup({ running: true, liveThreadId: 'thread-stored' }).deliver()).resolves.toMatchObject({
      delivered: 'mid-run',
    });
    await expect(setup({ running: true, liveThreadId: 'thread-other' }).deliver()).resolves.toMatchObject({
      delivered: 'woken',
    });
  });

  it('refuses a thread that belongs to another resource, without looking up, creating or sending', async () => {
    const { agent, controller, deliver } = setup({
      offline: true,
      thread: { id: 'thread-stored', resourceId: 'session-victim' },
    });
    await expect(deliver()).resolves.toEqual({ delivered: 'skipped', reason: 'thread-not-owned' });
    expect(controller.getSessionByResource).not.toHaveBeenCalled();
    expect(controller.createSession).not.toHaveBeenCalled();
    expect(agent.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('creates an offline target as its row owner on the stored thread before sending', async () => {
    const { calls, controller, created, agent, deliver } = setup({ offline: true });

    await deliver();

    expect(calls).toEqual(['create', 'send']);
    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-b',
        ownerId: 'user-b',
        resourceId: 'session-b',
        threadId: 'thread-stored',
        tags: { factoryProjectId: 'project-1', projectRepositoryId: 'repo-link-1' },
      }),
    );
    const { requestContext } = (controller.createSession.mock.calls[0] as unknown as [{ requestContext: any }])[0];
    expect(requestContext.get('user')).toEqual({ workosId: 'user-b', organizationId: 'org-1' });
    expect(created.state.set).toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: 'org-1' }));
    expect(controller.getCurrentAgent).toHaveBeenCalledWith(created);
    expect(agent.sendNotificationSignal).toHaveBeenCalledWith(expect.anything(), {
      resourceId: 'session-b',
      threadId: 'thread-stored',
    });
  });

  it('skips a missing thread without creating or sending', async () => {
    const { controller, agent, deliver } = setup({ thread: null, offline: true });
    await expect(deliver()).resolves.toEqual({ delivered: 'skipped', reason: 'thread-not-found' });
    expect(controller.getSessionByResource).not.toHaveBeenCalled();
    expect(controller.createSession).not.toHaveBeenCalled();
    expect(agent.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('skips an offline target with no Factory session row without creating or sending', async () => {
    const { controller, agent, deliver } = setup({ offline: true, row: null });
    await expect(deliver()).resolves.toEqual({ delivered: 'skipped', reason: 'session-not-found' });
    expect(controller.createSession).not.toHaveBeenCalled();
    expect(agent.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('with onlyIfLive, skips an offline target without creating or sending', async () => {
    const { controller, sessions, agent, deliver } = setup({ offline: true });
    await expect(deliver({ onlyIfLive: true })).resolves.toEqual({ delivered: 'skipped', reason: 'offline' });
    expect(sessions.getBySessionId).not.toHaveBeenCalled();
    expect(controller.createSession).not.toHaveBeenCalled();
    expect(agent.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it.each([
    ['summarize', 'summarized'],
    ['persist', 'persisted'],
    ['defer', 'persisted'],
    ['queue', 'persisted'],
  ])('maps a %s verdict to %s', async (action, delivered) => {
    const { deliver } = setup({ action });
    await expect(deliver()).resolves.toMatchObject({ delivered, notificationId: 'notification-1' });
  });

  it('reports a discarded notification as skipped', async () => {
    const { deliver } = setup({ action: 'discard' });
    await expect(deliver()).resolves.toEqual({
      delivered: 'skipped',
      notificationId: 'notification-1',
      reason: 'discarded',
    });
  });

  it('stores the record on the target thread and resource, which deferred re-dispatch reuses', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'factory-agent',
      name: 'factory-agent',
      instructions: 'test',
      model: 'openai/gpt-4o',
    });
    new Mastra({ agents: { agent }, storage, logger: false });
    const live = fakeSession('thread-other');
    const controller = {
      queryThreadById: vi.fn(async () => ({ id: 'thread-stored', resourceId: 'session-b' })),
      queryThreads: vi.fn(),
      getSessionByResource: vi.fn(async () => live),
      createSession: vi.fn(),
      getCurrentAgent: vi.fn(() => agent),
    };

    // `low` is always summarized later, so nothing runs and no model is needed.
    const result = await deliverFactorySessionNotification({
      controller: controller as unknown as FactoryDeliveryController,
      sessions: { getBySessionId: vi.fn() },
      target: { sessionId: 'session-b', threadId: 'thread-stored' },
      notification: { ...MESSAGE, priority: 'low', attributes: { 'from-session': 'session-a' } },
    });

    expect(result.delivered).toBe('summarized');
    const notifications = await storage.getStore('notifications');
    const records = await notifications!.listNotifications({ threadId: 'thread-stored', source: 'factory-session' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: result.notificationId,
      threadId: 'thread-stored',
      resourceId: 'session-b',
      source: 'factory-session',
      kind: 'message',
      attributes: { 'from-session': 'session-a' },
    });
    expect(live.thread.switch).not.toHaveBeenCalled();
  });
});

describe('resolveSessionThread', () => {
  function threadSetup({
    binding = null as { threadId: string } | null,
    current = undefined as string | undefined,
    threads = [] as { id: string; updatedAt: Date }[],
  } = {}) {
    return resolveSessionThread({
      controller: {
        getSessionByResource: vi.fn(async () => (current ? fakeSession(current) : undefined)),
        queryThreads: vi.fn(async () => threads),
      } as unknown as FactoryDeliveryController,
      sessions: { getBySessionId: vi.fn(async () => ROW) },
      workItems: { findActiveRunBindingForSession: vi.fn(async () => binding) } as never,
      sessionId: 'session-b',
    });
  }

  it("prefers the role binding's thread over the session's current thread", async () => {
    await expect(threadSetup({ binding: { threadId: 'thread-role' }, current: 'thread-open' })).resolves.toBe(
      'thread-role',
    );
  });

  it('falls back to the thread the live session has open', async () => {
    await expect(threadSetup({ current: 'thread-open' })).resolves.toBe('thread-open');
  });

  it('falls back to the most recently updated thread, else null', async () => {
    await expect(
      threadSetup({
        threads: [
          { id: 'old', updatedAt: new Date('2026-10-01') },
          { id: 'new', updatedAt: new Date('2026-10-10') },
        ],
      }),
    ).resolves.toBe('new');
    await expect(threadSetup()).resolves.toBeNull();
  });
});
