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
      storage: new MockStore(),
      workflows: { wf } as any,
    });

    // Allow the async scheduler init to complete.
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
    const getStoreSpy = vi.spyOn(storage, 'getStore');

    const mastra = new Mastra({
      logger: false,
      storage,
    });

    await flushAsyncInit();

    expect(mastra.scheduler).toBeUndefined();
    // Prove the scheduler never touched the schedules domain.
    expect(getStoreSpy.mock.calls.some(call => call[0] === 'schedules')).toBe(false);

    await mastra.shutdown();
  });

  it('does not instantiate the scheduler when only unscheduled workflows are registered', async () => {
    const storage = new MockStore();
    const getStoreSpy = vi.spyOn(storage, 'getStore');

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
      storage,
      workflows: { wf } as any,
    });

    await flushAsyncInit();

    expect(mastra.scheduler).toBeUndefined();
    expect(getStoreSpy.mock.calls.some(call => call[0] === 'schedules')).toBe(false);

    await mastra.shutdown();
  });

  it('instantiates the scheduler when explicitly enabled even without declarative schedules', async () => {
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      scheduler: { enabled: true },
    });

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
      storage: new MockStore(),
      workflows: { wf: wf as any },
    });

    // The scheduler picks the workflow up because it's evented now and has a schedule.
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
      storage: new MockStore(),
      scheduler: { enabled: true },
    });

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
        storage,
        workflows: { wf } as any,
      });
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
        storage,
        workflows: { wf } as any,
      });
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
      const first = new Mastra({ logger: false, storage, workflows: { wfSingle } as any });
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

    it('does not delete schedule rows belonging to non-registered workflows', async () => {
      const storage = new MockStore();
      const mastra = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const schedulesStore = (await storage.getStore('schedules'))!;

      // Manually insert a row for an unrelated workflow.
      await schedulesStore.createSchedule({
        id: 'wf_unrelated__job',
        target: { type: 'workflow', workflowId: 'unrelated' },
        cron: '0 0 * * *',
        status: 'active',
        nextFireAt: Date.now() + 60_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Reboot with the same registered workflow set; orphan deletion must
      // not touch rows owned by workflows we don't have registered.
      await mastra.shutdown();
      const second = await boot(storage, buildMultiScheduledWorkflow([{ id: 'a', cron: '0 9 * * *' }]));
      const ids = (await schedulesStore.listSchedules()).map(r => r.id).sort();
      expect(ids).toContain('wf_unrelated__job');
      await second.shutdown();
    });
  });
});
