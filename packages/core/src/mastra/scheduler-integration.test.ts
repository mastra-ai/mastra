import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockStore } from '../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../workflows';
import { createStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { Mastra } from './index';

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2000,
  intervalMs = 10,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitUntil predicate did not become true within ${timeoutMs}ms`);
}

async function waitForScheduler(mastra: Mastra): Promise<void> {
  await waitUntil(() => mastra.scheduler?.isRunning === true);
}

/**
 * Drain microtasks + a couple of macrotask turns so any pending async init
 * settles. Used by tests that assert the scheduler intentionally did NOT start,
 * where there is no positive predicate to poll on.
 */
async function flushAsyncInit(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
}

const withoutNotificationDispatch = { notifications: { dispatch: { enabled: false } } } as const;

describe('Mastra — workflow scheduler integration', () => {
  it('auto-instantiates the scheduler when a workflow declares a schedule', async () => {
    const wf = createEventedWorkflow({
      id: 'scheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '*/5 * * * *', inputData: { hello: 'world' } },
    });
    wf.then(
      createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      }) as any,
    ).commit();

    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage: new MockStore(),
      workflows: { wf } as any,
    });

    // Start workers — the SchedulerWorker initializes and starts the tick loop.
    await mastra.startWorkers();
    await waitForScheduler(mastra);

    const scheduler = mastra.scheduler;
    expect(scheduler).toBeDefined();
    expect(scheduler!.isRunning).toBe(true);

    const schedulesStore = await mastra.getStorage()!.getStore('schedules');
    const schedules = await schedulesStore!.listSchedules();
    expect(schedules.find(s => s.id === 'wf_scheduled-wf')).toBeDefined();

    await mastra.shutdown();
    expect(scheduler!.isRunning).toBe(false);
  });

  it('does not instantiate the scheduler when no schedules are configured', async () => {
    const storage = new MockStore();

    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage,
    });

    await mastra.startWorkers();
    await flushAsyncInit();

    // The schedules store may be touched on boot to check for existing
    // heartbeat rows (cold-boot rehydration via #detectExistingHeartbeats).
    // What matters is that the scheduler itself never spins up.
    expect(mastra.scheduler).toBeUndefined();

    await mastra.shutdown();
  });

  it('does not instantiate the scheduler when only unscheduled workflows are registered', async () => {
    const storage = new MockStore();

    const wf = createDefaultWorkflow({
      id: 'plain-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    wf.then(
      createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      }) as any,
    ).commit();

    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage,
      workflows: { wf } as any,
    });

    await mastra.startWorkers();
    await flushAsyncInit();

    // As above, boot-time cold rehydration may probe the schedules store;
    // the invariant under test is that no scheduler worker is created.
    expect(mastra.scheduler).toBeUndefined();

    await mastra.shutdown();
  });

  it('instantiates the scheduler when explicitly enabled even without declarative schedules', async () => {
    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage: new MockStore(),
      scheduler: { enabled: true },
    });

    await mastra.startWorkers();
    await waitForScheduler(mastra);
    expect(mastra.scheduler).toBeDefined();
    expect(mastra.scheduler!.isRunning).toBe(true);

    await mastra.shutdown();
  });

  it('auto-promotes a default `createWorkflow` to evented when a schedule is declared', async () => {
    const wf = createDefaultWorkflow({
      id: 'promoted-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '*/5 * * * *', inputData: { hello: 'world' } },
    });

    // The factory should have returned an evented-engine workflow instance.
    expect(wf.engineType).toBe('evented');

    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage: new MockStore(),
      workflows: { wf: wf as any },
    });

    await mastra.startWorkers();
    await waitForScheduler(mastra);
    expect(mastra.scheduler).toBeDefined();
    const schedulesStore = await mastra.getStorage()!.getStore('schedules');
    const schedules = await schedulesStore!.listSchedules();
    expect(schedules.find(s => s.id === 'wf_promoted-wf')).toBeDefined();

    await mastra.shutdown();
  });

  it('starts the scheduler when scheduler.enabled is true even with no scheduled workflows', async () => {
    const mastra = new Mastra({
      logger: false,
      ...withoutNotificationDispatch,
      storage: new MockStore(),
      scheduler: { enabled: true },
    });

    await mastra.startWorkers();
    await waitForScheduler(mastra);
    expect(mastra.scheduler).toBeDefined();
    expect(mastra.scheduler!.isRunning).toBe(true);

    await mastra.shutdown();
    expect(mastra.scheduler!.isRunning).toBe(false);
  });

  describe('upsert on redeploy', () => {
    const buildScheduledWorkflow = (cfg: {
      cron: string;
      timezone?: string;
      inputData?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }) => {
      const wf = createEventedWorkflow({
        id: 'rolling-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: cfg as any,
      });
      wf.then(
        createStep({
          id: 'noop',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        }) as any,
      ).commit();
      return wf;
    };

    const boot = async (storage: InstanceType<typeof MockStore>, wf: ReturnType<typeof buildScheduledWorkflow>) => {
      const mastra = new Mastra({
        logger: false,
        ...withoutNotificationDispatch,
        storage,
        workflows: { wf } as any,
      });
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      return mastra;
    };

    it('rewrites cron and recomputes nextFireAt when the cron expression changes', async () => {
      const storage = new MockStore();

      // Use crons with deliberately different cadences that cannot land on
      // the same next-fire minute regardless of when the test runs.
      const first = await boot(storage, buildScheduledWorkflow({ cron: '0 9 * * 1' })); // Mondays 09:00
      const schedulesStore = (await storage.getStore('schedules'))!;
      const initial = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(initial?.cron).toBe('0 9 * * 1');
      const initialNextFireAt = initial!.nextFireAt;
      await first.shutdown();

      const second = await boot(storage, buildScheduledWorkflow({ cron: '30 14 * * 5' })); // Fridays 14:30
      const updated = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(updated?.cron).toBe('30 14 * * 5');
      // nextFireAt was anchored to the old cron; cron change must invalidate it.
      expect(updated!.nextFireAt).not.toBe(initialNextFireAt);
      await second.shutdown();
    });

    it('updates the target payload when inputData changes', async () => {
      const storage = new MockStore();

      const first = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *', inputData: { v: 1 } }));
      await first.shutdown();

      const second = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *', inputData: { v: 2 } }));
      const schedulesStore = (await storage.getStore('schedules'))!;
      const updated = await schedulesStore.getSchedule('wf_rolling-wf');
      expect((updated!.target as any).inputData).toEqual({ v: 2 });
      await second.shutdown();
    });

    it('does not unpause a schedule that was paused out-of-band', async () => {
      const storage = new MockStore();

      const first = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *' }));
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.updateSchedule('wf_rolling-wf', { status: 'paused' });
      await first.shutdown();

      // Redeploy with a config change — must not flip status back to 'active'.
      const second = await boot(storage, buildScheduledWorkflow({ cron: '0 * * * *' }));
      const after = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(after?.status).toBe('paused');
      expect(after?.cron).toBe('0 * * * *');
      await second.shutdown();
    });

    it('does not write when nothing has changed', async () => {
      const storage = new MockStore();

      const first = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *', inputData: { v: 1 } }));
      const schedulesStore = (await storage.getStore('schedules'))!;
      const initial = await schedulesStore.getSchedule('wf_rolling-wf');
      await first.shutdown();

      const updateSpy = vi.spyOn(schedulesStore, 'updateSchedule');
      const second = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *', inputData: { v: 1 } }));
      expect(updateSpy).not.toHaveBeenCalled();
      const after = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(after?.updatedAt).toBe(initial?.updatedAt);
      await second.shutdown();
    });
  });

  describe('multi-schedule (array form)', () => {
    const buildMultiScheduledWorkflow = (
      schedules: Array<{ id: string; cron: string; inputData?: Record<string, unknown> }>,
    ) => {
      const wf = createEventedWorkflow({
        id: 'multi-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: schedules as any,
      });
      wf.then(
        createStep({
          id: 'noop',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        }) as any,
      ).commit();
      return wf;
    };

    const boot = async (
      storage: InstanceType<typeof MockStore>,
      wf: ReturnType<typeof buildMultiScheduledWorkflow>,
    ) => {
      const mastra = new Mastra({
        logger: false,
        ...withoutNotificationDispatch,
        storage,
        workflows: { wf } as any,
      });
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      return mastra;
    };

    it('registers one storage row per array entry, keyed by `wf_<workflowId>__<scheduleId>`', async () => {
      const storage = new MockStore();
      const mastra = await boot(
        storage,
        buildMultiScheduledWorkflow([
          { id: 'morning', cron: '0 9 * * *', inputData: { window: 'morning' } },
          { id: 'evening', cron: '0 18 * * *', inputData: { window: 'evening' } },
        ]),
      );

      const schedulesStore = (await storage.getStore('schedules'))!;
      const rows = await schedulesStore.listSchedules();
      const ids = rows.map(r => r.id).sort();
      expect(ids).toEqual(['wf_multi-wf__evening', 'wf_multi-wf__morning']);

      const morning = rows.find(r => r.id === 'wf_multi-wf__morning')!;
      expect(morning.cron).toBe('0 9 * * *');
      expect((morning.target as any).inputData).toEqual({ window: 'morning' });

      await mastra.shutdown();
    });

    it('deletes orphan rows when an array entry is removed across redeploys', async () => {
      const storage = new MockStore();
      const first = await boot(
        storage,
        buildMultiScheduledWorkflow([
          { id: 'a', cron: '0 9 * * *' },
          { id: 'b', cron: '0 18 * * *' },
        ]),
      );
      const schedulesStore = (await storage.getStore('schedules'))!;
      expect((await schedulesStore.listSchedules()).map(r => r.id).sort()).toEqual([
        'wf_multi-wf__a',
        'wf_multi-wf__b',
      ]);
      await first.shutdown();

      // Redeploy with `b` removed. The orphan row should be deleted.
      const second = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const remaining = (await schedulesStore.listSchedules()).map(r => r.id);
      expect(remaining).toEqual(['wf_multi-wf__a']);
      await second.shutdown();
    });

    it('migrates from single-form to array-form by deleting the legacy `wf_<id>` row', async () => {
      const storage = new MockStore();
      // Boot 1: single-form schedule produces `wf_multi-wf` row.
      const wfSingle = createEventedWorkflow({
        id: 'multi-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: { cron: '0 9 * * *' },
      });
      wfSingle
        .then(
          createStep({
            id: 'noop',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async () => ({}),
          }) as any,
        )
        .commit();
      const first = new Mastra({
        logger: false,
        ...withoutNotificationDispatch,
        storage,
        workflows: { wfSingle } as any,
      });
      await first.startWorkers();
      await waitForScheduler(first);
      const schedulesStore = (await storage.getStore('schedules'))!;
      expect((await schedulesStore.listSchedules()).map(r => r.id)).toEqual(['wf_multi-wf']);
      await first.shutdown();

      // Boot 2: same workflow id but now array-form. The legacy row is owned
      // by this workflow and not in the new declared set, so it gets deleted.
      const second = await boot(
        storage,
        buildMultiScheduledWorkflow([
          { id: 'morning', cron: '0 9 * * *' },
          { id: 'evening', cron: '0 18 * * *' },
        ]),
      );
      const ids = (await schedulesStore.listSchedules()).map(r => r.id).sort();
      expect(ids).toEqual(['wf_multi-wf__evening', 'wf_multi-wf__morning']);
      await second.shutdown();
    });

    it('deletes declarative `wf_`-prefixed rows for workflows no longer registered in code', async () => {
      const storage = new MockStore();
      const mastra = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const schedulesStore = (await storage.getStore('schedules'))!;

      // Simulate a previous deploy that declared a schedule for a workflow
      // that has since been removed from code entirely.
      await schedulesStore.createSchedule({
        id: 'wf_removed-wf__job',
        target: { type: 'workflow', workflowId: 'removed-wf' },
        cron: '0 0 * * *',
        status: 'active',
        nextFireAt: Date.now() + 60_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await mastra.shutdown();

      // Reboot without `removed-wf`. Its declarative row must be cleaned up
      // so the scheduler doesn't keep firing events the processor can't
      // resolve (which would otherwise cause infinite event redelivery).
      const second = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const ids = (await schedulesStore.listSchedules()).map(r => r.id).sort();
      expect(ids).not.toContain('wf_removed-wf__job');
      expect(ids).toEqual(['wf_multi-wf__a']);
      await second.shutdown();
    });

    it('does not delete user-created (non-`wf_`-prefixed) schedule rows', async () => {
      const storage = new MockStore();
      const mastra = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const schedulesStore = (await storage.getStore('schedules'))!;

      // A schedule created via the schedules API (not via declarative config)
      // does not use the `wf_` prefix and must be left alone on reboot even
      // when its target workflow isn't currently registered.
      await schedulesStore.createSchedule({
        id: 'user-created-schedule',
        target: { type: 'workflow', workflowId: 'unrelated' },
        cron: '0 0 * * *',
        status: 'active',
        nextFireAt: Date.now() + 60_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await mastra.shutdown();

      const second = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const ids = (await schedulesStore.listSchedules()).map(r => r.id).sort();
      expect(ids).toContain('user-created-schedule');
      await second.shutdown();
    });
  });

  describe('ghost-workflow cleanup (end-to-end)', () => {
    it('deletes a due schedule after N ticks when its target workflow is not registered', async () => {
      const storage = new MockStore();

      // Boot Mastra with scheduler enabled (no workflows). Declarative
      // reconciliation runs on boot and won't touch schedules we insert
      // afterwards — this exercises the tick-based ghost-workflow cleanup
      // wired end-to-end through SchedulerWorker → isWorkflowRegistered
      // → mastra.getWorkflowById.
      const mastra = new Mastra({
        logger: false,
        ...withoutNotificationDispatch,
        storage,
        scheduler: { enabled: true, tickIntervalMs: 600_000, missesBeforeDelete: 2 },
      });
      await mastra.startWorkers();
      await waitForScheduler(mastra);

      // Insert a ghost schedule AFTER boot so declarative reconciliation
      // doesn't clean it up — only the tick loop's existence check can.
      const schedulesStore = (await storage.getStore('schedules'))!;
      const past = Date.now() - 5_000;
      await schedulesStore.createSchedule({
        id: 'ghost-sched',
        target: { type: 'workflow', workflowId: 'does-not-exist' },
        cron: '0 0 1 1 *',
        status: 'active',
        nextFireAt: past,
        createdAt: past,
        updatedAt: past,
      });

      // Tick 1: schedule is due, workflow missing → miss count = 1.
      await mastra.scheduler!.tick();
      const afterTick1 = await schedulesStore.getSchedule('ghost-sched');
      expect(afterTick1).not.toBeNull(); // Still alive — within grace window.

      // Tick 2: miss count reaches limit (2) → schedule deleted.
      await mastra.scheduler!.tick();
      const afterTick2 = await schedulesStore.getSchedule('ghost-sched');
      expect(afterTick2).toBeNull();

      await mastra.shutdown();
    });

    it('does not delete a ghost schedule that is not yet due', async () => {
      const storage = new MockStore();

      const mastra = new Mastra({
        logger: false,
        ...withoutNotificationDispatch,
        storage,
        scheduler: { enabled: true, tickIntervalMs: 600_000, missesBeforeDelete: 1 },
      });
      await mastra.startWorkers();
      await waitForScheduler(mastra);

      // Insert a ghost schedule with nextFireAt far in the future.
      // The tick loop should never pick it up (not due) so the miss
      // counter never fires.
      const schedulesStore = (await storage.getStore('schedules'))!;
      const future = Date.now() + 3_600_000;
      await schedulesStore.createSchedule({
        id: 'future-ghost',
        target: { type: 'workflow', workflowId: 'does-not-exist' },
        cron: '0 0 1 1 *',
        status: 'active',
        nextFireAt: future,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Multiple ticks — schedule is never due, so it stays untouched.
      await mastra.scheduler!.tick();
      await mastra.scheduler!.tick();
      await mastra.scheduler!.tick();

      const afterTicks = await schedulesStore.getSchedule('future-ghost');
      expect(afterTicks).not.toBeNull();

      await mastra.shutdown();
    });
  });

  describe('storage init ordering (#17905)', () => {
    /**
     * Models a SQL store whose tables only exist after init(): writing a
     * workflow snapshot before init() has run throws "no such table", exactly
     * like libSQL/SQLite. The default notification dispatcher is a scheduled
     * workflow whose warm-up tick persists a snapshot at startup, so if
     * startWorkers() doesn't await storage.init() first, that write races
     * table creation and fails.
     */
    class InitOrderProbeStore extends MockStore {
      initialized = false;
      // True if persistWorkflowSnapshot was ever called before init() finished
      // — i.e. the warm-up snapshot write raced table creation.
      sawWriteBeforeInit = false;

      constructor() {
        super();
        // Undo InMemoryStore's "already initialized" shortcut so init() must
        // actually run before the snapshot "table" is considered to exist.
        this.hasInitialized = null as unknown as Promise<boolean>;
        this.shouldCacheInit = true;

        const workflows = this.stores.workflows;
        const realPersist = workflows.persistWorkflowSnapshot.bind(workflows);
        workflows.persistWorkflowSnapshot = async (args: Parameters<typeof realPersist>[0]) => {
          if (!this.initialized) {
            // Record the race and reproduce the libSQL/SQLite symptom.
            this.sawWriteBeforeInit = true;
            throw new Error('no such table: mastra_workflow_snapshot');
          }
          return realPersist(args);
        };
      }

      async init(): Promise<void> {
        await super.init();
        this.initialized = true;
      }
    }

    it('awaits storage.init() before workers start so the scheduler warm-up tick cannot race table creation', async () => {
      const storage = new InitOrderProbeStore();

      // No `notifications.dispatch.enabled: false` — we WANT the default
      // notification dispatcher (a scheduled workflow) registered so the
      // scheduler runs and its warm-up tick persists a snapshot at startup.
      const mastra = new Mastra({ logger: false, storage });

      await mastra.startWorkers();

      // The fix guarantees storage.init() ran before any worker started.
      expect(storage.initialized).toBe(true);

      // Force a scheduler tick and let the fire-and-forget event handling
      // settle, so any snapshot write the dispatcher triggers has run.
      await mastra.scheduler?.tick();
      await flushAsyncInit();

      // Before the fix, the warm-up snapshot write happens while init() is
      // still in flight → "no such table". After the fix, init() is awaited
      // first, so no write ever lands on an uninitialized store.
      expect(storage.sawWriteBeforeInit).toBe(false);

      await mastra.shutdown();
    });
  });
});
