import { describe, expect, it, vi } from 'vitest';

import { SUPERVISOR_HIGH_PRIORITY_KINDS, notifySupervisor, supervisorNotificationPriority } from './notify.js';
import { supervisorResourceId, supervisorThreadId } from './session.js';

function makeController(options: { existing?: boolean } = {}) {
  const sent: unknown[] = [];
  const session = { sendNotificationSignal: vi.fn(async (input: unknown) => void sent.push(input)) };
  const events: string[] = [];
  let creating: Promise<typeof session> | undefined;
  const controller = {
    getSessionByResource: vi.fn(async () => {
      events.push('lookup');
      return options.existing ? session : undefined;
    }),
    // Mirrors the real controller: get-or-create with in-flight coalescing.
    createSession: vi.fn(async (input: { id: string; resourceId: string; threadId: string }) => {
      if (!creating) {
        events.push(`create:${input.resourceId}:${input.threadId}`);
        creating = Promise.resolve(session);
      }
      return creating;
    }),
  };
  return { controller: controller as never, sent, events, session, calls: controller };
}

const base = { projectId: 'proj-1', findingKey: 'decision-failed:dec-1', kind: 'decision-failed', summary: 'boom' };

describe('supervisorNotificationPriority', () => {
  it('wakes the supervisor (high) for supervisor-actionable kinds only', () => {
    for (const kind of SUPERVISOR_HIGH_PRIORITY_KINDS) expect(supervisorNotificationPriority(kind)).toBe('high');
    expect([...SUPERVISOR_HIGH_PRIORITY_KINDS].sort()).toEqual(
      ['decision-failed', 'decision-stuck', 'seat-missing', 'seat-orphaned', 'start-stalled'].sort(),
    );
    for (const kind of ['proposal-waiting', 'held-waiting', 'label-drift', 'unknown']) {
      expect(supervisorNotificationPriority(kind)).toBe('low');
    }
  });
});

describe('notifySupervisor', () => {
  it('creates the supervisor session before sending when it has never been reached', async () => {
    const { controller, events, sent } = makeController();
    await notifySupervisor({ controller }, base);
    expect(events).toEqual(['lookup', `create:${supervisorResourceId('proj-1')}:${supervisorThreadId('proj-1')}`]);
    expect(sent).toHaveLength(1);
  });

  it('does not create when the session already exists', async () => {
    const { controller, calls, sent } = makeController({ existing: true });
    await notifySupervisor({ controller }, base);
    expect(calls.createSession).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  it('shares one creation across concurrent emits for a never-created project', async () => {
    const { controller, events, sent } = makeController();
    await Promise.all([
      notifySupervisor({ controller }, base),
      notifySupervisor({ controller }, { ...base, findingKey: 'seat-missing:wi-2', kind: 'seat-missing' }),
    ]);
    expect(events.filter(event => event.startsWith('create:'))).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it('sends a thin signal keyed by finding key with kind-derived priority', async () => {
    const { controller, sent } = makeController({ existing: true });
    await notifySupervisor({ controller }, { ...base, failureCode: 'run_awaiting_input' });
    expect(sent[0]).toEqual({
      source: 'factory',
      kind: 'supervisor-finding',
      summary: 'boom',
      priority: 'high',
      coalesceKey: 'decision-failed:dec-1',
      payload: { findingKey: 'decision-failed:dec-1', kind: 'decision-failed', failureCode: 'run_awaiting_input' },
    });
  });

  it('uses low priority for human-facing kinds and omits failureCode when absent', async () => {
    const { controller, sent } = makeController({ existing: true });
    await notifySupervisor({ controller }, { ...base, kind: 'proposal-waiting', findingKey: 'proposal-waiting:x' });
    expect(sent[0]).toMatchObject({
      priority: 'low',
      payload: { findingKey: 'proposal-waiting:x', kind: 'proposal-waiting' },
    });
    expect((sent[0] as { payload: Record<string, unknown> }).payload).not.toHaveProperty('failureCode');
  });

  it('honours an explicit priority override', async () => {
    const { controller, sent } = makeController({ existing: true });
    await notifySupervisor({ controller }, { ...base, kind: 'label-drift', priority: 'high' });
    expect(sent[0]).toMatchObject({ priority: 'high' });
  });

  it('propagates send failures to the caller (the sweep isolates them per row)', async () => {
    const { controller, session } = makeController({ existing: true });
    session.sendNotificationSignal.mockRejectedValueOnce(new Error('storage down'));
    await expect(notifySupervisor({ controller }, base)).rejects.toThrow('storage down');
  });
});
