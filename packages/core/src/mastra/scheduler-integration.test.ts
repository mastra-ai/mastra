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
});
