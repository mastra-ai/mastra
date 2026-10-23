import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { WorkItemSubscription } from '../storage/domains/work-items/base.js';
import type { FactoryDeliveryTarget } from './deliver.js';
import {
  createStageChangeNotifier,
  createWorkItemRunEndReporter,
  hasFinalReport,
  reportNotification,
  sendRunEndReport,
} from './reports.js';
import type { FactoryReporting, FactoryRunOutcome } from './reports.js';

const SENDER = { sessionId: 'session-w', threadId: 'thread-session-w', userId: 'user-1' };
const PARENT = { sessionId: 'session-1', threadId: 'thread-session-1' };

function reporting() {
  const notifications = new InMemoryNotificationsStorage();
  const deliveries: Array<{
    target: FactoryDeliveryTarget;
    notification: Omit<SendNotificationSignalInput, 'source'>;
    options?: { onlyIfLive?: boolean };
  }> = [];
  const value: FactoryReporting = {
    notifications,
    deliver: vi.fn(async (target, notification, options) => {
      deliveries.push({ target, notification, ...(options ? { options } : {}) });
      const record = await notifications.createNotification({
        ...notification,
        source: 'factory-session',
        threadId: target.threadId,
        resourceId: target.sessionId,
      });
      return { notificationId: record.id, delivered: 'woken' as const };
    }),
  };
  const agentReport = (status: 'done' | 'failed' | 'blocked' | 'progress', sender = SENDER, to = PARENT) =>
    notifications.createNotification({
      ...reportNotification({ sender, status, message: `agent ${status}` }),
      source: 'factory-session',
      threadId: to.threadId,
      resourceId: to.sessionId,
    });
  return { notifications, deliveries, reporting: value, agentReport };
}

