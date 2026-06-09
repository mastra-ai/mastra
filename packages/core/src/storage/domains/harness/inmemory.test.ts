import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from './inmemory';
import type { SessionRecord } from './types';

function sampleSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    ownerId: 'owner-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    modeId: 'mode-1',
    modelId: '__GATEWAY_OPENAI_MODEL__',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InMemoryHarness', () => {
  it('loads a saved session', async () => {
    const storage = new InMemoryHarness();
    const session = sampleSession();

    await storage.saveSession(session);

    expect(await storage.loadSession(session.id)).toEqual(session);
  });

  it('returns null for an unknown session', async () => {
    const storage = new InMemoryHarness();

    expect(await storage.loadSession('unknown')).toBeNull();
  });

  it('overwrites an existing session', async () => {
    const storage = new InMemoryHarness();

    await storage.saveSession(sampleSession({ modelId: '__GATEWAY_OPENAI_MODEL__' }));
    await storage.saveSession(sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }));

    expect(await storage.loadSession('session-1')).toEqual(
      sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }),
    );
  });

  it('does not expose saved session record references', async () => {
    const storage = new InMemoryHarness();
    const session = sampleSession({
      state: { count: 1, tasks: [{ id: 'task-1', content: 'Do it', status: 'pending', activeForm: 'Doing it' }] },
      pending: [
        {
          id: 'pending-1',
          kind: 'question',
          status: 'pending',
          sessionId: 'session-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          payload: { prompt: 'Continue?' },
        },
      ],
    });

    await storage.saveSession(session);
    session.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    session.createdAt.setFullYear(2027);
    (session.state!.tasks as Array<{ content: string }>)[0]!.content = 'mutated';
    session.pending![0]!.payload!.prompt = 'mutated';

    const loaded = await storage.loadSession('session-1');
    expect(loaded).toEqual(
      sampleSession({
        state: { count: 1, tasks: [{ id: 'task-1', content: 'Do it', status: 'pending', activeForm: 'Doing it' }] },
        pending: [
          {
            id: 'pending-1',
            kind: 'question',
            status: 'pending',
            sessionId: 'session-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            payload: { prompt: 'Continue?' },
          },
        ],
      }),
    );

    loaded!.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    loaded!.lastActivityAt.setFullYear(2027);
    (loaded!.state!.tasks as Array<{ content: string }>)[0]!.content = 'loaded mutation';

    expect(((await storage.loadSession('session-1'))!.state!.tasks as Array<{ content: string }>)[0]!.content).toBe(
      'Do it',
    );

    const [listed] = await storage.listSessions();
    listed!.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    listed!.pending![0]!.payload!.prompt = 'listed mutation';

    expect((await storage.loadSession('session-1'))!.pending![0]!.payload).toEqual({ prompt: 'Continue?' });
  });

  it('updates sessions and pending items atomically for the in-memory store', async () => {
    const storage = new InMemoryHarness();
    await storage.saveSession(sampleSession());

    await storage.updateSession('session-1', {
      modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__',
      state: { tasks: [{ id: 'task-1', content: 'Do it', status: 'in_progress', activeForm: 'Doing it' }] },
    });

    await storage.appendPendingItem('session-1', {
      id: 'pending-1',
      kind: 'plan-approval',
      status: 'pending',
      sessionId: 'session-1',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      payload: { plan: 'ship it' },
    });

    await storage.updatePendingItem('session-1', 'pending-1', {
      status: 'responded',
      response: { approved: true },
    });

    const record = await storage.removePendingItem('session-1', 'pending-1');

    expect(record.modelId).toBe('__GATEWAY_ANTHROPIC_MODEL_SONNET__');
    expect(record.state?.tasks).toEqual([
      { id: 'task-1', content: 'Do it', status: 'in_progress', activeForm: 'Doing it' },
    ]);
    expect(record.pending).toEqual([]);
  });
});
