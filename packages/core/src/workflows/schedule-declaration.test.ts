import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { rehydrateWorkflow } from './dynamic/rehydrate';
import { createWorkflow as createExplicitEventedWorkflow } from './evented/workflow';
import { createWorkflow, createStep } from './index';

const noop = createStep({
  id: 'noop',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({}),
});

function scheduled(id: string, schedule: any = { cron: '*/5 * * * *' }) {
  return createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    schedule,
  })
    .then(noop)
    .commit();
}

let warn: ReturnType<typeof vi.spyOn>;
const promotionWarnings = () =>
  warn.mock.calls.filter(([message]) => String(message).includes('MASTRA_WORKERS is set'));

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('createWorkflow — declaring a schedule', () => {
  describe('without MASTRA_WORKERS', () => {
    it('keeps the default engine and exposes a single schedule', () => {
      vi.stubEnv('MASTRA_WORKERS', undefined);
      const wf = scheduled('declared-single');

      expect(wf.engineType).toBe('default');
      expect(promotionWarnings()).toHaveLength(0);
      expect(wf.getScheduleConfigs()).toEqual([{ cron: '*/5 * * * *' }]);
    });

    it('keeps the default engine for the array form', () => {
      vi.stubEnv('MASTRA_WORKERS', undefined);
      const wf = scheduled('declared-multi', [
        { id: 'morning', cron: '0 9 * * *' },
        { id: 'evening', cron: '0 18 * * *' },
      ]);

      expect(wf.engineType).toBe('default');
      expect(wf.getScheduleConfigs().map(s => s.id)).toEqual(['morning', 'evening']);
    });

    it('treats a whitespace-only value as unset', () => {
      vi.stubEnv('MASTRA_WORKERS', '   ');
      const wf = scheduled('declared-whitespace');

      expect(wf.engineType).toBe('default');
      expect(promotionWarnings()).toHaveLength(0);
    });

    it('returns copies from getScheduleConfigs', () => {
      vi.stubEnv('MASTRA_WORKERS', undefined);
      const wf = scheduled('declared-copies');
      wf.getScheduleConfigs()[0]!.cron = '0 0 * * *';

      expect(wf.getScheduleConfigs()[0]!.cron).toBe('*/5 * * * *');
    });

    it('returns no schedules for an unscheduled workflow', () => {
      const wf = createWorkflow({ id: 'unscheduled', inputSchema: z.object({}), outputSchema: z.object({}) })
        .then(noop)
        .commit();

      expect(wf.engineType).toBe('default');
      expect(wf.getScheduleConfigs()).toEqual([]);
    });
  });

  describe.each([['false'], ['scheduler'], ['scheduler,orchestration']])('with MASTRA_WORKERS=%s', value => {
    it('promotes a scheduled workflow to the evented engine and warns once', () => {
      vi.stubEnv('MASTRA_WORKERS', value);
      const wf = scheduled(`promoted-${value}`);

      expect(wf.engineType).toBe('evented');
      expect(promotionWarnings()).toHaveLength(1);
      expect(String(promotionWarnings()[0]![0])).toContain(`"promoted-${value}"`);
      expect(wf.getScheduleConfigs()).toHaveLength(1);
    });

    it('leaves unscheduled workflows on the default engine', () => {
      vi.stubEnv('MASTRA_WORKERS', value);
      const wf = createWorkflow({ id: `plain-${value}`, inputSchema: z.object({}), outputSchema: z.object({}) })
        .then(noop)
        .commit();

      expect(wf.engineType).toBe('default');
      expect(promotionWarnings()).toHaveLength(0);
    });
  });

  describe.each([
    ['unset', undefined],
    ['set', 'scheduler'],
  ])('validation with MASTRA_WORKERS %s', (_label, value) => {
    it('rejects an invalid cron at construction', () => {
      vi.stubEnv('MASTRA_WORKERS', value);
      expect(() => scheduled('bad-cron', { cron: 'not a cron' })).toThrow();
    });

    it('rejects array entries without an id', () => {
      vi.stubEnv('MASTRA_WORKERS', value);
      expect(() => scheduled('missing-id', [{ cron: '0 9 * * *' }, { id: 'b', cron: '0 18 * * *' }])).toThrow(/id/);
    });

    it('rejects duplicate array ids', () => {
      vi.stubEnv('MASTRA_WORKERS', value);
      expect(() =>
        scheduled('duplicate-id', [
          { id: 'a', cron: '0 9 * * *' },
          { id: 'a', cron: '0 18 * * *' },
        ]),
      ).toThrow(/a/);
    });
  });

  it('explicit evented workflows expose their schedules without a promotion warning', () => {
    vi.stubEnv('MASTRA_WORKERS', 'scheduler');
    const wf = createExplicitEventedWorkflow({
      id: 'explicit-evented',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '0 * * * *' },
    })
      .then(noop)
      .commit();

    expect(wf.engineType).toBe('evented');
    expect(wf.getScheduleConfigs()).toHaveLength(1);
    expect(promotionWarnings()).toHaveLength(0);
  });
});

describe('rehydrateWorkflow — scheduled definitions', () => {
  const def = {
    id: 'rehydrated-scheduled',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    graph: [],
    schedule: { cron: '*/10 * * * *' },
  } as const;

  it('follows the MASTRA_WORKERS rule when no engine is stored', async () => {
    const mastra = new Mastra({ logger: false });

    vi.stubEnv('MASTRA_WORKERS', undefined);
    const { workflow: plain } = await rehydrateWorkflow(def as any, mastra);
    expect(plain.engineType).toBe('default');
    expect(plain.getScheduleConfigs()).toHaveLength(1);

    vi.stubEnv('MASTRA_WORKERS', 'false');
    const { workflow: promoted } = await rehydrateWorkflow(def as any, mastra);
    expect(promoted.engineType).toBe('evented');
    expect(promotionWarnings()).toHaveLength(1);
  });

  it('keeps a stored evented engine regardless of MASTRA_WORKERS', async () => {
    const mastra = new Mastra({ logger: false });
    vi.stubEnv('MASTRA_WORKERS', undefined);

    const { workflow } = await rehydrateWorkflow(def as any, mastra, { engineType: 'evented' });

    expect(workflow.engineType).toBe('evented');
    expect(promotionWarnings()).toHaveLength(0);
  });
});
