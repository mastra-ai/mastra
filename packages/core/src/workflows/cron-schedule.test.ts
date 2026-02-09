import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { createStep, createWorkflow } from './workflow';

/**
 * Failing tests for GitHub Issue #12682: [FEATURE] Workflow CronJob | Schedule
 *
 * These tests define the expected API for native cron scheduling support
 * in Mastra workflows. Currently, cron scheduling is only available through
 * the external Inngest integration — these tests prove that the core
 * `createWorkflow` and `Mastra` class do NOT support cron natively.
 *
 * Expected feature behavior:
 * 1. `WorkflowConfig` accepts a `schedule` option with a cron expression
 * 2. When Mastra is initialized with scheduled workflows, it starts cron timers
 * 3. Scheduled workflows fire automatically at the specified cron intervals
 * 4. `mastra.shutdown()` cleans up all scheduled cron timers
 * 5. Scheduled workflows can provide default inputData
 * 6. Workflows expose their schedule configuration for introspection
 */

const billingStep = createStep({
  id: 'process-billing',
  inputSchema: z.object({}),
  outputSchema: z.object({ processed: z.boolean() }),
  execute: async () => {
    return { processed: true };
  },
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
      // The createWorkflow factory should accept a `schedule` config
      // with at minimum a `cron` field for cron expression syntax.
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

      // The workflow should expose its schedule configuration
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

      // Start the scheduler — this should activate cron timers for all
      // workflows that have a `schedule` config.
      await mastra.startScheduler();

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

      await mastra.startScheduler();

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

      // Should be able to list scheduled workflows
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
