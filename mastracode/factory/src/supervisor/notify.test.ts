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
    createSession: vi.fn(async (input: { id: string; resourceId: string; threadId: string; ownerId?: string }) => {
      if (!creating) {
        events.push(`create:${input.resourceId}:${input.threadId}:${input.ownerId}`);
        creating = Promise.resolve(session);
      }
      return creating;
    }),
  };
  const projects = {
    getById: vi.fn(async ({ id }: { id: string }) => (id === 'proj-1' ? { id, createdBy: 'user-creator' } : null)),
  };
  return { controller: controller as never, projects, sent, events, session, calls: controller };
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
    const { controller, projects, events, sent } = makeController();
    await notifySupervisor({ controller, projects }, base);
    // Owned by the project's creator, so a server-started turn on it can
    // resolve model credentials (org first, then the owner's own).
    expect(events).toEqual([
      'lookup',
      `create:${supervisorResourceId('proj-1')}:${supervisorThreadId('proj-1')}:user-creator`,
    ]);
    expect(sent).toHaveLength(1);
  });

  it('refuses to create a session for a project that does not exist', async () => {
    const { controller, projects, sent, calls } = makeController();
    await expect(notifySupervisor({ controller, projects }, { ...base, projectId: 'proj-9' })).rejects.toThrow(
      'does not exist',
    );
    expect(calls.createSession).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('does not create when the session already exists', async () => {
    const { controller, projects, calls, sent } = makeController({ existing: true });
    await notifySupervisor({ controller, projects }, base);
    expect(calls.createSession).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  it('shares one creation across concurrent emits for a never-created project', async () => {
    const { controller, projects, events, sent } = makeController();
    await Promise.all([
      notifySupervisor({ controller, projects }, base),
      notifySupervisor({ controller, projects }, { ...base, findingKey: 'seat-missing:wi-2', kind: 'seat-missing' }),
    ]);
    expect(events.filter(event => event.startsWith('create:'))).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it('sends a thin signal keyed by finding key with kind-derived priority', async () => {
    const { controller, projects, sent } = makeController({ existing: true });
    await notifySupervisor({ controller, projects }, { ...base, failureCode: 'run_awaiting_input' });
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
    const { controller, projects, sent } = makeController({ existing: true });
    await notifySupervisor(
      { controller, projects },
      { ...base, kind: 'proposal-waiting', findingKey: 'proposal-waiting:x' },
    );
    expect(sent[0]).toMatchObject({
      priority: 'low',
      payload: { findingKey: 'proposal-waiting:x', kind: 'proposal-waiting' },
    });
    expect((sent[0] as { payload: Record<string, unknown> }).payload).not.toHaveProperty('failureCode');
  });

  it('honours an explicit priority override', async () => {
    const { controller, projects, sent } = makeController({ existing: true });
    await notifySupervisor({ controller, projects }, { ...base, kind: 'label-drift', priority: 'high' });
    expect(sent[0]).toMatchObject({ priority: 'high' });
  });

  it('propagates send failures to the caller (the sweep isolates them per row)', async () => {
    const { controller, projects, session } = makeController({ existing: true });
    session.sendNotificationSignal.mockRejectedValueOnce(new Error('storage down'));
    await expect(notifySupervisor({ controller, projects }, base)).rejects.toThrow('storage down');
  });
});
