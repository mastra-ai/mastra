import { describe, expect, it, vi } from 'vitest';
import { assembleAgentFromFsEntry } from '../agent/fs-routing';
import type { FsAgentScheduleEntry } from '../agent/fs-routing';
import { fsAgentScheduleRowId } from '../schedules/define';
import type { Schedule } from '../storage/domains/schedules/base';
import { MockStore } from '../storage/mock';
import { collectFsAgentSchedules, findFsAgentScheduleHandler } from './fs-agent-schedules';
import { Mastra } from './index';

const withoutNotificationDispatch = { notifications: { dispatch: { enabled: false } } } as const;

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`waitUntil predicate did not become true within ${timeoutMs}ms`);
}

function makeFsAgent(name: string, schedules: FsAgentScheduleEntry[]) {
  return assembleAgentFromFsEntry({
    name,
    config: { model: 'openai/gpt-4o' },
    instructionsMd: `You are ${name}.`,
    schedules,
  });
}

function makeMastra(agents: Record<string, ReturnType<typeof makeFsAgent>>, storage = new MockStore()) {
  return new Mastra({
    logger: false,
    ...withoutNotificationDispatch,
    storage,
    agents: agents as any,
  });
}

async function listSchedules(mastra: Mastra): Promise<Schedule[]> {
  const store = await mastra.getStorage()!.getStore('schedules');
  return (await store!.listSchedules()) as Schedule[];
}

