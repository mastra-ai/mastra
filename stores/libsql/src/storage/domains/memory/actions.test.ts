import { createClient } from '@libsql/client';
import { runAgent } from '@mastra/core/new-message-format';
import type { PersistableAction } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

let seq = 0;
const id = () => `01J${String(++seq).padStart(23, '0')}`;

const text = (threadId: string, runId: string, value: string): PersistableAction => ({
  id: id(),
  threadId,
  resourceId: 'user-1',
  runId,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  type: 'text',
  role: 'user',
  text: value,
  metadata: { source: 'test' },
});

/** What a store returns for an action written at the current format version. */
const stored = (action: PersistableAction) => ({ ...action, formatVersion: 1 });

describe('MemoryLibSQL actions', () => {
  let store: MemoryLibSQL;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' });
    store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
  });

  it('round-trips actions with all fields, ordered by id', async () => {
    const a = text('t1', 'r1', 'first');
    const b: PersistableAction = {
      id: id(),
      threadId: 't1',
      runId: 'r1',
      createdAt: new Date(),
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 'weather',
      output: { tempC: 21 },
    };
    await store.saveActions({ actions: [b, a].reverse() });

    const listed = await store.listActions({ threadId: 't1' });
    expect(listed).toEqual([stored(a), stored(b)]);
    expect(listed[0]!.createdAt).toBeInstanceOf(Date);
    expect(listed[1]).not.toHaveProperty('resourceId');
  });

  it('filters by run, type, cursor, and limit, isolated by thread', async () => {
    const r1 = [text('t1', 'r1', '1'), text('t1', 'r1', '2')];
    const r2 = [text('t1', 'r2', '3')];
    const tool: PersistableAction = {
      id: id(),
      threadId: 't1',
      runId: 'r2',
      createdAt: new Date(),
      type: 'tool-call',
      toolCallId: 'c',
      toolName: 'w',
      input: {},
    };
    await store.saveActions({ actions: [...r1, ...r2, tool, text('t2', 'r1', 'other thread')] });

    expect((await store.listActions({ threadId: 't1', runId: 'r1' })).map(a => a.id)).toEqual(r1.map(a => a.id));
    expect((await store.listActions({ threadId: 't1', types: ['tool-call'] })).map(a => a.id)).toEqual([tool.id]);
    expect((await store.listActions({ threadId: 't1', after: r1[0]!.id, limit: 2 })).map(a => a.id)).toEqual([
      r1[1]!.id,
      r2[0]!.id,
    ]);
    expect(await store.listActions({ threadId: 't1' })).toHaveLength(4);
  });

  it('rejects duplicate ids and keeps the original', async () => {
    const a = text('t1', 'r1', 'original');
    await store.saveActions({ actions: [a] });
    await expect(store.saveActions({ actions: [{ ...a, text: 'overwrite' } as PersistableAction] })).rejects.toThrow();
    expect(await store.listActions({ threadId: 't1' })).toEqual([stored(a)]);
  });

  it('never stores transient actions', async () => {
    const a = text('t1', 'r1', 'kept');
    const delta = { ...a, id: id(), type: 'text-delta', transient: true, contentId: 'x', delta: 'd' };
    await store.saveActions({ actions: [a, delta as unknown as PersistableAction] });
    expect(await store.listActions({ threadId: 't1' })).toEqual([stored(a)]);
  });

  it('round-trips thread events with format version and the ignorable flag', async () => {
    const base = { threadId: 't1', runId: 'r1', createdAt: new Date('2026-10-15T10:00:00.000Z') };
    const actions: PersistableAction[] = [
      {
        ...base,
        id: id(),
        type: 'run-start',
        agentId: 'a1',
        modelId: 'openai/gpt-4o-mini',
        settings: { thinkingLevel: 'high', maxSteps: 5, toolNames: ['weather'] },
      },
      { ...base, id: id(), type: 'tool-started', toolCallId: 'c1', toolName: 'weather' },
      { ...base, id: id(), type: 'goal-started', goalId: 'g1', objective: 'Ship it', options: { maxRuns: 10 } },
      {
        ...base,
        id: id(),
        type: 'goal-evaluated',
        goalId: 'g1',
        iteration: 1,
        maxRuns: 10,
        outcome: 'continue',
        status: 'active',
        reason: 'Tests missing',
      },
      {
        ...base,
        id: id(),
        type: 'settings-changed',
        setting: 'mode',
        value: 'plan',
        previousValue: 'build',
        changedBy: { kind: 'user' },
      },
      {
        ...base,
        id: id(),
        type: 'task-changed',
        tasks: [{ id: 'x', content: 'Do x', status: 'pending', activeForm: 'Doing x' }],
        changedBy: { kind: 'agent' },
      },
      { ...base, id: id(), type: 'run-end', finishReason: 'interrupted', usage: {} },
    ];
    await store.saveActions({ actions });

    const listed = await store.listActions({ threadId: 't1' });
    expect(listed.map(a => a.type)).toEqual(actions.map(a => a.type));
    expect(listed.every(a => a.formatVersion === 1)).toBe(true);
    // Model-visible types stay required; the rest are marked skippable for older readers.
    expect(listed.filter(a => a.ignorable).map(a => a.type)).toEqual([
      'run-start',
      'tool-started',
      'goal-started',
      'settings-changed',
      'task-changed',
      'run-end',
    ]);
    expect(listed).toEqual(
      actions.map(a => ({ ...stored(a), ...(a.type === 'goal-evaluated' ? {} : { ignorable: true }) })),
    );
  });

  it('stores goal changes and verdicts exactly as written, with no merging or defaults', async () => {
    const base = { threadId: 't1', runId: 'r1', createdAt: new Date('2026-10-15T10:00:00.000Z') };
    const user = { kind: 'user' } as const;
    const actions: PersistableAction[] = [
      { ...base, id: id(), type: 'goal-changed', goalId: 'g2', options: { maxRuns: 3, prompt: 'p' }, changedBy: user },
      { ...base, id: id(), type: 'goal-changed', goalId: 'g2', options: { maxRuns: 3 }, changedBy: user },
      { ...base, id: id(), type: 'goal-changed', goalId: 'g2', status: 'active', changedBy: user },
      {
        ...base,
        id: id(),
        type: 'goal-evaluated',
        goalId: 'g2',
        outcome: 'waiting-for-user',
        iteration: 3,
        maxRuns: 3,
        status: 'active',
      },
    ];
    await store.saveActions({ actions });

    const listed = await store.listActions({ threadId: 't1' });
    expect(listed).toEqual(
      actions.map(a => ({ ...stored(a), ...(a.type === 'goal-evaluated' ? {} : { ignorable: true }) })),
    );
    expect(listed[0]).not.toHaveProperty('status');
    expect((listed[1] as { options: object }).options).toEqual({ maxRuns: 3 });
    expect(listed[2]).not.toHaveProperty('pausedReason');
    expect(listed[2]).not.toHaveProperty('options');
    expect(listed[3]).toMatchObject({ outcome: 'waiting-for-user', iteration: 3, maxRuns: 3, status: 'active' });
  });

  it('keeps a format version set by the writer', async () => {
    const a = { ...text('t1', 'r1', 'from the future'), formatVersion: 2 };
    await store.saveActions({ actions: [a] });
    expect((await store.listActions({ threadId: 't1' }))[0]!.formatVersion).toBe(2);
  });

  it('returns the greatest action id of a thread, or null', async () => {
    expect(await store.getLatestActionId('t1')).toBeNull();
    const [a, b, c] = [text('t1', 'r1', 'a'), text('t1', 'r1', 'b'), text('t2', 'r1', 'c')];
    await store.saveActions({ actions: [b, a, c] });
    expect(await store.getLatestActionId('t1')).toBe(b.id);
    expect(await store.getLatestActionId('t2')).toBe(c.id);
  });

  it('indexes actions by resource', async () => {
    const indexes = await client.execute(`PRAGMA index_list(mastra_actions)`);
    const names = indexes.rows.map(row => row.name);
    expect(names).toContain('idx_actions_resource_id');
    const columns = await client.execute(`PRAGMA index_info(idx_actions_resource_id)`);
    expect(columns.rows.map(row => row.name)).toEqual(['resource_id', 'id']);
  });

  it('adds format_version to an actions table created without it', async () => {
    const legacy = createClient({ url: 'file::memory:' });
    await legacy.execute(`CREATE TABLE mastra_actions (
      id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, resource_id TEXT, run_id TEXT,
      type TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)`);
    await legacy.execute({
      sql: `INSERT INTO mastra_actions (id, thread_id, run_id, type, created_at, data) VALUES (?, 't1', 'r1', 'text', ?, ?)`,
      args: [
        '01J00000000000000000000000',
        '2026-10-15T10:00:00.000Z',
        JSON.stringify({ role: 'user', text: 'old row' }),
      ],
    });
    const upgraded = new MemoryLibSQL({ client: legacy, maxRetries: 1, initialBackoffMs: 10 });
    await upgraded.init();

    const [old] = await upgraded.listActions({ threadId: 't1' });
    expect(old).toMatchObject({ type: 'text', text: 'old row', formatVersion: 1 });
    const fresh = text('t1', 'r1', 'new row');
    await upgraded.saveActions({ actions: [fresh] });
    expect(await upgraded.listActions({ threadId: 't1' })).toHaveLength(2);
  });

  it('stores a retried question once after its model call failed', async () => {
    // LibSQL rebuilds rows in its own key order, so the resend match must not depend on key order.
    await store.saveActions({
      actions: [
        { ...text('t1', 'r0', 'hello'), metadata: undefined },
        { ...text('t1', 'r0', 'Hi!'), role: 'assistant', metadata: undefined } as PersistableAction,
      ],
    });
    const failing = {
      specificationVersion: 'v4',
      provider: 'test',
      modelId: 'failing',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('provider down');
      },
      doStream: async () => {
        throw new Error('provider down');
      },
    } as never;
    const ui = (id: string, role: 'user' | 'assistant', value: string) => ({
      id,
      role,
      parts: [{ type: 'text', text: value }],
    });
    const resent = [ui('m1', 'user', 'hello'), ui('m2', 'assistant', 'Hi!'), ui('m3', 'user', 'what now?')];
    for (let attempt = 0; attempt < 2; attempt++) {
      await (async () => {
        for await (const _ of runAgent({
          model: failing,
          threadId: 't1',
          resourceId: 'user-1',
          memory: store,
          input: resent,
        }))
          void _;
      })().catch(() => {});
    }

    const log = await store.listActions({ threadId: 't1' });
    expect(log.flatMap(a => (a.type === 'text' ? [`${a.role}:${a.text}`] : []))).toEqual([
      'user:hello',
      'assistant:Hi!',
      'user:what now?',
    ]);
  });

  it('stores a first question once when its model call failed and it is resent', async () => {
    const failing = {
      specificationVersion: 'v4',
      provider: 'test',
      modelId: 'failing',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('provider down');
      },
      doStream: async () => {
        throw new Error('provider down');
      },
    } as never;
    const inputs = ['hello', [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }]];
    for (const input of inputs) {
      for await (const _ of runAgent({ model: failing, threadId: 't1', resourceId: 'user-1', memory: store, input }))
        void _;
    }

    const log = await store.listActions({ threadId: 't1' });
    expect(log.flatMap(a => (a.type === 'text' ? [`${a.role}:${a.text}`] : []))).toEqual(['user:hello']);
  });
});
