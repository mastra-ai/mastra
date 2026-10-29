import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MAX_NOTIFICATION_DELIVERY_ATTEMPTS } from '../../notifications/delivery-policy';
import { dispatchDueNotifications } from '../../notifications/dispatcher';
import { InMemoryNotificationsStorage } from '../../notifications/storage';
import { createNotificationInboxTool } from '../../notifications/tool';
import { MastraCompositeStore } from '../../storage/base';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable';
import { createSignal } from '../signals';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  nextTick,
  AsyncCallbackPubSub,
  readNextRunWithParts,
  waitForActiveRun,
  waitForCondition,
  withTimeout,
} from './signals-test-utils';

describe('Agent signals: state and notification signals', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('persists external state signals with cache-key tracking', async () => {
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'state-thread', resourceId: 'state-user' });
    const agent = new Agent({
      id: 'state-agent',
      name: 'State Agent',
      instructions: 'Test',
      model: createTextStreamModel('state response'),
      memory,
    });

    const result = await agent.sendStateSignal(
      {
        id: 'browser',
        cacheKey: 'browser:v1',
        mode: 'snapshot',
        contents: 'Browser is open on https://example.com',
        value: { activeUrl: 'https://example.com' },
      },
      { resourceId: 'state-user', threadId: 'state-thread', ifIdle: { behavior: 'persist' } },
    );
    if (result.skipped) throw new Error('expected state signal to be persisted, not skipped');
    await expect(result.accepted).resolves.toMatchObject({ action: 'persist' });
    expect(result.signal).toBeDefined();

    expect(result.signal).toMatchObject({
      type: 'state',
      tagName: 'state',
      metadata: expect.objectContaining({
        state: expect.objectContaining({ id: 'browser', cacheKey: 'browser:v1', mode: 'snapshot', version: 1 }),
        value: { activeUrl: 'https://example.com' },
      }),
    });
    await expect(
      agent.sendStateSignal(
        { id: 'browser', cacheKey: 'browser:v1', contents: 'unchanged' },
        { resourceId: 'state-user', threadId: 'state-thread', ifIdle: { behavior: 'persist' } },
      ),
    ).resolves.toEqual({ skipped: true, reason: 'unchanged' });
    const thread = await memory.getThreadById({ threadId: 'state-thread' });
    expect(thread?.metadata?.mastra).toEqual(
      expect.objectContaining({
        stateSignals: expect.objectContaining({
          browser: expect.objectContaining({
            currentCacheKey: 'browser:v1',
            version: 1,
            lastSnapshotSignalId: result.signal!.id,
          }),
        }),
      }),
    );
  });

  it('sends notifications from a registered durable agent fork', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'fork-notification-storage', domains: { notifications } });
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'fork-notification-agent',
        name: 'Fork Notification Agent',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
      }),
    });
    const mastra = new Mastra({ agents: { forkNotificationAgent: agent }, storage, logger: false });
    const fork = agent.__fork();

    expect(fork.getMastraInstance()).toBe(mastra);
    const result = await fork.sendNotificationSignal(
      { source: 'github', kind: 'ci-status', summary: 'CI failed on main' },
      { resourceId: 'notification-user', threadId: 'notification-thread', ifIdle: { behavior: 'persist' } },
    );

    expect(result.record).toMatchObject({ agentId: agent.id, status: 'pending' });
    await expect(
      notifications.getNotification({ threadId: 'notification-thread', id: result.record.id }),
    ).resolves.toBeDefined();
  });

  it('uses the wrapped agent notification policy on durable agents and their forks', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'durable-policy-storage', domains: { notifications } });
    const deliverAt = new Date('2100-12-01T12:00:00Z');
    const decide = vi.fn(() => ({ action: 'defer' as const, deliverAt, reason: 'after-hours' }));
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'durable-policy-agent',
        name: 'Durable Policy Agent',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        notifications: { deliveryPolicy: { decide } },
      }),
    });
    new Mastra({ agents: { durablePolicyAgent: agent }, storage, logger: false });

    for (const target of [agent, agent.__fork()]) {
      const result = await target.sendNotificationSignal(
        { source: 'calendar', kind: 'event-reminder', summary: 'Planning starts tomorrow' },
        { resourceId: 'notification-user', threadId: 'notification-thread' },
      );
      expect(result.decision).toMatchObject({ action: 'defer', reason: 'after-hours' });
      expect(result.record).toMatchObject({ status: 'pending', deliveryReason: 'after-hours' });
      expect(result.signal).toBeUndefined();
    }
    expect(decide).toHaveBeenCalledTimes(2);
  });

  it('delivers medium-priority notification records while idle', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'notification-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'notification-agent',
      name: 'Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
    });
    new Mastra({ agents: { notificationAgent: agent }, storage, logger: false });

    const subscription = await agent.subscribeToThread({
      threadId: 'notification-thread',
      resourceId: 'notification-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const result = await agent.sendNotificationSignal(
      {
        source: 'github',
        kind: 'ci-status',
        priority: 'medium',
        summary: 'CI failed on main',
        dedupeKey: 'main-ci',
      },
      {
        resourceId: 'notification-user',
        threadId: 'notification-thread',
        ifIdle: { streamOptions: { memory: { resource: 'notification-user', thread: 'notification-thread' } } },
      },
    );

    const subscribedRun = await nextRun;
    expect(result).toEqual(expect.objectContaining({ runId: subscribedRun.value.runId }));
    await expect(result.accepted).resolves.toMatchObject({ action: 'wake', runId: subscribedRun.value.runId });
    expect(result.decision).toMatchObject({ action: 'deliver' });
    expect(result.record).toMatchObject({
      agentId: 'notification-agent',
      resourceId: 'notification-user',
      threadId: 'notification-thread',
      status: 'delivered',
      deliveredSignalId: result.signal?.id,
    });
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-signal');
    expect(signalPart?.data).toMatchObject({
      id: result.signal?.id,
      type: 'notification',
      tagName: 'notification',
      contents: 'CI failed on main',
      attributes: { source: 'github', kind: 'ci-status', priority: 'medium', status: 'delivered' },
    });
    await expect(
      notifications.getNotification({ threadId: 'notification-thread', id: result.record.id }),
    ).resolves.toMatchObject({ status: 'delivered', deliveredSignalId: result.signal?.id });

    subscription.unsubscribe();
  });

  it('attaches delivery-policy stream options to immediate idle deliveries', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'notification-storage', domains: { notifications } });
    const streamOptions = { memory: { resource: 'notification-user', thread: 'notification-thread' } };
    const agent = new Agent({
      id: 'notification-agent',
      name: 'Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
      notifications: { deliveryPolicy: { decide: () => ({ action: 'deliver', streamOptions }) } },
    });
    new Mastra({ agents: { notificationAgent: agent }, storage, logger: false });
    const sendSignalSpy = vi.spyOn(agentThreadStreamRuntime, 'sendSignal');

    const result = await agent.sendNotificationSignal(
      { source: 'github', kind: 'ci-status', priority: 'medium', summary: 'CI failed on main' },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );

    await result.accepted;
    expect(sendSignalSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ ifIdle: expect.objectContaining({ streamOptions }) }),
      expect.anything(),
    );
    sendSignalSpy.mockRestore();
  });

  it('keeps caller-supplied stream options over the delivery policy on immediate deliveries', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'notification-storage', domains: { notifications } });
    const policyOptions = { memory: { resource: 'policy-user', thread: 'policy-thread' } };
    const callerOptions = { memory: { resource: 'notification-user', thread: 'notification-thread' } };
    const agent = new Agent({
      id: 'notification-agent',
      name: 'Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
      notifications: { deliveryPolicy: { decide: () => ({ action: 'deliver', streamOptions: policyOptions }) } },
    });
    new Mastra({ agents: { notificationAgent: agent }, storage, logger: false });
    const sendSignalSpy = vi.spyOn(agentThreadStreamRuntime, 'sendSignal');

    const result = await agent.sendNotificationSignal(
      { source: 'github', kind: 'ci-status', priority: 'medium', summary: 'CI failed on main' },
      {
        resourceId: 'notification-user',
        threadId: 'notification-thread',
        ifIdle: { streamOptions: callerOptions },
      },
    );

    await result.accepted;
    expect(sendSignalSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ ifIdle: expect.objectContaining({ streamOptions: callerOptions }) }),
      expect.anything(),
    );
    sendSignalSpy.mockRestore();
  });

  it('resolves delivery-policy stream options through a real agent when dispatching deferred notifications', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'notification-storage', domains: { notifications } });
    const streamOptions = { memory: { resource: 'notification-user', thread: 'notification-thread' } };
    const agent = new Agent({
      id: 'notification-agent',
      name: 'Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
      notifications: { deliveryPolicy: { decide: () => ({ action: 'deliver', streamOptions }) } },
    });
    const mastra = new Mastra({ agents: { notificationAgent: agent }, storage, logger: false });
    const now = new Date();
    await notifications.createNotification({
      id: 'deferred-1',
      agentId: 'notification-agent',
      resourceId: 'notification-user',
      threadId: 'notification-thread',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed on main',
      deliverAt: now,
    });
    const sendSignalSpy = vi.spyOn(agent, 'sendSignal');

    const result = await dispatchDueNotifications({ mastra, storage: notifications, now });

    expect(result.failed).toEqual([]);
    expect(result.delivered).toHaveLength(1);
    expect(sendSignalSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ifIdle: { streamOptions } }),
    );
    sendSignalSpy.mockRestore();
  });

  it('delivers batched idle notifications using one initial thread-state decision', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'notification-batch-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'notification-batch-agent',
      name: 'Notification Batch Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification batch response'),
    });
    new Mastra({ agents: { notificationBatchAgent: agent }, storage, logger: false });

    const results = await agent.sendNotificationSignal(
      [
        { source: 'github', kind: 'pull-request-ci-failure', priority: 'high', summary: 'CI failed' },
        { source: 'github', kind: 'pull-request-activity', priority: 'high', summary: 'Devin commented' },
      ],
      { resourceId: 'notification-batch-user', threadId: 'notification-batch-thread' },
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ decision: { action: 'deliver', reason: 'idle-high' } });
    await expect(results[0]?.accepted).resolves.toMatchObject({ action: expect.stringMatching(/wake|deliver/) });
    expect(results[0]?.signal).toMatchObject({ type: 'notification', tagName: 'notification' });
    expect(results[0]?.record).toMatchObject({ status: 'delivered', deliveredSignalId: results[0]?.signal?.id });
    expect(results[1]).toMatchObject({ decision: { action: 'deliver', reason: 'idle-high' } });
    await expect(results[1]?.accepted).resolves.toMatchObject({ action: expect.stringMatching(/wake|deliver/) });
    expect(results[1]?.signal).toMatchObject({ type: 'notification', tagName: 'notification' });
    expect(results[1]?.record).toMatchObject({ status: 'delivered', deliveredSignalId: results[1]?.signal?.id });
  });

  it('wakes idle threads for immediate medium-priority notification summaries', async () => {
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'medium-summary-wake-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'medium-summary-wake-agent',
      name: 'Medium Summary Wake Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          };
        },
      }),
      notifications: {
        deliveryPolicy: {
          decide: ({ now }) => ({ action: 'summarize', summaryAt: now, reason: 'test-medium-summary-now' }),
        },
      },
    });
    new Mastra({ agents: { mediumSummaryWakeAgent: agent }, storage, logger: false });
    const subscription = await agent.subscribeToThread({
      threadId: 'medium-summary-wake-thread',
      resourceId: 'medium-summary-wake-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const result = await agent.sendNotificationSignal(
      { source: 'github', kind: 'pull-request-activity', priority: 'medium', summary: 'Devin commented' },
      { resourceId: 'medium-summary-wake-user', threadId: 'medium-summary-wake-thread' },
    );
    const subscribedRun = await withTimeout(nextRun, 'Timed out waiting for medium notification summary wake');
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-signal');

    expect(result.signal).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(result.decision).toMatchObject({ action: 'summarize', reason: 'test-medium-summary-now' });
    expect(result.record).toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: result.signal?.id,
    });
    expect(signalPart?.data).toMatchObject({
      id: result.signal?.id,
      type: 'notification',
      tagName: 'notification-summary',
      contents: 'github: 1',
      attributes: { pending: 1 },
    });
    expect(streamCount).toBe(1);

    subscription.unsubscribe();
  });

  it('keeps immediate notification records pending when runtime rejects delivery', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'rejected-notification-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'rejected-notification-agent',
      name: 'Rejected Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
    });
    new Mastra({ agents: { rejectedNotificationAgent: agent }, storage, logger: false });
    const rejectedAccepted = Promise.reject(new Error('signal rejected'));
    // Attach a no-op catch so the rejection is considered handled and never surfaces as an
    // unhandled rejection; the dispatcher attaches its own awaiting handler in try/catch.
    rejectedAccepted.catch(() => {});
    const sendSignal = vi.spyOn(agentThreadStreamRuntime, 'sendSignal').mockReturnValue({
      accepted: rejectedAccepted,
      signal: createSignal({ type: 'notification', tagName: 'notification', contents: 'Rejected' }),
    } as any);

    try {
      const result = await agent.sendNotificationSignal(
        { source: 'github', kind: 'ci-status', priority: 'medium', summary: 'Rejected notification' },
        { resourceId: 'notification-user', threadId: 'notification-thread' },
      );

      expect(result.accepted).toBeUndefined();
      expect(result.record).toMatchObject({
        status: 'pending',
        deliveryAttempts: 1,
        lastDeliveryError: 'signal rejected',
      });
      expect(result.record.deliveredSignalId).toBeUndefined();
      const stored = await notifications.getNotification({ threadId: 'notification-thread', id: result.record.id });
      expect(stored).toMatchObject({ status: 'pending', deliveryAttempts: 1 });
      expect(stored?.deliveredSignalId).toBeUndefined();
    } finally {
      sendSignal.mockRestore();
    }
  });

  it('schedules a notification for retry when the delivery policy throws at send time', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'throwing-policy-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'throwing-policy-agent',
      name: 'Throwing Policy Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      notifications: {
        deliveryPolicy: {
          decide: () => {
            throw new Error('owner unavailable');
          },
        },
      },
    });
    const mastra = new Mastra({ agents: { throwingPolicyAgent: agent }, storage, logger: false });
    const ensureDispatch = vi.spyOn(mastra, '__ensureNotificationDispatchReady').mockResolvedValue(undefined as any);
    const sendSignal = vi.spyOn(agentThreadStreamRuntime, 'sendSignal');

    try {
      const result = await agent.sendNotificationSignal(
        { source: 'github', kind: 'ci-status', priority: 'high', summary: 'Policy throws' },
        { resourceId: 'notification-user', threadId: 'notification-thread' },
      );

      expect(sendSignal).not.toHaveBeenCalled();
      expect(result.signal).toBeUndefined();
      expect(result.record).toMatchObject({
        status: 'pending',
        deliveryAttempts: 1,
        lastDeliveryError: 'owner unavailable',
      });
      expect(result.record.deliverAt).toBeInstanceOf(Date);
      expect(ensureDispatch).toHaveBeenCalled();
      const due = await notifications.listDueNotifications({ now: new Date(Date.now() + 1000) });
      expect(due.map(record => record.id)).toContain(result.record.id);
    } finally {
      sendSignal.mockRestore();
      ensureDispatch.mockRestore();
    }
  });

  it('keeps a rejected notification summary due for retry', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'rejected-summary-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'rejected-summary-agent',
      name: 'Rejected Summary Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      notifications: {
        deliveryPolicy: {
          decide: ({ now }) => ({ action: 'summarize', summaryAt: now, reason: 'test-summary-now' }),
        },
      },
    });
    const mastra = new Mastra({ agents: { rejectedSummaryAgent: agent }, storage, logger: false });
    const rejectedAccepted = Promise.reject(new Error('summary rejected'));
    rejectedAccepted.catch(() => {});
    const sendSignal = vi.spyOn(agentThreadStreamRuntime, 'sendSignal').mockReturnValue({
      accepted: rejectedAccepted,
      signal: createSignal({ type: 'notification', tagName: 'notification-summary', contents: 'Rejected' }),
    } as any);

    try {
      const result = await agent.sendNotificationSignal(
        { source: 'github', kind: 'ci-status', priority: 'medium', summary: 'Rejected summary' },
        { resourceId: 'summary-user', threadId: 'summary-thread' },
      );

      expect(result.record).toMatchObject({
        status: 'pending',
        deliveryAttempts: 1,
        lastDeliveryError: 'summary rejected',
      });
      const stored = await notifications.getNotification({ threadId: 'summary-thread', id: result.record.id });
      expect(stored?.summaryAt).toBeInstanceOf(Date);
      await expect(notifications.listDueNotifications({ now: new Date() })).resolves.toMatchObject([
        { id: result.record.id },
      ]);

      for (let attempt = 2; attempt <= MAX_NOTIFICATION_DELIVERY_ATTEMPTS; attempt++) {
        await dispatchDueNotifications({ mastra, storage: notifications, now: new Date() });
        await expect(
          notifications.getNotification({ threadId: 'summary-thread', id: result.record.id }),
        ).resolves.toMatchObject({ deliveryAttempts: attempt });
      }

      await expect(
        notifications.getNotification({ threadId: 'summary-thread', id: result.record.id }),
      ).resolves.toMatchObject({ status: 'failed', deliveryAttempts: MAX_NOTIFICATION_DELIVERY_ATTEMPTS });
      await expect(notifications.listDueNotifications({ now: new Date() })).resolves.toEqual([]);

      await dispatchDueNotifications({ mastra, storage: notifications, now: new Date() });
      expect(sendSignal).toHaveBeenCalledTimes(MAX_NOTIFICATION_DELIVERY_ATTEMPTS);
    } finally {
      sendSignal.mockRestore();
    }
  });

  it('batches active high notifications for full delivery and active medium or low notifications for summaries', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'active-priority-notification-storage',
      domains: { notifications },
    });
    const responseText = 'active response';
    const model = new MockLanguageModelV2({
      doStream: async () => {
        streamCount += 1;
        const currentStream = streamCount;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: `text-${currentStream}` });
              controller.enqueue({ type: 'text-delta', id: `text-${currentStream}`, delta: responseText });
              controller.enqueue({ type: 'text-end', id: `text-${currentStream}` });
              if (currentStream === 1) await firstFinished;
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const agent = new Agent({
      id: 'active-priority-notification-agent',
      name: 'Active Priority Notification Agent',
      instructions: 'Test',
      model,
    });
    new Mastra({ agents: { activePriorityNotificationAgent: agent }, storage, logger: false });
    const subscription = await agent.subscribeToThread({
      threadId: 'active-priority-notification-thread',
      resourceId: 'active-priority-notification-user',
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-priority-notification-thread', resource: 'active-priority-notification-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => stream._getImmediateText() === 'active response');

    const high = await agent.sendNotificationSignal(
      { source: 'github', kind: 'ci-status', priority: 'high', summary: 'CI failed' },
      { resourceId: 'active-priority-notification-user', threadId: 'active-priority-notification-thread' },
    );
    const medium = await agent.sendNotificationSignal(
      { source: 'slack', kind: 'mention', priority: 'medium', summary: 'Jane mentioned you' },
      { resourceId: 'active-priority-notification-user', threadId: 'active-priority-notification-thread' },
    );
    const low = await agent.sendNotificationSignal(
      { source: 'calendar', kind: 'event-reminder', priority: 'low', summary: 'Standup starts soon' },
      { resourceId: 'active-priority-notification-user', threadId: 'active-priority-notification-thread' },
    );

    expect(high.signal).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(high.decision).toMatchObject({ action: 'summarize', reason: 'active-high-summary-then-full' });
    expect(high.record).toMatchObject({
      status: 'pending',
      deliveryReason: 'active-high-summary-then-full',
      summarySignalId: high.signal?.id,
    });
    expect(high.record.summaryAt).toBeUndefined();
    expect(high.record.deliverAt).toBeInstanceOf(Date);
    expect(medium.signal).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(medium.decision).toMatchObject({ action: 'summarize', reason: 'active-batch-summary' });
    expect(medium.record).toMatchObject({
      status: 'pending',
      deliveryReason: 'active-batch-summary',
      summarySignalId: medium.signal?.id,
    });
    expect(medium.record.summaryAt).toBeUndefined();
    expect(low.signal).toBeUndefined();
    expect(low.decision).toMatchObject({ action: 'summarize', reason: 'active-batch-summary' });
    expect(low.record).toMatchObject({ status: 'pending', deliveryReason: 'active-batch-summary' });
    expect(low.record.summaryAt).toBeInstanceOf(Date);

    releaseFirst();
    // The high-priority summary signal is delivered to the active run, which the
    // agentic loop picks up and processes with an additional model iteration.
    await expect(stream.text).resolves.toBe('active responseactive response');
    expect(streamCount).toBe(2);
    subscription.unsubscribe();
  });

  it('summarizes active high-priority notifications immediately, then delivers full notifications when idle', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'high-active-integration-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'high-active-integration-agent',
      name: 'High Active Integration Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          const responseText = `response ${streamCount}`;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (streamCount === 1) {
                  await firstFinished;
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { highActiveIntegrationAgent: agent }, storage, logger: false });
    const subscription = await agent.subscribeToThread({
      threadId: 'high-active-thread',
      resourceId: 'high-active-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'high-active-thread', resource: 'high-active-user' },
    });
    const streamText = stream.text;
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => stream._getImmediateText() === 'response 1');

    const result = await agent.sendNotificationSignal(
      { source: 'github', kind: 'ci-status', priority: 'high', summary: 'CI failed on main' },
      { resourceId: 'high-active-user', threadId: 'high-active-thread' },
    );

    expect(result.signal).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(result.decision).toMatchObject({ action: 'summarize', reason: 'active-high-summary-then-full' });
    expect(result.record).toMatchObject({
      status: 'pending',
      summarySignalId: result.signal?.id,
      deliveryReason: 'active-high-summary-then-full',
    });
    expect(result.record.summaryAt).toBeUndefined();
    expect(result.record.deliverAt).toBeInstanceOf(Date);

    releaseFirst();
    const subscribedSummary = await withTimeout(firstRun, 'Timed out waiting for high-priority summary signal');
    const summaryPart = subscribedSummary.value.parts.find((part: any) => part.type === 'data-signal');
    expect(summaryPart?.data).toMatchObject({
      id: result.signal?.id,
      type: 'notification',
      tagName: 'notification-summary',
      contents: 'github: 1',
      attributes: { pending: 1 },
    });
    // The summary signal is delivered to the active run, triggering an additional model iteration.
    expect(streamCount).toBe(2);
    await expect(
      notifications.getNotification({ threadId: 'high-active-thread', id: result.record.id }),
    ).resolves.toMatchObject({
      status: 'pending',
      summarySignalId: result.signal?.id,
      summaryAt: undefined,
      deliverAt: result.record.deliverAt,
    });

    const deliveryRun = readNextRunWithParts(iterator);
    const dispatchResult = await dispatchDueNotifications({ mastra, storage: notifications, now: new Date() });
    const subscribedDelivery = await withTimeout(deliveryRun, 'Timed out waiting for full high-priority delivery');
    const deliveryPart = subscribedDelivery.value.parts.find((part: any) => part.type === 'data-signal');

    expect(dispatchResult.failed).toEqual([]);
    expect(dispatchResult.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification' });
    expect(deliveryPart?.data).toMatchObject({
      id: dispatchResult.signals[0]?.id,
      type: 'notification',
      tagName: 'notification',
      contents: 'CI failed on main',
      attributes: { source: 'github', kind: 'ci-status', priority: 'high', status: 'delivered' },
    });
    await expect(
      notifications.getNotification({ threadId: 'high-active-thread', id: result.record.id }),
    ).resolves.toMatchObject({
      status: 'delivered',
      deliveredSignalId: dispatchResult.signals[0]?.id,
    });
    await streamText;

    subscription.unsubscribe();
  });

  it('plans due notifications by thread so medium summaries cannot starve high full delivery', async () => {
    let releaseRun!: () => void;
    const runFinished = new Promise<void>(resolve => {
      releaseRun = resolve;
    });
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'priority-dispatch-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'priority-dispatch-agent',
      name: 'Priority Dispatch Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'notification response' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              await runFinished;
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        }),
      }),
    });
    const mastra = new Mastra({ agents: { priorityDispatchAgent: agent }, storage, logger: false });
    const dueAt = new Date('2026-06-05T22:56:00Z');
    await notifications.createNotification({
      id: 'medium-ci-pending',
      agentId: 'priority-dispatch-agent',
      resourceId: 'priority-dispatch-user',
      threadId: 'priority-dispatch-thread',
      source: 'github',
      kind: 'pull-request-ci-pending',
      priority: 'medium',
      summary: 'CI is still pending',
      summaryAt: dueAt,
      createdAt: new Date('2026-06-05T22:55:00Z'),
    });
    const high = await notifications.createNotification({
      id: 'high-comment',
      agentId: 'priority-dispatch-agent',
      resourceId: 'priority-dispatch-user',
      threadId: 'priority-dispatch-thread',
      source: 'github',
      kind: 'pull-request-activity',
      priority: 'high',
      summary: 'Devin commented',
      deliverAt: dueAt,
      deliveryReason: 'active-high-summary-then-full',
      createdAt: new Date('2026-06-05T22:55:01Z'),
    });
    await notifications.updateNotification({
      id: high.id,
      threadId: high.threadId,
      summarySignalId: 'previous-summary-signal',
    });

    const dispatchResult = await dispatchDueNotifications({ mastra, storage: notifications, now: dueAt });

    expect(dispatchResult.failed).toEqual([]);
    expect(dispatchResult.signals.map(signal => signal.contents)).toEqual(['Devin commented', 'github: 1']);
    await expect(
      notifications.getNotification({ threadId: 'priority-dispatch-thread', id: 'high-comment' }),
    ).resolves.toMatchObject({
      status: 'delivered',
      deliveredSignalId: dispatchResult.signals[0]?.id,
    });
    await expect(
      notifications.getNotification({ threadId: 'priority-dispatch-thread', id: 'medium-ci-pending' }),
    ).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: dispatchResult.signals[1]?.id,
    });

    releaseRun();
    await nextTick();
  });

  it('dispatches medium-priority active summaries through agent subscriptions without marking records delivered', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'medium-active-dispatch-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'medium-active-dispatch-agent',
      name: 'Medium Active Dispatch Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          const responseText = `medium response ${streamCount}`;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (streamCount === 1) await firstFinished;
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { mediumActiveDispatchAgent: agent }, storage, logger: false });
    const subscription = await agent.subscribeToThread({
      threadId: 'medium-active-thread',
      resourceId: 'medium-active-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);

    await notifications.createNotification({
      id: 'medium-active-notification',
      agentId: 'medium-active-dispatch-agent',
      resourceId: 'medium-active-user',
      threadId: 'medium-active-thread',
      source: 'slack',
      kind: 'mention',
      priority: 'medium',
      summary: 'Jane mentioned you',
      summaryAt: new Date('2026-05-30T12:00:00Z'),
    });
    const stream = await agent.stream('Hello', {
      memory: { thread: 'medium-active-thread', resource: 'medium-active-user' },
    });
    const streamText = stream.text;
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => stream._getImmediateText() === 'medium response 1');

    const dispatchResult = await dispatchDueNotifications({
      mastra,
      storage: notifications,
      now: new Date('2026-05-30T12:00:01Z'),
    });
    expect(dispatchResult.failed).toEqual([]);
    expect(dispatchResult.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });

    releaseFirst();
    const subscribedSummary = await withTimeout(firstRun, 'Timed out waiting for medium active summary signal');
    const summaryPart = subscribedSummary.value.parts.find((part: any) => part.type === 'data-signal');
    expect(summaryPart?.data).toMatchObject({
      id: dispatchResult.signals[0]?.id,
      type: 'notification',
      tagName: 'notification-summary',
      contents: 'slack: 1',
      attributes: { pending: 1 },
    });
    // The summary signal is delivered to the active run, triggering an additional model iteration.
    expect(streamCount).toBe(2);
    await expect(
      notifications.getNotification({ threadId: 'medium-active-thread', id: 'medium-active-notification' }),
    ).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: dispatchResult.signals[0]?.id,
    });
    await streamText;

    subscription.unsubscribe();
  });

  it('saves and dispatches low-priority idle notification summaries through agent subscriptions without starting a run', async () => {
    let streamCount = 0;
    const pubsub = new AsyncCallbackPubSub();
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'low-priority-notification-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'low-priority-notification-agent',
      name: 'Low Priority Notification Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { lowPriorityNotificationAgent: agent }, storage, logger: false, pubsub });
    const subscription = await agent.subscribeToThread({
      threadId: 'notification-thread',
      resourceId: 'notification-user',
    });

    const result = await agent.sendNotificationSignal(
      { source: 'mastracode', kind: 'manual', priority: 'low', summary: 'Read when you have time' },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );

    await nextTick();
    expect(streamCount).toBe(0);
    expect(result.signal).toBeUndefined();
    expect(result.accepted).toBeUndefined();
    expect(result).toMatchObject({
      decision: { action: 'summarize', reason: 'idle-low-summary' },
      record: { status: 'pending', deliveryReason: 'idle-low-summary' },
    });
    expect(result.record.deliverAt).toBeUndefined();
    expect(result.record.summaryAt).toBeInstanceOf(Date);

    const dispatchNow = new Date((result.record.summaryAt?.getTime() ?? Date.now()) + 1);
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const dispatchResult = await dispatchDueNotifications({ mastra, storage: notifications, now: dispatchNow });
    const subscribedRun = await withTimeout(
      nextRun,
      'Timed out waiting for low-priority notification summary broadcast',
    );

    expect(dispatchResult.failed).toEqual([]);
    expect(dispatchResult.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(streamCount).toBe(0);
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-signal');
    expect(signalPart?.data).toMatchObject({
      id: dispatchResult.signals[0]?.id,
      type: 'notification',
      tagName: 'notification-summary',
      contents: 'mastracode: 1',
      attributes: { pending: 1 },
    });
    await expect(
      notifications.getNotification({ threadId: 'notification-thread', id: result.record.id }),
    ).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: dispatchResult.signals[0]?.id,
    });

    subscription.unsubscribe();
  });

  it('notification inbox read injects a real notification signal through agent subscriptions', async () => {
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'inbox-read-delivery-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'inbox-read-delivery-agent',
      name: 'Inbox Read Delivery Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { inboxReadDeliveryAgent: agent }, storage, logger: false });
    const tool = createNotificationInboxTool({ storage: notifications });
    await notifications.createNotification({
      id: 'inbox-read-notification',
      agentId: 'inbox-read-delivery-agent',
      resourceId: 'inbox-read-user',
      threadId: 'inbox-read-thread',
      source: 'github',
      kind: 'ci-status',
      priority: 'medium',
      summary: 'CI failed on main',
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'inbox-read-thread',
      resourceId: 'inbox-read-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const result = await tool.execute?.({ action: 'read', id: 'inbox-read-notification' }, {
      agent: { agentId: 'inbox-read-delivery-agent', threadId: 'inbox-read-thread', resourceId: 'inbox-read-user' },
      mastra,
    } as any);
    const subscribedRun = await withTimeout(nextRun, 'Timed out waiting for inbox read notification delivery');
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-signal');

    expect(result).toMatchObject({ message: '1 notification will now be delivered.', delivered: 1 });
    expect(signalPart?.data).toMatchObject({
      type: 'notification',
      tagName: 'notification',
      contents: 'CI failed on main',
      attributes: { source: 'github', kind: 'ci-status', priority: 'medium', status: 'delivered' },
    });
    expect(streamCount).toBe(1);
    await expect(
      notifications.getNotification({ threadId: 'inbox-read-thread', id: 'inbox-read-notification' }),
    ).resolves.toMatchObject({
      status: 'seen',
      deliveredSignalId: signalPart?.data.id,
    });

    subscription.unsubscribe();
  });

  it('notification inbox read marks already-delivered notifications seen without injecting another signal', async () => {
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'inbox-read-already-delivered-storage',
      domains: { notifications },
    });
    const agent = new Agent({
      id: 'inbox-read-already-delivered-agent',
      name: 'Inbox Read Already Delivered Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { inboxReadAlreadyDeliveredAgent: agent }, storage, logger: false });
    const tool = createNotificationInboxTool({ storage: notifications });
    await notifications.createNotification({
      id: 'already-delivered-notification',
      agentId: 'inbox-read-already-delivered-agent',
      resourceId: 'already-delivered-user',
      threadId: 'already-delivered-thread',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed earlier',
    });
    await notifications.updateNotification({
      threadId: 'already-delivered-thread',
      id: 'already-delivered-notification',
      status: 'delivered',
      deliveredSignalId: 'existing-signal-id',
    });

    const result = await tool.execute?.({ action: 'read', id: 'already-delivered-notification' }, {
      agent: {
        agentId: 'inbox-read-already-delivered-agent',
        threadId: 'already-delivered-thread',
        resourceId: 'already-delivered-user',
      },
      mastra,
    } as any);

    expect(result).toMatchObject({ delivered: 0, markedSeen: 1, message: 'No unread notifications needed delivery.' });
    expect(streamCount).toBe(0);
    await expect(
      notifications.getNotification({ threadId: 'already-delivered-thread', id: 'already-delivered-notification' }),
    ).resolves.toMatchObject({
      status: 'seen',
      deliveredSignalId: 'existing-signal-id',
    });
  });

  it('dispatches low-priority idle notification summaries without subscribers', async () => {
    let streamCount = 0;
    const pubsub = new AsyncCallbackPubSub();
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'no-subscriber-notification-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'no-subscriber-notification-agent',
      name: 'No Subscriber Notification Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
    });
    const mastra = new Mastra({ agents: { noSubscriberNotificationAgent: agent }, storage, logger: false, pubsub });

    const result = await agent.sendNotificationSignal(
      { source: 'mastracode', kind: 'manual', priority: 'low', summary: 'No one is watching' },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );
    const dispatchNow = new Date((result.record.summaryAt?.getTime() ?? Date.now()) + 1);
    const dispatchResult = await withTimeout(
      dispatchDueNotifications({ mastra, storage: notifications, now: dispatchNow }),
      'Timed out dispatching low-priority notification summary without subscribers',
    );

    expect(dispatchResult.failed).toEqual([]);
    expect(dispatchResult.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(streamCount).toBe(0);
    await expect(
      notifications.getNotification({ threadId: 'notification-thread', id: result.record.id }),
    ).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: dispatchResult.signals[0]?.id,
    });
  });

  it('defers notification records without starting an idle run', async () => {
    let streamCount = 0;
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'deferred-notification-storage', domains: { notifications } });
    const deliverAt = new Date('2026-05-30T12:00:00Z');
    const agent = new Agent({
      id: 'deferred-notification-agent',
      name: 'Deferred Notification Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
      notifications: {
        deliveryPolicy: {
          decide: () => ({ action: 'defer', deliverAt, reason: 'after-hours' }),
        },
      },
    });
    new Mastra({ agents: { deferredNotificationAgent: agent }, storage, logger: false });

    const result = await agent.sendNotificationSignal(
      {
        source: 'calendar',
        kind: 'event-reminder',
        summary: 'Planning starts tomorrow',
      },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );

    await nextTick();
    expect(streamCount).toBe(0);
    expect(result).toMatchObject({
      decision: { action: 'defer', reason: 'after-hours' },
      record: { status: 'pending', deliveryReason: 'after-hours' },
    });
    expect(result.signal).toBeUndefined();
    expect(result.accepted).toBeUndefined();
    expect(result.record.deliverAt?.toISOString()).toBe(deliverAt.toISOString());
  });

  it('coalesces pending notification records through sendNotificationSignal', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'coalesced-notification-storage', domains: { notifications } });
    const agent = new Agent({
      id: 'coalesced-notification-agent',
      name: 'Coalesced Notification Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
      notifications: {
        deliveryPolicy: {
          default: { action: 'summarize', summaryAt: new Date('2026-05-30T12:00:00Z') },
        },
      },
    });
    new Mastra({ agents: { coalescedNotificationAgent: agent }, storage, logger: false });

    const first = await agent.sendNotificationSignal(
      {
        source: 'github',
        kind: 'ci-status',
        summary: 'CI failed: one test',
        dedupeKey: 'main-ci',
      },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );
    const second = await agent.sendNotificationSignal(
      {
        source: 'github',
        kind: 'ci-status',
        summary: 'CI failed: three tests',
        dedupeKey: 'main-ci',
      },
      { resourceId: 'notification-user', threadId: 'notification-thread' },
    );

    expect(second.record.id).toBe(first.record.id);
    expect(second.record).toMatchObject({ status: 'pending', summary: 'CI failed: three tests', coalescedCount: 2 });
    await expect(notifications.listNotifications({ threadId: 'notification-thread' })).resolves.toHaveLength(1);
  });

  it('throws a clear error when notification storage is missing', async () => {
    const agent = new Agent({
      id: 'missing-notification-storage-agent',
      name: 'Missing Notification Storage Agent',
      instructions: 'Test',
      model: createTextStreamModel('notification response'),
    });

    await expect(
      agent.sendNotificationSignal(
        { source: 'github', kind: 'ci-status', summary: 'CI failed' },
        { resourceId: 'notification-user', threadId: 'notification-thread' },
      ),
    ).rejects.toThrow('sendNotificationSignal requires a notifications storage domain');
  });
});
