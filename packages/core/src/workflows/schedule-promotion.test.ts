import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
// Importing the evented module registers its factory with the default
// `createWorkflow` registration slot, enabling schedule auto-promotion. In a
// real app this happens transitively because Mastra itself imports from the
// evented module.
import './evented';
import { createWorkflow as createDefaultWorkflow, createStep } from './index';

describe('createWorkflow (default) — schedule promotion to evented', () => {
  it('returns an evented workflow when a schedule is declared', () => {
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

    expect(wf.engineType).toBe('evented');
    // Sanity: the evented surface is reachable.
    expect(typeof (wf as any).getScheduleConfigs).toBe('function');
    expect((wf as any).getScheduleConfigs()).toHaveLength(1);
  });

  it('preserves the default engine when no schedule is declared', () => {
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

    // The default engineType is the empty-string default. The important assertion
    // is that it is *not* 'evented'.
    expect(wf.engineType).not.toBe('evented');
    // Default workflows do not expose getScheduleConfigs.
    expect((wf as any).getScheduleConfigs).toBeUndefined();
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

    expect(wf.engineType).toBe('evented');
    expect((wf as any).getScheduleConfigs()).toHaveLength(2);
  });
});
