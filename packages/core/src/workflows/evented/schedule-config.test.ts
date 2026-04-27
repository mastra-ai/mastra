import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from './workflow';

describe('createWorkflow (evented) — schedule config', () => {
  it('stores a valid single schedule config and exposes it via getScheduleConfigs()', () => {
    const wf = createWorkflow({
      id: 'scheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: {
        cron: '*/5 * * * *',
        timezone: 'UTC',
        inputData: { hello: 'world' },
      },
    });

    const configs = wf.getScheduleConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0]!.cron).toBe('*/5 * * * *');
    expect(configs[0]!.timezone).toBe('UTC');
    expect(configs[0]!.inputData).toEqual({ hello: 'world' });
  });

  it('returns an empty array when no schedule is configured', () => {
    const wf = createWorkflow({
      id: 'unscheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    expect(wf.getScheduleConfigs()).toEqual([]);
  });

  it('stores an array of schedules and exposes them via getScheduleConfigs()', () => {
    const wf = createWorkflow({
      id: 'multi-scheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: [
        { id: 'morning', cron: '0 9 * * *', inputData: { window: 'morning' } },
        { id: 'evening', cron: '0 18 * * *', inputData: { window: 'evening' } },
      ],
    });

    const configs = wf.getScheduleConfigs();
    expect(configs).toHaveLength(2);
    expect(configs.map(c => c.id)).toEqual(['morning', 'evening']);
  });

  it('throws when an array entry is missing the required id', () => {
    expect(() =>
      createWorkflow({
        id: 'bad-array-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: [{ cron: '*/5 * * * *' } as any, { id: 'b', cron: '0 0 * * *' }],
      }),
    ).toThrow(/missing the required `id`/);
  });

  it('throws when array entries have duplicate ids', () => {
    expect(() =>
      createWorkflow({
        id: 'dup-id-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: [
          { id: 'same', cron: '*/5 * * * *' },
          { id: 'same', cron: '0 0 * * *' },
        ],
      }),
    ).toThrow(/duplicate schedule id/);
  });

  it('throws synchronously on an invalid cron expression', () => {
    expect(() =>
      createWorkflow({
        id: 'bad-cron-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: { cron: 'not a cron' },
      }),
    ).toThrow();
  });

  it('throws on an invalid timezone', () => {
    expect(() =>
      createWorkflow({
        id: 'bad-tz-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: { cron: '*/5 * * * *', timezone: 'Not/AZone' },
      }),
    ).toThrow();
  });

  it('validates cron on every entry of an array form', () => {
    expect(() =>
      createWorkflow({
        id: 'mixed-bad-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: [
          { id: 'good', cron: '*/5 * * * *' },
          { id: 'bad', cron: 'not a cron' },
        ],
      }),
    ).toThrow();
  });
});
