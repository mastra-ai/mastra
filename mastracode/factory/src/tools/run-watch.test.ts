import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { createSessionRunEndReporter } from './reports.js';
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
        listWorkItemSubscribers: vi.fn(),
        getForProject: vi.fn(),
      } as never,
      reporting,
    });

    await reporter({ sessionId: 'mine', threadId: 'thread', outcome: { status: 'done' }, since: new Date() });

    expect(reporting).not.toHaveBeenCalled();
  });
});
