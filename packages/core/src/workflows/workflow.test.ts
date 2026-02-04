import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from './workflow';

/**
 * Default engine-specific workflow tests.
 *
 * Tests for general workflow behavior (basic execution, conditions, loops, streaming,
 * agents, etc.) are covered by the shared test suite in workflows/_test-utils.
 *
 * This file contains only tests specific to the default engine implementation that
 * cannot be shared across engines:
 * - Restart (evented engine doesn't support restart)
 * - startAsync (default engine specific API)
 */

const testStorage = new MockStore();

describe('Workflow (Default Engine Specifics)', () => {
  describe('Restart', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });

    it('should throw error if trying to restart a workflow execution that was not previously active', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const runId = 'test-run-id';

      const run = await workflow.createRun({ runId });
      await expect(run.restart()).rejects.toThrow('This workflow run was not active');

      const result = await run.start({ inputData: { value: 0 } });

      expect(result.status).toBe('success');

      await expect(run.restart()).rejects.toThrow('This workflow run was not active');

      expect(execute).toHaveBeenCalled();
    });

    it('should restart a workflow execution that was previously active', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();
      const workflowsStore = await storage?.getStore('workflows');
      expect(workflowsStore).toBeDefined();

      //mimic a workflow run that was previously active
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: 'testWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step2: [1] },
          value: {},
          context: {
            input: { value: 0 },
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: workflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });
      const restartResult = await run.restart();

      expect(restartResult.status).toBe('success');
      expect(restartResult).toMatchObject({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 4,
            },
            endedAt: expect.any(Number),
          },
        },
        input: {
          value: 0,
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
    });
  });

  describe('startAsync', () => {
    it('should start workflow and complete successfully', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-startAsync-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      new Mastra({
        storage: testStorage,
        workflows: { 'test-startAsync-workflow': workflow },
      });

      const run = await workflow.createRun();
      const { runId } = await run.startAsync({ inputData: {} });

      expect(runId).toBe(run.runId);

      // Poll for completion
      let result;
      for (let i = 0; i < 10; i++) {
        result = await workflow.getWorkflowRunById(runId);
        if (result?.status === 'success') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(result?.status).toBe('success');
      expect(result?.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });
});