function subscriber(workItemId: string, sessionId: string): WorkItemSubscription {
  return {
    id: `sub-${sessionId}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId,
    sessionId,
    threadId: `thread-${sessionId}`,
    resourceId: sessionId,
    userId: 'user-1',
    reason: 'subscribed',
    createdAt: new Date(),
  };
}

describe('reportNotification', () => {
  it('carries the whole report as the summary, since that is all the recipient agent sees', () => {
    const message = `Triage done. ${'verdict '.repeat(100)}`;

    expect(reportNotification({ sender: SENDER, status: 'done', message })).toMatchObject({
      summary: message,
      payload: { message },
    });
  });
});

describe('hasFinalReport', () => {
  it('counts a reply that carries a final status', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    await env.notifications.createNotification({
      source: 'factory-session',
      kind: 'reply',
      priority: 'high',
      summary: 'answered and done',
      threadId: PARENT.threadId,
      resourceId: PARENT.sessionId,
      attributes: { 'from-session': SENDER.sessionId, status: 'done' },
    });
    await expect(
      hasFinalReport(env.notifications, {
        senderSessionId: SENDER.sessionId,
        recipientThreadId: PARENT.threadId,
        since,
        kinds: ['done', 'failed'],
      }),
    ).resolves.toBe(true);
  });

  it('finds a final report this sender made since the run started', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    await env.agentReport('done');
    await expect(
      hasFinalReport(env.notifications, {
        senderSessionId: SENDER.sessionId,
        recipientThreadId: PARENT.threadId,
        since,
        kinds: ['done', 'failed'],
      }),
    ).resolves.toBe(true);
  });

  it('ignores reports from an earlier run, from other senders, and of other kinds', async () => {
    const env = reporting();
    await env.agentReport('done');
    await env.agentReport('done', { ...SENDER, sessionId: 'session-other' });
    await env.agentReport('progress');
    const laterRun = new Date(Date.now() + 1000);
    const check = (since: Date, kinds: string[]) =>
      hasFinalReport(env.notifications, {
        senderSessionId: SENDER.sessionId,
        recipientThreadId: PARENT.threadId,
        since,
        kinds,
      });
    await expect(check(laterRun, ['done', 'failed'])).resolves.toBe(false);
    await expect(check(new Date(0), ['failed'])).resolves.toBe(false);
  });
});

describe('sendRunEndReport', () => {
  it('sends exactly one final report when the agent never reported', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT],
      since,
      outcome: { status: 'done' },
      subject: 'The side session "x"',
    });
    const records = await env.notifications.listNotifications({ threadId: PARENT.threadId });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'done',
      priority: 'high',
      summary: 'The side session "x" finished.',
      attributes: { backstop: 'true', 'from-session': SENDER.sessionId },
    });
    expect(records[0]!.coalesceKey).toBeUndefined();
    expect(records[0]!.dedupeKey).toBeUndefined();
  });

  it('skips a recipient that already has the agent’s own final report, and reaches the rest', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    const other = { sessionId: 'session-2', threadId: 'thread-session-2' };
    await env.agentReport('failed');
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT, other],
      since,
      outcome: { status: 'done' },
      subject: 'The work session for #7',
    });
    expect(env.deliveries.map(entry => entry.target)).toEqual([other]);
    expect(await env.notifications.listNotifications({ threadId: PARENT.threadId })).toHaveLength(1);
  });

  it('treats the agent’s own blocked report as final for blocked and done, but not for failed', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    await env.agentReport('blocked');
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT],
      since,
      outcome: { status: 'blocked', toolName: 'ask_user' },
      subject: 'The side session "x"',
    });
    expect(env.deliveries).toHaveLength(0);
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT],
      since,
      outcome: { status: 'done' },
      subject: 'The side session "x"',
    });
    expect(env.deliveries).toHaveLength(0);
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT],
      since,
      outcome: { status: 'failed', reason: 'boom' },
      subject: 'The side session "x"',
    });
    expect(env.deliveries.map(entry => entry.notification.kind)).toEqual(['failed']);
  });

  it('reports a failure that keeps repeating once, until something else is reported', async () => {
    // The guard compares creation times; keep each report in its own millisecond.
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    onTestFinished(() => void vi.useRealTimers());
    const tick = () => vi.setSystemTime(Date.now() + 1000);
    const env = reporting();
    const fail = (reason: string) => {
      tick();
      return sendRunEndReport(env.reporting, {
        sender: SENDER,
        recipients: [PARENT],
        since: new Date(),
        outcome: { status: 'failed', reason },
        subject: 'The work session for #7',
      });
    };
    await fail('no authenticated user');
    await fail('no authenticated user');
    await fail('no authenticated user');
    expect(env.deliveries).toHaveLength(1);
    await fail('provider overloaded');
    expect(env.deliveries).toHaveLength(2);
    tick();
    await env.agentReport('progress');
    await fail('provider overloaded');
    expect(env.deliveries).toHaveLength(3);
  });

  it('says a session finished once, not again for each later run that ends with nothing new', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    onTestFinished(() => void vi.useRealTimers());
    const tick = () => vi.setSystemTime(Date.now() + 1000);
    const env = reporting();
    const runEnds = (outcome: FactoryRunOutcome) => {
      tick();
      return sendRunEndReport(env.reporting, {
        sender: SENDER,
        recipients: [PARENT],
        since: new Date(),
        outcome,
        subject: 'The work session for #7',
      });
    };
    // The agent says it opened the PR, then comments, reviews and CI results wake it again.
    tick();
    await env.agentReport('done');
    await runEnds({ status: 'done' });
    await runEnds({ status: 'done' });
    await runEnds({ status: 'done' });
    expect(env.deliveries).toHaveLength(0);
    // A failure still goes out after a "done", and a later "done" goes out after it.
    await runEnds({ status: 'failed', reason: 'boom' });
    await runEnds({ status: 'done' });
    await runEnds({ status: 'done' });
    expect(env.deliveries.map(entry => entry.notification.kind)).toEqual(['failed', 'done']);
  });

  it('still reports a repeat failure when the earlier one was read after a newer report', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    onTestFinished(() => void vi.useRealTimers());
    const tick = () => vi.setSystemTime(Date.now() + 1000);
    const env = reporting();
    const fail = () => {
      tick();
      return sendRunEndReport(env.reporting, {
        sender: SENDER,
        recipients: [PARENT],
        since: new Date(),
        outcome: { status: 'failed', reason: 'no authenticated user' },
        subject: 'The work session for #7',
      });
    };
    await fail();
    tick();
    await env.agentReport('progress');
    // Reading the failure moves its `updatedAt` past the progress report.
    tick();
    const failure = (await env.notifications.listNotifications({ threadId: PARENT.threadId })).find(
      r => r.kind === 'failed',
    );
    await env.notifications.updateNotification({ id: failure!.id, threadId: PARENT.threadId, status: 'seen' });
    await fail();
    expect(env.deliveries).toHaveLength(2);
  });

  it('names the failure code and the parked tool', async () => {
    const env = reporting();
    const since = new Date(Date.now() - 1000);
    await sendRunEndReport(env.reporting, {
      sender: SENDER,
      recipients: [PARENT],
      since,
      outcome: { status: 'failed', failureCode: 'run_overdue', reason: 'took too long' },
      subject: 'The work session for #7',
    });
    await sendRunEndReport(env.reporting, {
      sender: { ...SENDER, sessionId: 'session-v' },
      recipients: [PARENT],
      since,
      outcome: { status: 'blocked', toolName: 'ask_user' },
      subject: 'The plan session for #7',
    });
    expect(env.deliveries[0]!.notification).toMatchObject({
      kind: 'failed',
      priority: 'urgent',
      summary: 'The work session for #7 failed (run_overdue): took too long',
      attributes: { 'failure-code': 'run_overdue' },
    });
    expect(env.deliveries[1]!.notification).toMatchObject({
      kind: 'blocked',
      priority: 'urgent',
      summary: 'The plan session for #7 is waiting on ask_user and needs an answer.',
      attributes: { 'parked-tool': 'ask_user' },
    });
  });
});

describe('createWorkItemRunEndReporter', () => {
  const workItems = (subscribers: WorkItemSubscription[]) => ({
    listWorkItemSubscribers: vi.fn(async () => subscribers),
    getForProject: vi.fn(async () => ({ id: 'item-7', title: 'Item', metadata: { number: 7 } }) as never),
  });

  it('reports to every subscriber but the sender, labelled with the item and role', async () => {
    const env = reporting();
    const report = createWorkItemRunEndReporter({
      workItems: workItems([subscriber('item-7', 'session-1'), subscriber('item-7', SENDER.sessionId)]),
      reporting: async () => env.reporting,
    });
    await report({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-7',
      role: 'work',
      sender: SENDER,
      since: new Date(Date.now() - 1000),
      outcome: { status: 'done' },
    });
    expect(env.deliveries.map(entry => entry.target.sessionId)).toEqual(['session-1']);
    expect(env.deliveries[0]!.notification).toMatchObject({
      summary: 'The work session for #7 finished.',
      attributes: { 'work-item': '#7', role: 'work' },
    });
  });

  it('never throws when delivery fails', async () => {
    const env = reporting();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const report = createWorkItemRunEndReporter({
      workItems: workItems([subscriber('item-7', 'session-1')]),
      reporting: async () => ({ ...env.reporting, deliver: async () => Promise.reject(new Error('boom')) }),
    });
    await expect(
      report({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItemId: 'item-7',
        role: 'work',
        sender: SENDER,
        since: new Date(),
        outcome: { status: 'done' },
      }),
    ).resolves.toEqual({ waiting: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('createStageChangeNotifier', () => {
  it('sends a low, coalescing stage notice to each subscriber, live sessions only', async () => {
    const env = reporting();
    const notify = createStageChangeNotifier({
      workItems: {
        listWorkItemSubscribers: vi.fn(async () => [
          subscriber('item-7', 'session-1'),
          subscriber('item-7', 'session-2'),
        ]),
        getForProject: vi.fn(async () => ({ id: 'item-7', title: 'Item', metadata: { number: 7 } }) as never),
      },
      reporting: async () => env.reporting,
    });
    await notify({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-7',
      fromStage: 'plan',
      toStage: 'work',
    });

    expect(env.deliveries).toHaveLength(2);
    for (const delivery of env.deliveries) {
      expect(delivery.options).toEqual({ onlyIfLive: true });
      expect(delivery.notification).toMatchObject({
        kind: 'stage',
        priority: 'low',
        summary: '#7 moved from plan to work.',
        coalesceKey: 'factory-stage:item-7',
        attributes: { 'work-item': '#7', 'from-stage': 'plan', 'to-stage': 'work' },
      });
    }
  });

  it('does nothing for an item nobody follows', async () => {
    const reportingFn = vi.fn();
    const notify = createStageChangeNotifier({
      workItems: { listWorkItemSubscribers: vi.fn(async () => []), getForProject: vi.fn() },
      reporting: reportingFn,
    });
    await notify({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-7',
      fromStage: 'plan',
      toStage: 'work',
    });
    expect(reportingFn).not.toHaveBeenCalled();
  });
});
