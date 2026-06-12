import type { SessionRecord } from '@mastra/core/storage';
import { TABLE_HARNESS_SESSIONS } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportSchemas, MySQLStore } from '../..';
import { StoreOperationsMySQL } from '../operations';
import { HarnessMySQL } from './index';

const TEST_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database: process.env.MYSQL_DB || 'mastra',
  max: 10,
  dateStrings: true,
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const createTestPool = () => createPool(TEST_CONFIG);

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

describe('HarnessMySQL', () => {
  let pool: Pool;
  let store: HarnessMySQL;

  beforeEach(async () => {
    pool = createTestPool();
    const operations = new StoreOperationsMySQL({ pool, database: TEST_CONFIG.database });
    store = new HarnessMySQL({ pool, operations });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(async () => {
    await pool?.end();
  });

  it('loads a saved session', async () => {
    const session = sampleSession();

    await store.saveSession(session);

    expect(await store.loadSession(session.id)).toEqual(session);
  });

  it('returns null for an unknown session', async () => {
    expect(await store.loadSession('unknown')).toBeNull();
  });

  it('overwrites an existing session', async () => {
    await store.saveSession(sampleSession({ modelId: '__GATEWAY_OPENAI_MODEL__' }));
    await store.saveSession(sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }));

    expect(await store.loadSession('session-1')).toEqual(
      sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }),
    );
  });

  it('round-trips JSON fields, hierarchy fields, lifecycle dates, and pending items', async () => {
    const session = sampleSession({
      parentSessionId: 'parent-session',
      subagentDepth: 2,
      source: {
        type: 'subagent-tool',
        parentSessionId: 'parent-session',
        parentRunId: 'run-1',
        parentTraceId: 'trace-1',
        subagentType: 'reviewer',
      },
      origin: 'subagent-tool',
      runtimeCompatibilityGeneration: 'generation-1',
      title: 'Harness session',
      metadata: { origin: { command: 'inspect' } },
      state: { count: 1, tasks: [{ id: 'task-1', content: 'Do it', status: 'pending', activeForm: 'Doing it' }] },
      pending: [
        {
          id: 'pending-1',
          kind: 'question',
          status: 'pending',
          sessionId: 'session-1',
          runId: 'run-1',
          traceId: 'trace-1',
          runtimeCompatibilityGeneration: 'generation-1',
          createdAt: new Date('2026-01-01T00:01:00.000Z'),
          updatedAt: new Date('2026-01-01T00:02:00.000Z'),
          payload: { prompt: 'Continue?' },
          response: { answer: 'yes' },
        },
      ],
      closingAt: new Date('2026-01-01T00:03:00.000Z'),
      closeDeadlineAt: new Date('2026-01-01T00:04:00.000Z'),
      closedAt: new Date('2026-01-01T00:05:00.000Z'),
      deletedAt: new Date('2026-01-01T00:06:00.000Z'),
    });

    await store.saveSession(session);

    expect(await store.loadSession('session-1')).toEqual(session);
  });

  it('does not expose saved or listed session record references', async () => {
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

    await store.saveSession(session);
    session.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    session.createdAt.setFullYear(2027);
    (session.state!.tasks as Array<{ content: string }>)[0]!.content = 'mutated';
    session.pending![0]!.payload!.prompt = 'mutated';

    const loaded = await store.loadSession('session-1');
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

    expect(((await store.loadSession('session-1'))!.state!.tasks as Array<{ content: string }>)[0]!.content).toBe(
      'Do it',
    );

    const [listed] = await store.listSessions();
    listed!.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    listed!.pending![0]!.payload!.prompt = 'listed mutation';

    expect((await store.loadSession('session-1'))!.pending![0]!.payload).toEqual({ prompt: 'Continue?' });
  });

  it('updates sessions and pending items through the base storage helpers', async () => {
    await store.saveSession(sampleSession());

    await store.updateSession('session-1', {
      modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__',
      state: { tasks: [{ id: 'task-1', content: 'Do it', status: 'in_progress', activeForm: 'Doing it' }] },
    });

    await store.appendPendingItem('session-1', {
      id: 'pending-1',
      kind: 'plan-approval',
      status: 'pending',
      sessionId: 'session-1',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      payload: { plan: 'ship it' },
    });

    await store.updatePendingItem('session-1', 'pending-1', {
      status: 'responded',
      response: { approved: true },
    });

    const withResponse = await store.loadSession('session-1');
    expect(withResponse?.pending?.[0]).toMatchObject({
      id: 'pending-1',
      status: 'responded',
      response: { approved: true },
    });
    expect(withResponse?.pending?.[0]?.updatedAt).toBeInstanceOf(Date);

    const record = await store.removePendingItem('session-1', 'pending-1');

    expect(record.modelId).toBe('__GATEWAY_ANTHROPIC_MODEL_SONNET__');
    expect(record.state?.tasks).toEqual([
      { id: 'task-1', content: 'Do it', status: 'in_progress', activeForm: 'Doing it' },
    ]);
    expect(record.pending).toEqual([]);
  });

  it('lists saved sessions by most recent activity first', async () => {
    await store.saveSession(sampleSession({ id: 'session-1', lastActivityAt: new Date('2026-01-01T00:00:00.000Z') }));
    await store.saveSession(sampleSession({ id: 'session-2', lastActivityAt: new Date('2026-01-01T00:01:00.000Z') }));

    const sessions = await store.listSessions();

    expect(sessions.map(session => session.id)).toEqual(['session-2', 'session-1']);
  });

  it('exposes harness through MySQLStore and includes harness DDL in schema export', async () => {
    const composite = new MySQLStore({ id: 'mysql-harness-composite', ...TEST_CONFIG });
    try {
      await composite.init();

      const harness = await composite.getStore('harness');
      expect(harness).toBeDefined();

      await harness!.saveSession({
        id: 'composite-session',
        ownerId: 'owner-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        origin: 'top-level',
        modeId: 'mode-1',
        modelId: '__GATEWAY_OPENAI_MODEL__',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
        metadata: { from: 'composite' },
      });

      await expect(harness!.loadSession('composite-session')).resolves.toMatchObject({
        id: 'composite-session',
        metadata: { from: 'composite' },
      });
    } finally {
      await composite.close();
    }

    expect(exportSchemas()).toContain(TABLE_HARNESS_SESSIONS);
  });
});