describe('Mastra — file-based agent schedules', () => {
  it('registers declared schedules into storage on boot', async () => {
    const support = makeFsAgent('support', [
      { key: 'heartbeat', schedule: { cron: '*/5 * * * *', prompt: 'Check system health.' } },
      { key: 'billing/sweep', schedule: { cron: '0 3 * * *', prompt: 'Sweep unpaid invoices.', name: 'sweep' } },
    ]);
    const mastra = makeMastra({ support });

    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    const rows = await listSchedules(mastra);
    const heartbeat = rows.find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'));
    const sweep = rows.find(r => r.id === fsAgentScheduleRowId('support', 'billing/sweep'));

    expect(heartbeat).toBeDefined();
    expect(heartbeat!.cron).toBe('*/5 * * * *');
    expect(heartbeat!.status).toBe('active');
    expect(heartbeat!.ownerType).toBe('agent');
    expect(heartbeat!.ownerId).toBe('support');
    expect(heartbeat!.target).toMatchObject({ type: 'agent', agentId: 'support', prompt: 'Check system health.' });

    // Nested paths get their own stable row, keyed by the relative path.
    expect(sweep).toBeDefined();
    expect(sweep!.target).toMatchObject({ name: 'sweep' });
    expect(sweep!.nextFireAt).toBeGreaterThan(Date.now());

    await mastra.shutdown();
  });

  it('auto-enables the scheduler purely because an agent declares a schedule', async () => {
    const mastra = makeMastra({
      support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 * * * *', prompt: 'hi' } }]),
    });

    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);
    expect(mastra.scheduler).toBeDefined();

    await mastra.shutdown();
  });

  it('starts the scheduler by default for agents without declared schedules', async () => {
    const mastra = makeMastra({ support: makeFsAgent('support', []) });

    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);
    expect(mastra.scheduler).toBeDefined();

    await mastra.shutdown();
  });

  it('patches cron changes across a redeploy and recomputes nextFireAt', async () => {
    const storage = new MockStore();
    const first = makeMastra(
      {
        support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
      },
      storage,
    );
    await first.startWorkers();
    await waitUntil(() => first.scheduler?.isRunning === true);
    const before = (await listSchedules(first)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'))!;
    await first.shutdown();

    // Same storage, new process, edited cron.
    const second = makeMastra(
      {
        support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 9 * * *', prompt: 'hi' } }]),
      },
      storage,
    );
    await second.startWorkers();
    await waitUntil(async () => {
      const row = (await listSchedules(second)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'));
      return row?.cron === '0 9 * * *';
    });

    const after = (await listSchedules(second)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'))!;
    expect(after.cron).toBe('0 9 * * *');
    expect(after.nextFireAt).not.toBe(before.nextFireAt);

    await second.shutdown();
  });

  it('deletes rows for schedules that code no longer declares', async () => {
    const storage = new MockStore();
    const first = makeMastra(
      {
        support: makeFsAgent('support', [
          { key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } },
          { key: 'stale', schedule: { cron: '0 4 * * *', prompt: 'bye' } },
        ]),
      },
      storage,
    );
    await first.startWorkers();
    await waitUntil(async () => (await listSchedules(first)).length >= 2);
    await first.shutdown();

    const second = makeMastra(
      {
        support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
      },
      storage,
    );
    await second.startWorkers();
    await waitUntil(async () => {
      const rows = await listSchedules(second);
      return !rows.some(r => r.id === fsAgentScheduleRowId('support', 'stale'));
    });

    const rows = await listSchedules(second);
    expect(rows.map(r => r.id)).toContain(fsAgentScheduleRowId('support', 'heartbeat'));
    expect(rows.map(r => r.id)).not.toContain(fsAgentScheduleRowId('support', 'stale'));

    await second.shutdown();
  });

  it('leaves imperatively created agent schedules alone during the orphan sweep', async () => {
    const mastra = makeMastra({
      support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
    });

    const imperative = await mastra.schedules.create({
      id: 'user-made',
      agentId: 'support',
      cron: '0 6 * * *',
      prompt: 'Created through the API, not from disk.',
    });

    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);
    // Give the boot-time sync a chance to run its sweep.
    await waitUntil(async () => (await listSchedules(mastra)).length >= 2);

    const rows = await listSchedules(mastra);
    expect(rows.map(r => r.id)).toContain(imperative.id);
    expect(rows.map(r => r.id)).toContain(fsAgentScheduleRowId('support', 'heartbeat'));

    await mastra.shutdown();
  });

  it('registers schedules for an agent added after the scheduler started', async () => {
    const mastra = makeMastra({
      support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
    });
    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    mastra.addAgent(makeFsAgent('billing', [{ key: 'sweep', schedule: { cron: '0 4 * * *', prompt: 'sweep' } }]));

    await waitUntil(async () => {
      const rows = await listSchedules(mastra);
      return rows.some(r => r.id === fsAgentScheduleRowId('billing', 'sweep'));
    });

    await mastra.shutdown();
  });

  it('registers an agent that lands while a sweep is already in flight', async () => {
    // The sweep coalesces a synchronous batch into one pass. But an agent that
    // arrives *after* the running sweep has read the agent map must not be
    // dropped — it would have no rows until the next boot.
    const mastra = makeMastra({
      support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
    });

    // Gate `createSchedule`, not `listSchedules`: the sweep reads the agent map
    // *after* listing rows, so parking on the list would still include a late
    // agent. Parking on the first write puts the registration strictly after
    // the map was read, which is the window that actually drops it.
    let release!: () => void;
    const parked = new Promise<void>(resolve => (release = resolve));
    let entered = false;

    try {
      await mastra.startWorkers();
      await waitUntil(() => mastra.scheduler?.isRunning === true);

      const store = (await mastra.getStorage()!.getStore('schedules'))! as any;
      const realCreate = store.createSchedule.bind(store);
      store.createSchedule = async (...args: unknown[]) => {
        if (!entered) {
          entered = true;
          await parked;
        }
        return realCreate(...args);
      };

      // Starts the sweep; it parks inside the gated createSchedule.
      mastra.addAgent(makeFsAgent('billing', [{ key: 'sweep', schedule: { cron: '0 4 * * *', prompt: 'sweep' } }]));
      await waitUntil(() => entered, 5000);

      // Lands strictly after the sweep began: only the queued re-run saves it.
      mastra.addAgent(makeFsAgent('late', [{ key: 'catchup', schedule: { cron: '0 6 * * *', prompt: 'late' } }]));
      release();

      await waitUntil(async () => {
        const ids = (await listSchedules(mastra)).map(r => r.id);
        return ids.includes(fsAgentScheduleRowId('late', 'catchup'));
      }, 5000);

      const ids = (await listSchedules(mastra)).map(r => r.id);
      expect(ids).toContain(fsAgentScheduleRowId('billing', 'sweep'));
      expect(ids).toContain(fsAgentScheduleRowId('late', 'catchup'));
    } finally {
      // Unblock the gate even when an assertion or timeout aborts the test,
      // otherwise the parked `createSchedule` never settles and the scheduler
      // keeps running into later tests.
      release();
      await mastra.shutdown();
    }
  }, 20000);

  it('stores an empty prompt for handler-mode schedules and resolves the handler by row id', async () => {
    const handler = async () => ({ prompt: 'computed at fire time' });
    const mastra = makeMastra({
      support: makeFsAgent('support', [{ key: 'sweep', schedule: { cron: '0 4 * * *', handler } }]),
    });

    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    const rowId = fsAgentScheduleRowId('support', 'sweep');
    const row = (await listSchedules(mastra)).find(r => r.id === rowId);
    expect(row!.target).toMatchObject({ type: 'agent', agentId: 'support', prompt: '' });

    expect((mastra as any).__getFsAgentScheduleHandler(rowId)).toBe(handler);
    expect((mastra as any).__getFsAgentScheduleHandler('fsa_nope__nope')).toBeUndefined();

    await mastra.shutdown();
  });

  it('keeps schedules belonging to agents this process does not have registered', async () => {
    const storage = new MockStore();
    const both = makeMastra(
      {
        support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]),
        billing: makeFsAgent('billing', [{ key: 'sweep', schedule: { cron: '0 4 * * *', prompt: 'sweep' } }]),
      },
      storage,
    );
    await both.startWorkers();
    await waitUntil(async () => (await listSchedules(both)).length >= 2);
    await both.shutdown();

    // A second process holding only one of the two agents must not delete the
    // other agent's schedule just because it can't see the declaration.
    const partial = makeMastra(
      { support: makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]) },
      storage,
    );
    await partial.startWorkers();
    await waitUntil(() => partial.scheduler?.isRunning === true);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));

    const ids = (await listSchedules(partial)).map(r => r.id);
    expect(ids).toContain(fsAgentScheduleRowId('billing', 'sweep'));
    expect(ids).toContain(fsAgentScheduleRowId('support', 'heartbeat'));

    await partial.shutdown();
  });

  it('runs the owning agent end to end when a declared schedule fires', async () => {
    const support = makeFsAgent('support', [
      { key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'Check system health.' } },
    ]);
    const generate = vi.fn(async () => ({ text: 'all good' }));
    (support as any).generate = generate;

    const mastra = makeMastra({ support });
    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    // Fire it out-of-band, the same path `POST /schedules/:id/run` uses.
    await mastra.schedules.run(fsAgentScheduleRowId('support', 'heartbeat'));

    await waitUntil(() => generate.mock.calls.length > 0);
    expect((generate.mock.calls[0] as any[])[0]).toBe('Check system health.');

    await mastra.shutdown();
  });

  it('runs a handler-mode schedule with the prompt the handler computes', async () => {
    const support = makeFsAgent('support', [
      { key: 'sweep', schedule: { cron: '0 4 * * *', handler: async () => ({ prompt: 'computed at fire time' }) } },
    ]);
    const generate = vi.fn(async () => ({ text: 'done' }));
    (support as any).generate = generate;

    const mastra = makeMastra({ support });
    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    await mastra.schedules.run(fsAgentScheduleRowId('support', 'sweep'));

    await waitUntil(() => generate.mock.calls.length > 0);
    expect((generate.mock.calls[0] as any[])[0]).toBe('computed at fire time');

    await mastra.shutdown();
  });

  it('finds schedules on an agent wrapped for durable execution', async () => {
    // A durable wrapper is a distinct instance around the inner agent, with its
    // own private schedule field. `DurableAgent.getDeclaredSchedules` delegates
    // to the wrapped agent so registration sees the inner list.
    const support = assembleAgentFromFsEntry({
      name: 'support',
      config: { model: 'openai/gpt-4o', durable: true },
      instructionsMd: 'You are support.',
      schedules: [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }],
    });

    const mastra = makeMastra({ support });
    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    const ids = (await listSchedules(mastra)).map(r => r.id);
    expect(ids).toContain(fsAgentScheduleRowId('support', 'heartbeat'));

    await mastra.shutdown();
  });

  it('creates a schedule declared as paused in the paused state', async () => {
    const mastra = makeMastra({
      support: makeFsAgent('support', [
        { key: 'draft', schedule: { cron: '0 3 * * *', prompt: 'hi', status: 'paused' } },
      ]),
    });
    await mastra.startWorkers();
    await waitUntil(async () => (await listSchedules(mastra)).length > 0);

    const row = (await listSchedules(mastra)).find(r => r.id === fsAgentScheduleRowId('support', 'draft'));
    expect(row!.status).toBe('paused');

    await mastra.shutdown();
  });

  it('patches metadata when it changes and leaves the row alone when it does not', async () => {
    const storage = new MockStore();
    const first = makeMastra(
      {
        support: makeFsAgent('support', [
          { key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi', metadata: { team: 'ops' } } },
        ]),
      },
      storage,
    );
    await first.startWorkers();
    await waitUntil(async () => (await listSchedules(first)).length > 0);
    const before = (await listSchedules(first)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'))!;
    expect(before.metadata).toEqual({ team: 'ops' });
    await first.shutdown();

    const second = makeMastra(
      {
        support: makeFsAgent('support', [
          { key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi', metadata: { team: 'billing' } } },
        ]),
      },
      storage,
    );
    await second.startWorkers();
    await waitUntil(async () => {
      const row = (await listSchedules(second)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'));
      return JSON.stringify(row?.metadata) === JSON.stringify({ team: 'billing' });
    });

    const after = (await listSchedules(second)).find(r => r.id === fsAgentScheduleRowId('support', 'heartbeat'))!;
    // Cron was unchanged, so the existing fire time must survive the patch.
    expect(after.nextFireAt).toBe(before.nextFireAt);

    await second.shutdown();
  });

  it('does not rewrite an unchanged schedule after the row has been JSON round-tripped', async () => {
    // Real stores persist the target as JSON, which drops the undefined-valued
    // keys the sync writes. If the diff treated an absent key as a change, every
    // boot would issue a pointless UPDATE for every schedule. This reproduces
    // that round trip against an unchanged declaration.
    const storage = new MockStore();
    const declaration: FsAgentScheduleEntry[] = [
      { key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi', name: 'beat' } },
    ];

    const first = makeMastra({ support: makeFsAgent('support', declaration) }, storage);
    await first.startWorkers();
    await waitUntil(async () => (await listSchedules(first)).length > 0);
    await first.shutdown();

    const rowId = fsAgentScheduleRowId('support', 'heartbeat');
    const store = (await storage.getStore('schedules'))!;
    const stored = await store.getSchedule(rowId);
    await store.updateSchedule(rowId, { target: JSON.parse(JSON.stringify(stored!.target)) });

    const updateSpy = vi.spyOn(store, 'updateSchedule');
    const second = makeMastra({ support: makeFsAgent('support', declaration) }, storage);
    await second.startWorkers();
    await waitUntil(() => second.scheduler?.isRunning === true);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));

    expect(updateSpy).not.toHaveBeenCalled();

    updateSpy.mockRestore();
    await second.shutdown();
  });

  it('fires a declared schedule through the real cron tick, not just a manual run', async () => {
    const support = makeFsAgent('support', [
      // Every minute: the scheduler advances nextFireAt past any due row on its
      // tick, so a due schedule dispatches without waiting on wall-clock time.
      { key: 'heartbeat', schedule: { cron: '* * * * *', prompt: 'Check system health.' } },
    ]);
    const generate = vi.fn(async () => ({ text: 'ok' }));
    (support as any).generate = generate;

    const mastra = makeMastra({ support });
    await mastra.startWorkers();
    await waitUntil(() => mastra.scheduler?.isRunning === true);

    // Make the row due now so the next tick claims it.
    const store = (await mastra.getStorage()!.getStore('schedules'))!;
    await store.updateSchedule(fsAgentScheduleRowId('support', 'heartbeat'), { nextFireAt: Date.now() - 1000 });

    await waitUntil(() => generate.mock.calls.length > 0, 15000);
    expect((generate.mock.calls[0] as any[])[0]).toBe('Check system health.');

    await mastra.shutdown();
  }, 20000);
});

/**
 * The collector and the handler lookup are plain functions of the agent map, so
 * they're exercised directly here rather than through a booted Mastra.
 */
describe('collectFsAgentSchedules / findFsAgentScheduleHandler', () => {
  it('reports duplicate agent ids instead of logging them', () => {
    // Two registration keys, one shared agent id: both map onto the same row.
    const first = makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'first' } }]);
    const second = makeFsAgent('support', [{ key: 'heartbeat', schedule: { cron: '0 4 * * *', prompt: 'second' } }]);

    const { schedules, duplicates } = collectFsAgentSchedules({ a: first, b: second } as any);

    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.definition.prompt).toBe('first');
    expect(duplicates).toEqual([{ agentId: 'support', key: 'heartbeat' }]);
  });

  it('resolves a handler by row id without scanning unrelated agents', () => {
    const handler = vi.fn();
    const support = makeFsAgent('support', [{ key: 'billing/sweep', schedule: { cron: '0 3 * * *', handler } }]);
    const other = makeFsAgent('other', [{ key: 'heartbeat', schedule: { cron: '0 3 * * *', prompt: 'hi' } }]);
    const agents = { support, other } as any;

    expect(findFsAgentScheduleHandler(agents, fsAgentScheduleRowId('support', 'billing/sweep'))).toBe(handler);
    // Prompt mode has no handler, and an unknown row id resolves to nothing.
    expect(findFsAgentScheduleHandler(agents, fsAgentScheduleRowId('other', 'heartbeat'))).toBeUndefined();
    expect(findFsAgentScheduleHandler(agents, fsAgentScheduleRowId('support', 'nope'))).toBeUndefined();
    expect(findFsAgentScheduleHandler(agents, 'agent_someImperativeRow')).toBeUndefined();
  });

  it('does not warn on repeated handler lookups when agent ids collide', () => {
    // A lookup runs on every fire. Warning from there would re-log forever, so
    // the lookup must stay free of the collector's duplicate reporting.
    const handler = vi.fn();
    const first = makeFsAgent('support', [{ key: 'sweep', schedule: { cron: '0 3 * * *', handler } }]);
    const second = makeFsAgent('support', [{ key: 'sweep', schedule: { cron: '0 4 * * *', handler } }]);
    const agents = { a: first, b: second } as any;
    const rowId = fsAgentScheduleRowId('support', 'sweep');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 5; i++) expect(findFsAgentScheduleHandler(agents, rowId)).toBe(handler);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
