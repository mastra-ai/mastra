import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockStore } from '../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../workflows';
import { createStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { Mastra } from './index';

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
    await new Promise(resolve => setTimeout(resolve, 50));

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

    await new Promise(resolve => setTimeout(resolve, 50));

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

    await new Promise(resolve => setTimeout(resolve, 50));

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

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mastra.scheduler).toBeDefined();
    expect(mastra.scheduler!.isRunning).toBe(true);

    await mastra.shutdown();
  });

  it('throws when a non-evented workflow declares a schedule', () => {
    const wf = createDefaultWorkflow({
      id: 'default-engine-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    // Inject a fake schedule getter to simulate a default-engine workflow with a schedule.
    (wf as unknown as { getScheduleConfig: () => unknown }).getScheduleConfig = () => ({ cron: '*/5 * * * *' });

    expect(
      () =>
        new Mastra({
          logger: false,
          storage: new MockStore(),
          workflows: { wf } as any,
        }),
    ).toThrow(/evented engine/i);
  });

  it('starts the scheduler when scheduler.enabled is true even with no scheduled workflows', async () => {
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      scheduler: { enabled: true },
    });

    await new Promise(resolve => setTimeout(resolve, 50));
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
      await new Promise(resolve => setTimeout(resolve, 50));
      return mastra;
    };

    it('rewrites cron and recomputes nextFireAt when the cron expression changes', async () => {
      const storage = new MockStore();

      const first = await boot(storage, buildScheduledWorkflow({ cron: '*/5 * * * *' }));
      const schedulesStore = (await storage.getStore('schedules'))!;
      const initial = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(initial?.cron).toBe('*/5 * * * *');
      const initialNextFireAt = initial!.nextFireAt;
      await first.shutdown();

      const second = await boot(storage, buildScheduledWorkflow({ cron: '0 * * * *' }));
      const updated = await schedulesStore.getSchedule('wf_rolling-wf');
      expect(updated?.cron).toBe('0 * * * *');
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
});
