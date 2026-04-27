import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from './workflow';

describe('createWorkflow (evented) — schedule config', () => {
  it('stores a valid schedule config and exposes it via getScheduleConfig()', () => {
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

    const config = wf.getScheduleConfig();
    expect(config).toBeDefined();
    expect(config?.cron).toBe('*/5 * * * *');
    expect(config?.timezone).toBe('UTC');
    expect(config?.inputData).toEqual({ hello: 'world' });
  });

  it('returns undefined when no schedule is configured', () => {
    const wf = createWorkflow({
      id: 'unscheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    expect(wf.getScheduleConfig()).toBeUndefined();
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
});
