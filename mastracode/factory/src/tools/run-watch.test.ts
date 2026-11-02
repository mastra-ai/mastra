import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { describe, expect, it, vi } from 'vitest';

import { createSessionApprovalNotifier, createSessionRunEndReporter } from './reports.js';
import { observeSessionRunReports } from './run-watch.js';

function fakeSession() {
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  return {
    emit: (event: AgentControllerEvent) => listeners.forEach(listener => listener(event)),
    subscribe: (listener: (event: AgentControllerEvent) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

const end = (reason: 'complete' | 'aborted' | 'error' | 'suspended') =>
  ({ type: 'agent_end', reason }) as AgentControllerEvent;

describe('observeSessionRunReports', () => {
  it('reports every run end of the session, not only the first', async () => {
    const session = fakeSession();
    const report = vi.fn(async () => {});
    observeSessionRunReports(session, report);

    session.emit(end('complete'));
    session.emit(end('error'));

    expect(report.mock.calls.map(([outcome]) => outcome)).toEqual([
      { status: 'done' },
      { status: 'failed', reason: 'the run ended in error.' },
    ]);
  });

  it('reports a run waiting for approval as blocked, naming the tool', () => {
    const session = fakeSession();
    const report = vi.fn(async () => {});
    observeSessionRunReports(session, report);

    session.emit({
      type: 'tool_approval_required',
      toolCallId: 'call-1',
      toolName: 'factory_transition_work_item',
      args: {},
    } as AgentControllerEvent);
    session.emit(end('suspended'));

    expect(report).toHaveBeenCalledWith(
      { status: 'blocked', toolName: 'factory_transition_work_item', approval: true },
      expect.any(Date),
    );
  });

  it('says nothing for an aborted run, and the next run’s window starts where the aborted one did', () => {
    vi.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z') });
    try {
      const session = fakeSession();
      const report = vi.fn(async () => {});
      observeSessionRunReports(session, report);

      vi.setSystemTime(new Date('2026-10-15T12:01:00Z'));
      session.emit(end('complete'));
      vi.setSystemTime(new Date('2026-10-15T12:02:00Z'));
      session.emit(end('aborted'));
      expect(report).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date('2026-10-15T12:03:00Z'));
      session.emit(end('complete'));

      expect(report.mock.calls.map(([, since]) => (since as Date).toISOString())).toEqual([
        '2026-10-15T12:00:00.000Z',
        // From the first run's end, so what the agent said during the aborted run still counts.
        '2026-10-15T12:01:00.001Z',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces a tool call held for approval as it happens, before the run ends', () => {
    const session = fakeSession();
    const report = vi.fn(async () => {});
    const onApprovalRequested = vi.fn(async () => {});
    observeSessionRunReports(session, report, { onApprovalRequested });

    session.emit({
      type: 'tool_approval_required',
      toolCallId: 'call-1',
      toolName: 'factory_transition_work_item',
      args: { stage: 'done' },
    } as AgentControllerEvent);

    expect(onApprovalRequested).toHaveBeenCalledWith({
      toolName: 'factory_transition_work_item',
      toolCallId: 'call-1',
      args: { stage: 'done' },
    });
    expect(report).not.toHaveBeenCalled();
  });

  it("quotes the run's error in a failed report", () => {
    const session = fakeSession();
    const report = vi.fn(async () => {});
    observeSessionRunReports(session, report);

    session.emit({ type: 'error', error: new Error('Sandbox lease lost') } as AgentControllerEvent);
    session.emit(end('error'));
    session.emit(end('error'));

    expect(report.mock.calls.map(([outcome]) => outcome)).toEqual([
      { status: 'failed', reason: 'the run ended in error: Sandbox lease lost' },
      // Each run's error is its own.
      { status: 'failed', reason: 'the run ended in error.' },
    ]);
  });

  function failedReport(error: Error) {
    const session = fakeSession();
    const report = vi.fn(async () => {});
    observeSessionRunReports(session, report);
    session.emit({ type: 'error', error } as AgentControllerEvent);
    session.emit(end('error'));
    return report.mock.calls.map(([outcome]) => outcome)[0];
  }

  function badRequest(body: unknown) {
    return Object.assign(new Error('Bad Request'), { statusCode: 400, responseBody: JSON.stringify(body) });
  }

  it.each([
    {
      name: 'a usage-limit sentence in the provider body',
      error: badRequest({ error: { message: 'You have exceeded your current quota, please check your plan.' } }),
      reason: 'You have exceeded your current quota, please check your plan.',
    },
    {
      name: 'any other sentence in the provider body',
      error: badRequest({ error: { message: 'Invalid model id' } }),
      reason: 'Invalid model id',
    },
    {
      name: 'a Codex detail sentence',
      error: badRequest({ detail: 'You have exceeded your usage limit for Codex' }),
      reason: 'You have exceeded your usage limit for Codex',
    },
    {
      name: 'a provider sentence behind a wrapping cause',
      error: new Error('Agent stream failed', {
        cause: badRequest({ error: { message: 'prompt is too long: 210345 tokens > 200000 maximum' } }),
      }),
      reason: 'prompt is too long: 210345 tokens > 200000 maximum',
    },
  ])('quotes $name instead of Bad Request', ({ error, reason }) => {
    expect(failedReport(error)).toEqual({ status: 'failed', reason: `the run ended in error: ${reason}` });
  });

  it('quotes at most 400 characters of the provider sentence', () => {
    const sentence = `Your weekly usage limit is reached. ${'x'.repeat(500)}`;
    expect(failedReport(badRequest({ error: { message: sentence } }))).toEqual({
      status: 'failed',
      reason: `the run ended in error: ${sentence.slice(0, 400)}`,
    });
  });

  it('keeps listening when a report fails', async () => {
    const session = fakeSession();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const report = vi.fn<(outcome: unknown, since: Date) => Promise<void>>().mockRejectedValueOnce(new Error('down'));
    report.mockResolvedValue(undefined);
    observeSessionRunReports(session, report);

    session.emit(end('complete'));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    session.emit(end('complete'));

    expect(report).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('createSessionRunEndReporter', () => {
  it('reports nothing for a session that is neither working an item nor started from another session', async () => {
    const reporting = vi.fn(async () => null);
    const reporter = createSessionRunEndReporter({
      sessions: {
        getBySessionId: async () =>
          ({
            sessionId: 'mine',
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            userId: 'user-1',
            originSessionId: null,
            originThreadId: null,
            title: null,
          }) as never,
      },
      workItems: {
        findActiveRunBindingForSession: async () => null,
        findRunBindingBySession: async () => null,
        listWorkItemSubscribers: vi.fn(),
        getForProject: vi.fn(),
      } as never,
      reporting,
    });

    await reporter({ sessionId: 'mine', threadId: 'thread', outcome: { status: 'done' }, since: new Date() });

    expect(reporting).not.toHaveBeenCalled();
  });

  it("reports a finished run kept on its own resource to its item's followers", async () => {
    const since = new Date('2026-10-01T00:00:00.000Z');
    // A run on untrusted content records its own session id as the binding's resource.
    const findRunBindingBySession = vi.fn(async ({ resourceId }: { resourceId: string }) =>
      resourceId === 'run'
        ? {
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            workItemId: 'item-1',
            role: 'reviewer',
            threadId: 'run',
            revokedAt: new Date('2026-10-01T00:05:00.000Z'),
          }
        : null,
    );
    const listWorkItemSubscribers = vi.fn(async () => []);
    const reporter = createSessionRunEndReporter({
      sessions: {
        getBySessionId: async () =>
          ({
            sessionId: 'run',
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            userId: 'user-1',
            originSessionId: null,
            originThreadId: null,
            title: null,
          }) as never,
      },
      workItems: {
        findActiveRunBindingForSession: async () => null,
        findRunBindingBySession,
        listWorkItemSubscribers,
        getForProject: vi.fn(),
      } as never,
      reporting: async () => ({ deliver: vi.fn(), notifications: new InMemoryNotificationsStorage() }),
    });

    await reporter({ sessionId: 'run', threadId: 'run', outcome: { status: 'done' }, since });

    expect(findRunBindingBySession).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'run' }));
    expect(listWorkItemSubscribers).toHaveBeenCalledWith(expect.objectContaining({ workItemId: 'item-1' }));
  });

  function sideReporter(originMutedAt: Date | null) {
    const deliver = vi.fn(async () => ({ delivered: 'woken' as const, notificationId: 'n-1' }));
    const reporter = createSessionRunEndReporter({
      sessions: {
        getBySessionId: async () =>
          ({
            sessionId: 'side',
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            userId: 'user-1',
            originSessionId: 'origin',
            originThreadId: 'origin-thread',
            originMutedAt,
            title: 'Look into it',
          }) as never,
      },
      workItems: {
        findActiveRunBindingForSession: async () => null,
        findRunBindingBySession: async () => null,
        listWorkItemSubscribers: vi.fn(),
        getForProject: vi.fn(),
      } as never,
      reporting: async () => ({ deliver, notifications: new InMemoryNotificationsStorage() }),
    });
    return { reporter, deliver };
  }

  it("reports a side session's failed run to its origin", async () => {
    const { reporter, deliver } = sideReporter(null);
    await reporter({
      sessionId: 'side',
      threadId: 'side-thread',
      outcome: { status: 'failed', reason: 'usage limit' },
      since: new Date(),
    });
    expect(deliver).toHaveBeenCalledWith({ sessionId: 'origin', threadId: 'origin-thread' }, expect.anything());
  });

  it('sends no finished or failed run-end report once the origin has muted the side session', async () => {
    const { reporter, deliver } = sideReporter(new Date());
    for (const outcome of [{ status: 'failed', reason: 'usage limit' }, { status: 'done' }] as const) {
      await reporter({ sessionId: 'side', threadId: 'side-thread', outcome, since: new Date() });
    }
    expect(deliver).not.toHaveBeenCalled();
  });

  it('still tells a muted side session origin that the session is blocked waiting on a tool', async () => {
    const { reporter, deliver } = sideReporter(new Date());
    await reporter({
      sessionId: 'side',
      threadId: 'side-thread',
      outcome: { status: 'blocked', toolName: 'ask_user' },
      since: new Date(),
    });
    expect(deliver).toHaveBeenCalledWith(
      { sessionId: 'origin', threadId: 'origin-thread' },
      expect.objectContaining({ kind: 'blocked' }),
    );
  });
});

describe('createSessionRunEndReporter for the run that finishes its card', () => {
  const since = new Date('2026-10-15T12:00:00Z');
  function reporter(revokedAt: Date) {
    const deliver = vi.fn(async () => ({ delivered: 'woken' as const, notificationId: 'n-1' }));
    const report = createSessionRunEndReporter({
      sessions: {
        getBySessionId: async () =>
          ({
            sessionId: 'worker',
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            userId: 'user-1',
            originSessionId: null,
            originThreadId: null,
            title: null,
          }) as never,
      },
      workItems: {
        // Moving the card to a finished stage revoked the binding before the run ended.
        findActiveRunBindingForSession: async () => null,
        findRunBindingBySession: async () =>
          ({
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            workItemId: 'item-1',
            role: 'triage',
            threadId: 'worker',
            revokedAt,
          }) as never,
        listWorkItemSubscribers: async () => [{ sessionId: 'follower', threadId: 'follower-thread' }] as never,
        getForProject: async () => ({ title: 'Fix it', externalSource: null, metadata: {} }) as never,
      },
      reporting: async () => ({ deliver, notifications: { listNotifications: async () => [] } as never }),
    });
    return { report, deliver };
  }

  it("still reports to the item's followers when the run's own move revoked its binding", async () => {
    const { report, deliver } = reporter(new Date('2026-10-15T12:05:00Z'));
    await report({ sessionId: 'worker', threadId: 'worker', outcome: { status: 'done' }, since });
    expect(deliver).toHaveBeenCalledWith(
      { sessionId: 'follower', threadId: 'follower-thread' },
      expect.objectContaining({ kind: 'done', summary: 'The triage session for "Fix it" finished.' }),
    );
  });

  it('reports nothing for a later run of a session whose binding ended before it', async () => {
    const { report, deliver } = reporter(new Date('2026-10-15T11:59:00Z'));
    await report({ sessionId: 'worker', threadId: 'worker', outcome: { status: 'done' }, since });
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('createSessionApprovalNotifier', () => {
  function notifier(binding: boolean, row: Record<string, unknown> = {}) {
    const deliver = vi.fn(async () => ({ delivered: 'woken' as const, notificationId: 'n-1' }));
    const notify = createSessionApprovalNotifier({
      sessions: {
        getBySessionId: async () =>
          ({
            sessionId: 'worker',
            orgId: 'org-1',
            factoryProjectId: 'project-1',
            userId: 'user-1',
            originSessionId: null,
            originThreadId: null,
            title: null,
            ...row,
          }) as never,
      },
      workItems: {
        findActiveRunBindingForSession: async () =>
          binding
            ? ({
                orgId: 'org-1',
                factoryProjectId: 'project-1',
                workItemId: 'item-1',
                role: 'triage',
                threadId: 'worker-thread',
              } as never)
            : null,
        listWorkItemSubscribers: async () =>
          [
            { sessionId: 'follower', threadId: 'follower-thread' },
            { sessionId: 'worker', threadId: 'worker-thread' },
          ] as never,
        getForProject: async () => ({ title: 'Fix it', externalSource: null, metadata: {} }) as never,
      },
      reporting: async () => ({ deliver, notifications: {} as never }),
    });
    return { notify, deliver };
  }

  const request = {
    sessionId: 'worker',
    threadId: 'worker-thread',
    toolName: 'factory_transition_work_item',
    toolCallId: 'call-1',
    args: { stage: 'done' },
  };

  it("urgently tells the item's other followers which call to answer, once per call", async () => {
    const { notify, deliver } = notifier(true);
    await notify(request);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(
      { sessionId: 'follower', threadId: 'follower-thread' },
      expect.objectContaining({
        kind: 'approval',
        priority: 'urgent',
        dedupeKey: 'factory-approval:call-1',
        summary: expect.stringMatching(
          /^The triage session for "Fix it" is waiting for approval to run factory_transition_work_item with \{"stage":"done"\}\. Answer it with factory_answer_approval \(sessionId "worker", toolCallId "call-1"\)/,
        ),
        attributes: expect.objectContaining({
          'waiting-for': 'approval',
          'tool-name': 'factory_transition_work_item',
          'tool-call-id': 'call-1',
          'from-session': 'worker',
        }),
      }),
    );
  });

  it('tells the session that started a side session', async () => {
    const { notify, deliver } = notifier(false, {
      originSessionId: 'origin',
      originThreadId: 'origin-thread',
      title: 'Look into it',
    });
    await notify(request);
    expect(deliver).toHaveBeenCalledWith(
      { sessionId: 'origin', threadId: 'origin-thread' },
      expect.objectContaining({ summary: expect.stringContaining('The side session "Look into it" is waiting') }),
    );
  });

  it("still tells a muted side session's origin about a held approval, since the session cannot go on without it", async () => {
    const { notify, deliver } = notifier(false, {
      originSessionId: 'origin',
      originThreadId: 'origin-thread',
      originMutedAt: new Date(),
      title: 'Look into it',
    });
    await notify(request);
    expect(deliver).toHaveBeenCalledWith(
      { sessionId: 'origin', threadId: 'origin-thread' },
      expect.objectContaining({ kind: 'approval' }),
    );
  });

  it("tells nobody about a person's own session", async () => {
    const { notify, deliver } = notifier(false);
    await notify(request);
    expect(deliver).not.toHaveBeenCalled();
  });
});
