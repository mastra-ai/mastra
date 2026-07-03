import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow as createDefaultWorkflow, createStep } from './index';

describe('createWorkflow (default) — schedules', () => {
  it('retains default engine when a schedule is declared but exposes configs', () => {
    const step = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });

    const wf = createDefaultWorkflow({
      id: 'promoted-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '*/5 * * * *' },
    })
      .then(step)
      .commit();

    expect(wf.engineType).toBe('default');
    // Sanity: the evented surface is reachable.
    expect(typeof (wf as any).getScheduleConfigs).toBe('function');
    expect((wf as any).getScheduleConfigs()).toHaveLength(1);
  });

  it('preserves the default engine and returns empty schedule configs when no schedule is declared', () => {
    const step = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });

    const wf = createDefaultWorkflow({
      id: 'plain-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(step)
      .commit();

    expect(wf.engineType).toBe('default');
    expect(wf.getScheduleConfigs()).toEqual([]);
  });

  it('validates cron at construction time on the default factory', () => {
    expect(() =>
      createDefaultWorkflow({
        id: 'bad-cron-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: { cron: 'not a cron' },
      }),
    ).toThrow();
  });

  it('accepts the array-form schedule on the default factory', () => {
    const wf = createDefaultWorkflow({
      id: 'multi-promoted-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: [
        { id: 'morning', cron: '0 9 * * *' },
        { id: 'evening', cron: '0 18 * * *' },
      ],
    });

    expect(wf.engineType).toBe('default');
    expect(wf.getScheduleConfigs()).toHaveLength(2);
  });

  it('executes in-process via DefaultExecutionEngine when started manually even with a schedule declared', async () => {
    const step = createStep({
      id: 'step1',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => ({ value: 'hello' }),
    });

    const wf = createDefaultWorkflow({
      id: 'run-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      schedule: { cron: '*/5 * * * *' },
    })
      .then(step)
      .commit();

    expect(wf.engineType).toBe('default');

    const run = await wf.createRun();
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ value: 'hello' });
    }
  });
});
