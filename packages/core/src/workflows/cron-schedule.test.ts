import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { parseCron, validateCron, getNextCronDate } from './cron';
import { createStep, createWorkflow } from './workflow';

/**
 * Tests for GitHub Issue #12682: [FEATURE] Workflow CronJob | Schedule
 *
 * Covers:
 * 1. Cron expression parser — ranges, steps, lists, wildcards, validation
 * 2. `getNextCronDate` — next fire time computation with DOM/DOW OR semantics
 * 3. `WorkflowConfig.schedule` — config acceptance and introspection
 * 4. Mastra lifecycle — scheduler start, execution, shutdown, listing
 */

const billingStep = createStep({
  id: 'process-billing',
  inputSchema: z.object({}),
  outputSchema: z.object({ processed: z.boolean() }),
  execute: async () => {
    return { processed: true };
  },
});

describe('Cron parser (parseCron)', () => {
  it('should parse a wildcard field into the full range', () => {
    const fields = parseCron('* * * * *');
    expect(fields.minutes.size).toBe(60); // 0-59
    expect(fields.hours.size).toBe(24); // 0-23
    expect(fields.daysOfMonth.size).toBe(31); // 1-31
    expect(fields.months.size).toBe(12); // 1-12
    expect(fields.daysOfWeek.size).toBe(7); // 0-6
  });

  it('should parse single values', () => {
    const fields = parseCron('30 12 15 6 3');
    expect([...fields.minutes]).toEqual([30]);
    expect([...fields.hours]).toEqual([12]);
    expect([...fields.daysOfMonth]).toEqual([15]);
    expect([...fields.months]).toEqual([6]);
    expect([...fields.daysOfWeek]).toEqual([3]);
  });

  it('should parse ranges (N-M)', () => {
    const fields = parseCron('1-5 * * * *');
    expect([...fields.minutes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should parse lists (N,M,O)', () => {
    const fields = parseCron('0,15,30,45 * * * *');
    expect([...fields.minutes].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });

  it('should parse step values (*/N)', () => {
    const fields = parseCron('*/15 * * * *');
    expect([...fields.minutes].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });

  it('should parse range with step (N-M/S)', () => {
    const fields = parseCron('10-30/5 * * * *');
    expect([...fields.minutes].sort((a, b) => a - b)).toEqual([10, 15, 20, 25, 30]);
  });

  it('should normalize day-of-week 7 to 0 (both mean Sunday)', () => {
    const fields = parseCron('* * * * 7');
    expect(fields.daysOfWeek.has(0)).toBe(true);
    expect(fields.daysOfWeek.has(7)).toBe(false);
  });

  it('should track domWildcard and dowWildcard correctly', () => {
    const both = parseCron('* * * * *');
    expect(both.domWildcard).toBe(true);
    expect(both.dowWildcard).toBe(true);

    const domOnly = parseCron('* * 15 * *');
    expect(domOnly.domWildcard).toBe(false);
    expect(domOnly.dowWildcard).toBe(true);

    const dowOnly = parseCron('* * * * 1');
    expect(dowOnly.domWildcard).toBe(true);
    expect(dowOnly.dowWildcard).toBe(false);

    const neither = parseCron('* * 15 * 1');
    expect(neither.domWildcard).toBe(false);
    expect(neither.dowWildcard).toBe(false);
  });

  it('should throw on wrong number of fields', () => {
    expect(() => parseCron('* * *')).toThrow('expected 5 fields');
    expect(() => parseCron('* * * * * *')).toThrow('expected 5 fields');
  });

  it('should throw on out-of-range values', () => {
    expect(() => parseCron('60 * * * *')).toThrow('out of range');
    expect(() => parseCron('* 24 * * *')).toThrow('out of range');
    expect(() => parseCron('* * 0 * *')).toThrow('out of range');
    expect(() => parseCron('* * * 13 *')).toThrow('out of range');
    expect(() => parseCron('* * * * 8')).toThrow('out of range');
  });

  it('should throw on invalid step values', () => {
    expect(() => parseCron('*/0 * * * *')).toThrow('Invalid cron step');
    expect(() => parseCron('*/abc * * * *')).toThrow('Invalid cron step');
  });

  it('should throw on non-numeric values', () => {
    expect(() => parseCron('abc * * * *')).toThrow('Invalid cron value');
  });
});

describe('validateCron', () => {
  it('should return true for valid expressions', () => {
    expect(validateCron('* * * * *')).toBe(true);
    expect(validateCron('0 0 * * *')).toBe(true);
    expect(validateCron('*/15 9-17 * * 1-5')).toBe(true);
  });

  it('should return false for invalid expressions', () => {
    expect(validateCron('not-valid')).toBe(false);
    expect(validateCron('60 * * * *')).toBe(false);
    expect(validateCron('')).toBe(false);
  });
});

describe('getNextCronDate', () => {
  it('should return the next matching minute', () => {
    // From 2026-01-15 10:30:00, next "0 * * * *" = 2026-01-15 11:00
    const from = new Date(2026, 0, 15, 10, 30, 0);
    const next = getNextCronDate('0 * * * *', from);
    expect(next.getHours()).toBe(11);
    expect(next.getMinutes()).toBe(0);
  });

  it('should skip non-matching hours', () => {
    // From 2026-01-15 18:00:00, next "0 9 * * *" = 2026-01-16 09:00
    const from = new Date(2026, 0, 15, 18, 0, 0);
    const next = getNextCronDate('0 9 * * *', from);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it('should skip non-matching months', () => {
    // From 2026-03-01 00:00:00, next "0 0 1 6 *" = 2026-06-01 00:00
    const from = new Date(2026, 2, 1, 0, 0, 0);
    const next = getNextCronDate('0 0 1 6 *', from);
    expect(next.getMonth()).toBe(5); // June (0-indexed)
    expect(next.getDate()).toBe(1);
  });

  it('should accept pre-parsed CronFields', () => {
    const fields = parseCron('0 12 * * *');
    const from = new Date(2026, 0, 1, 0, 0, 0);
    const next = getNextCronDate(fields, from);
    expect(next.getHours()).toBe(12);
    expect(next.getMinutes()).toBe(0);
  });

  describe('DOM/DOW OR semantics', () => {
    it('should fire on the 15th OR on Mondays when both are restricted', () => {
      // "0 0 15 * 1" = midnight on the 15th OR any Monday
      // From 2026-01-01 (Thursday)
      const from = new Date(2026, 0, 1, 0, 0, 0);
      const next = getNextCronDate('0 0 15 * 1', from);

      // 2026-01-05 is Monday, 2026-01-15 is Thursday
      // Monday (Jan 5) comes first
      expect(next.getDate()).toBe(5);
      expect(next.getDay()).toBe(1); // Monday
    });

    it('should fire on a day-of-month when only DOM is restricted', () => {
      // "0 0 15 * *" = midnight on the 15th (DOW is wildcard)
      const from = new Date(2026, 0, 1, 0, 0, 0);
      const next = getNextCronDate('0 0 15 * *', from);
      expect(next.getDate()).toBe(15);
    });

    it('should fire on a day-of-week when only DOW is restricted', () => {
      // "0 0 * * 5" = midnight on Fridays (DOM is wildcard)
      const from = new Date(2026, 0, 1, 0, 0, 0); // Thursday
      const next = getNextCronDate('0 0 * * 5', from);
      expect(next.getDay()).toBe(5); // Friday
      expect(next.getDate()).toBe(2); // Jan 2 2026 is Friday
    });
  });
});

describe('Workflow Cron Schedule (Issue #12682)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('WorkflowConfig.schedule', () => {
    it('should accept a cron expression in the workflow config', () => {
      const workflow = createWorkflow({
        id: 'billing-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [billingStep],
        schedule: {
          cron: '0 0 * * *', // Every day at midnight
        },
      });

      workflow.then(billingStep).commit();

      expect(workflow.schedule).toBeDefined();
      expect(workflow.schedule?.cron).toBe('0 0 * * *');
    });

    it('should accept optional inputData for scheduled runs', () => {
      const stepWithInput = createStep({
        id: 'process-with-input',
        inputSchema: z.object({ region: z.string() }),
        outputSchema: z.object({ processed: z.boolean() }),
        execute: async () => {
          return { processed: true };
        },
      });

      const workflow = createWorkflow({
        id: 'regional-billing',
        inputSchema: z.object({ region: z.string() }),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [stepWithInput],
        schedule: {
          cron: '0 0 * * *',
          inputData: { region: 'us-east-1' },
        },
      });

      workflow.then(stepWithInput).commit();

      expect(workflow.schedule?.inputData).toEqual({ region: 'us-east-1' });
    });

    it('should accept a human-readable description for the schedule', () => {
      const workflow = createWorkflow({
        id: 'described-schedule',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [billingStep],
        schedule: {
          cron: '0 0 * * *',
          description: 'Process billing every day at midnight',
        },
      });

      workflow.then(billingStep).commit();

      expect(workflow.schedule?.description).toBe('Process billing every day at midnight');
    });
  });

  describe('Mastra scheduled workflow lifecycle', () => {
    it('should automatically execute scheduled workflows on cron intervals', async () => {
      const executeSpy = vi.fn().mockResolvedValue({ processed: true });

      const step = createStep({
        id: 'spy-step',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        execute: executeSpy,
      });

      const workflow = createWorkflow({
        id: 'auto-scheduled',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [step],
        schedule: {
          cron: '* * * * *', // Every minute
        },
      });

      workflow.then(step).commit();

      const mastra = new Mastra({
        workflows: { 'auto-scheduled': workflow },
      });

      mastra.startScheduler();

      // Advance time by 1 minute to trigger the cron
      await vi.advanceTimersByTimeAsync(60_000);

      // The workflow should have been executed once
      expect(executeSpy).toHaveBeenCalledTimes(1);

      // Advance another minute
      await vi.advanceTimersByTimeAsync(60_000);

      expect(executeSpy).toHaveBeenCalledTimes(2);

      await mastra.shutdown();
    });

    it('should clean up cron timers on mastra.shutdown()', async () => {
      const executeSpy = vi.fn().mockResolvedValue({ processed: true });

      const step = createStep({
        id: 'cleanup-step',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        execute: executeSpy,
      });

      const workflow = createWorkflow({
        id: 'cleanup-test',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [step],
        schedule: {
          cron: '* * * * *',
        },
      });

      workflow.then(step).commit();

      const mastra = new Mastra({
        workflows: { 'cleanup-test': workflow },
      });

      mastra.startScheduler();

      // Trigger once
      await vi.advanceTimersByTimeAsync(60_000);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      // Shutdown should stop the scheduler
      await mastra.shutdown();

      // Advancing time after shutdown should NOT trigger another run
      await vi.advanceTimersByTimeAsync(60_000);
      expect(executeSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should list scheduled workflows with their cron configs', () => {
      const workflow = createWorkflow({
        id: 'list-test',
        inputSchema: z.object({}),
        outputSchema: z.object({ processed: z.boolean() }),
        steps: [billingStep],
        schedule: {
          cron: '0 0 * * *',
        },
      });

      workflow.then(billingStep).commit();

      const mastra = new Mastra({
        workflows: { 'list-test': workflow },
      });

      const scheduledWorkflows = mastra.listScheduledWorkflows();

      expect(scheduledWorkflows).toHaveLength(1);
      expect(scheduledWorkflows[0]).toEqual(
        expect.objectContaining({
          workflowId: 'list-test',
          cron: '0 0 * * *',
        }),
      );
    });
  });

  describe('Schedule validation', () => {
    it('should reject invalid cron expressions', () => {
      expect(() => {
        const workflow = createWorkflow({
          id: 'invalid-cron',
          inputSchema: z.object({}),
          outputSchema: z.object({ processed: z.boolean() }),
          steps: [billingStep],
          schedule: {
            cron: 'not-a-valid-cron',
          },
        });

        workflow.then(billingStep).commit();
      }).toThrow();
    });
  });
});
