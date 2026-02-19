/**
 * Restart domain tests for workflows
 *
 * Tests the ability to restart workflow executions that have completed or failed.
 * NOTE: restart() is only supported on the Default engine.
 * Inngest and Evented engines throw "restart() is not supported on {engine} workflows"
 *
 * Uses MockRegistry pattern for test isolation.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for restart tests.
 */
export function createRestartWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should throw error when restarting workflow that was not active
  {
    mockRegistry.register('restart-not-active:step1', () => vi.fn().mockResolvedValue({ result: 'step1 done' }));

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('restart-not-active:step1')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-not-active',
      steps: [step1],
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['restart-not-active'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-not-active:step1');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should restart a completed workflow execution
  {
    let executionCount = 0;
    mockRegistry.register('restart-completed:counter', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        executionCount++;
        return { count: executionCount, value: inputData.value };
      }),
    );

    // Function to reset execution count (called via resetMocks)
    const resetExecutionCount = () => {
      executionCount = 0;
    };

    const counterStep = createStep({
      id: 'counter',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ count: z.number(), value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-completed:counter')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-completed',
      steps: [counterStep],
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ count: z.number(), value: z.number() }),
    });

    workflow.then(counterStep).commit();

    workflows['restart-completed'] = {
      workflow,
      mocks: {
        get counter() {
          return mockRegistry.get('restart-completed:counter');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        resetExecutionCount();
      },
      getExecutionCount: () => executionCount,
    };
  }

  // Test: should restart workflow with multiple steps
  {
    mockRegistry.register('restart-multistep:step1', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value + 10 })),
    );
    mockRegistry.register('restart-multistep:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value * 2 })),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-multistep:step1')(ctx),
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-multistep:step2')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-multistep',
      steps: [step1, step2],
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['restart-multistep'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-multistep:step1');
        },
        get step2() {
          return mockRegistry.get('restart-multistep:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should restart a failed workflow
  {
    let shouldFail = true;
    mockRegistry.register('restart-failed:failingStep', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        if (shouldFail) {
          throw new Error('Intentional failure');
        }
        return { result: inputData.value.toUpperCase() };
      }),
    );

    const failingStep = createStep({
      id: 'failingStep',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('restart-failed:failingStep')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-failed',
      steps: [failingStep],
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(failingStep).commit();

    workflows['restart-failed'] = {
      workflow,
      mocks: {
        get failingStep() {
          return mockRegistry.get('restart-failed:failingStep');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        shouldFail = true;
      },
      setShouldFail: (val: boolean) => {
        shouldFail = val;
      },
    };
  }

  // Test: should restart workflow with parallel steps
  {
    mockRegistry.register('restart-parallel:step1', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { result: inputData.value * 2 };
      }),
    );
    mockRegistry.register('restart-parallel:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { result: inputData.value + 10 };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ctx => mockRegistry.get('restart-parallel:step1')(ctx),
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ctx => mockRegistry.get('restart-parallel:step2')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-parallel',
      steps: [step1, step2],
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({
        step1: z.object({ result: z.number() }),
        step2: z.object({ result: z.number() }),
      }),
    });

    workflow.parallel([step1, step2]).commit();

    workflows['restart-parallel'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-parallel:step1');
        },
        get step2() {
          return mockRegistry.get('restart-parallel:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should restart a workflow execution that was previously active and has nested workflows
  {
    mockRegistry.register('restart-nested:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('restart-nested:step2', () => vi.fn().mockResolvedValue({ step2Result: 3 }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('restart-nested:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('restart-nested:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ({ inputData }) => ({
        nestedFinal: inputData.step2Result + 1,
      }),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ nestedFinal: z.number() }),
    });

    const step4 = createStep({
      id: 'step4',
      execute: async ({ inputData }) => ({
        final: inputData.nestedFinal + 1,
      }),
      inputSchema: z.object({ nestedFinal: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'restart-nestedWorkflow',
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ nestedFinal: z.number() }),
      steps: [step2, step3],
    })
      .then(step2)
      .then(step3)
      .commit();

    const workflow = createWorkflow({
      id: 'restart-nested',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    })
      .then(step1)
      .then(nestedWorkflow as any)
      .then(step4 as any)
      .commit();

    workflows['restart-nested'] = {
      workflow,
      nestedWorkflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-nested:step1');
        },
        get step2() {
          return mockRegistry.get('restart-nested:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should successfully suspend and resume a restarted workflow execution
  {
    mockRegistry.register('restart-suspend:getUserInput', () => vi.fn().mockResolvedValue({ userInput: 'test input' }));
    mockRegistry.register('restart-suspend:promptAgent', () =>
      vi
        .fn()
        .mockImplementationOnce(async ({ suspend }: any) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' })),
    );
    mockRegistry.register('restart-suspend:evaluateTone', () =>
      vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      }),
    );
    mockRegistry.register('restart-suspend:improveResponse', () =>
      vi
        .fn()
        .mockImplementationOnce(async ({ suspend }: any) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' })),
    );
    mockRegistry.register('restart-suspend:evaluateImproved', () =>
      vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      }),
    );

    const getUserInput = createStep({
      id: 'getUserInput',
      execute: async ctx => mockRegistry.get('restart-suspend:getUserInput')(ctx),
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
    });
    const promptAgent = createStep({
      id: 'promptAgent',
      execute: async ctx => mockRegistry.get('restart-suspend:promptAgent')(ctx),
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
      suspendSchema: z.object({ testPayload: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });
    const evaluateTone = createStep({
      id: 'evaluateToneConsistency',
      execute: async ctx => mockRegistry.get('restart-suspend:evaluateTone')(ctx),
      inputSchema: z.object({ modelOutput: z.string() }),
      outputSchema: z.object({
        toneScore: z.any(),
        completenessScore: z.any(),
      }),
    });
    const improveResponse = createStep({
      id: 'improveResponse',
      execute: async ctx => mockRegistry.get('restart-suspend:improveResponse')(ctx),
      resumeSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
      inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
      outputSchema: z.object({ improvedOutput: z.string() }),
    });
    const evaluateImproved = createStep({
      id: 'evaluateImprovedResponse',
      execute: async ctx => mockRegistry.get('restart-suspend:evaluateImproved')(ctx),
      inputSchema: z.object({ improvedOutput: z.string() }),
      outputSchema: z.object({
        toneScore: z.any(),
        completenessScore: z.any(),
      }),
    });

    const workflow = createWorkflow({
      id: 'restart-suspend-resume',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
    });

    workflow
      .then(getUserInput)
      .then(promptAgent)
      .then(evaluateTone)
      .then(improveResponse)
      .then(evaluateImproved)
      .commit();

    workflows['restart-suspend-resume'] = {
      workflow,
      improveResponseStep: improveResponse,
      mocks: {
        get getUserInput() {
          return mockRegistry.get('restart-suspend:getUserInput');
        },
        get promptAgent() {
          return mockRegistry.get('restart-suspend:promptAgent');
        },
        get evaluateTone() {
          return mockRegistry.get('restart-suspend:evaluateTone');
        },
        get improveResponse() {
          return mockRegistry.get('restart-suspend:improveResponse');
        },
        get evaluateImproved() {
          return mockRegistry.get('restart-suspend:evaluateImproved');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for restart domain.
 *
 * NOTE: These tests only run on the Default engine.
 * Skip the entire 'restart' domain for Inngest and Evented engines.
 */
export function createRestartTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { skipTests } = ctx;

  describe('restart', () => {
    it.skipIf(skipTests.restartNotActive)(
      'should throw error when restarting workflow that was never started',
      async () => {
        const { workflow } = registry!['restart-not-active']!;

        // Create a run but don't start it
        const run = await workflow.createRun();

        // Attempting to restart a never-started workflow should throw
        await expect(run.restart()).rejects.toThrow();
      },
    );

    it.skipIf(skipTests.restartCompleted)('should restart a completed workflow execution', async () => {
      const { workflow, mocks, resetMocks } = registry!['restart-completed']!;
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        // Skip if no storage available
        return;
      }

      const runId = `restart-completed-${Date.now()}`;

      // Simulate a workflow that was interrupted mid-execution (status: 'running')
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0],
          activeStepsPath: { counter: [0] },
          value: {},
          context: {
            input: { value: 42 },
            counter: {
              payload: { value: 42 },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      // Create run with the existing runId and restart it
      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      expect((result.steps.counter as any)?.output).toMatchObject({ count: 1, value: 42 });
      expect(mocks.counter).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.restartMultistep)('should restart workflow with multiple steps', async () => {
      const { workflow, mocks, resetMocks } = registry!['restart-multistep']!;
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        return;
      }

      const runId = `restart-multistep-${Date.now()}`;

      // Simulate a workflow that completed step1 but was interrupted during step2
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step2: [1] },
          value: {},
          context: {
            input: { value: 5 },
            step1: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'success',
              output: { value: 15 }, // 5 + 10 = 15
              endedAt: Date.now(),
            },
            step2: {
              payload: { value: 15 },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      // step2: 15 * 2 = 30
      expect((result.steps.step2 as any)?.output).toEqual({ value: 30 });
      // step1 was already done, step2 runs on restart
      expect(mocks.step1).toHaveBeenCalledTimes(0); // Already completed in snapshot
      expect(mocks.step2).toHaveBeenCalledTimes(1); // Restarted
    });

    it.skipIf(skipTests.restartFailed)('should restart a failed workflow and succeed on retry', async () => {
      const { workflow, mocks, setShouldFail, resetMocks } = registry!['restart-failed']!;
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        return;
      }

      const runId = `restart-failed-${Date.now()}`;

      // Simulate a workflow that was interrupted while running (before it could fail)
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0],
          activeStepsPath: { failingStep: [0] },
          value: {},
          context: {
            input: { value: 'hello' },
            failingStep: {
              payload: { value: 'hello' },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      // Make sure it won't fail on restart
      setShouldFail(false);

      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      expect((result.steps.failingStep as any)?.output).toEqual({ result: 'HELLO' });
      expect(mocks.failingStep).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.restartNested)(
      'should restart a workflow execution that was previously active and has nested workflows',
      async () => {
        const entry = registry!['restart-nested']!;
        const { workflow, nestedWorkflow, mocks, resetMocks } = entry;
        resetMocks?.();

        // Get storage to simulate interrupted workflow
        const mastra = (workflow as any).mastra;
        const storage = mastra?.getStorage();
        const workflowsStore = await storage?.getStore('workflows');

        if (!workflowsStore) {
          return;
        }

        const runId = `restart-nested-${Date.now()}`;

        // Simulate a workflow where step1 completed and nested workflow is running step3
        await workflowsStore.persistWorkflowSnapshot({
          workflowName: workflow.id,
          runId,
          snapshot: {
            runId,
            status: 'running',
            activePaths: [1],
            activeStepsPath: { 'restart-nestedWorkflow': [1] },
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
              'restart-nestedWorkflow': {
                payload: { step1Result: 2 },
                startedAt: Date.now(),
                status: 'running',
              },
            },
            serializedStepGraph: (workflow as any).serializedStepGraph,
            suspendedPaths: {},
            waitingPaths: {},
            resumeLabels: {},
            timestamp: Date.now(),
          },
        });

        // Also simulate the nested workflow state
        await workflowsStore.persistWorkflowSnapshot({
          workflowName: 'restart-nestedWorkflow',
          runId,
          snapshot: {
            runId,
            status: 'running',
            activePaths: [1],
            activeStepsPath: { step3: [1] },
            value: {},
            context: {
              input: { step1Result: 2 },
              step2: {
                payload: { step1Result: 2 },
                startedAt: Date.now(),
                status: 'success',
                output: { step2Result: 3 },
                endedAt: Date.now(),
              },
              step3: {
                payload: { step2Result: 3 },
                startedAt: Date.now(),
                status: 'running',
              },
            },
            serializedStepGraph: (nestedWorkflow as any).serializedStepGraph,
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
            input: { value: 0 },
            step1: {
              status: 'success',
              output: { step1Result: 2 },
              payload: { value: 0 },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
            },
            'restart-nestedWorkflow': {
              status: 'success',
              output: { nestedFinal: 4 },
              payload: { step1Result: 2 },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
            },
            step4: {
              status: 'success',
              output: { final: 5 },
              payload: { nestedFinal: 4 },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
            },
          },
        });

        // step1 was already completed in the snapshot, should not be re-executed
        expect(mocks.step1).toHaveBeenCalledTimes(0);
        // step2 was already completed in the nested snapshot, should not be re-executed
        expect(mocks.step2).toHaveBeenCalledTimes(0);
      },
    );

    it.skipIf(skipTests.restartSuspendResume)(
      'should successfully suspend and resume a restarted workflow execution',
      async () => {
        const entry = registry!['restart-suspend-resume']!;
        const { workflow, improveResponseStep, mocks, resetMocks } = entry;
        resetMocks?.();

        // Get storage to simulate interrupted workflow
        const mastra = (workflow as any).mastra;
        const storage = mastra?.getStorage();
        const workflowsStore = await storage?.getStore('workflows');

        if (!workflowsStore) {
          return;
        }

        const runId = `restart-suspend-${Date.now()}`;

        // Simulate a workflow that was running promptAgent step
        await workflowsStore.persistWorkflowSnapshot({
          workflowName: workflow.id,
          runId,
          snapshot: {
            runId,
            status: 'running',
            activePaths: [1],
            activeStepsPath: { promptAgent: [1] },
            value: {},
            context: {
              input: { input: 'test' },
              getUserInput: {
                payload: { input: 'test' },
                startedAt: Date.now(),
                status: 'success',
                output: { userInput: 'test input' },
                endedAt: Date.now(),
              },
              promptAgent: {
                payload: { userInput: 'test input' },
                startedAt: Date.now(),
                status: 'running',
              },
            },
            serializedStepGraph: (workflow as any).serializedStepGraph,
            suspendedPaths: {},
            waitingPaths: {},
            resumeLabels: {},
            timestamp: Date.now(),
          },
        });

        // Restart should trigger promptAgent to suspend
        const run = await workflow.createRun({ runId });
        const initialResult = await run.restart();

        expect(initialResult.steps.promptAgent!.status).toBe('suspended');
        expect(mocks.promptAgent).toHaveBeenCalledTimes(1);
        expect(initialResult.steps).toMatchObject({
          input: { input: 'test' },
          getUserInput: {
            status: 'success',
            output: { userInput: 'test input' },
            payload: { input: 'test' },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          promptAgent: {
            status: 'suspended',
            payload: { userInput: 'test input' },
            suspendPayload: { testPayload: 'hello' },
            startedAt: expect.any(Number),
            suspendedAt: expect.any(Number),
          },
        });

        // Resume promptAgent - should continue to evaluateTone, then improveResponse suspends
        const firstResumeResult = await run.resume({
          step: 'promptAgent',
          resumeData: { userInput: 'test input for resumption' },
        });
        if (!firstResumeResult) {
          throw new Error('Resume failed to return a result');
        }

        expect(firstResumeResult.steps).toMatchObject({
          promptAgent: {
            status: 'success',
            output: { modelOutput: 'test output' },
          },
          evaluateToneConsistency: {
            status: 'success',
            output: {
              toneScore: { score: 0.8 },
              completenessScore: { score: 0.7 },
            },
          },
          improveResponse: {
            status: 'suspended',
          },
        });

        // Resume improveResponse - should complete the entire workflow
        const secondResumeResult = await run.resume({
          step: improveResponseStep,
          resumeData: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
        });
        if (!secondResumeResult) {
          throw new Error('Resume failed to return a result');
        }

        expect(secondResumeResult.steps).toMatchObject({
          improveResponse: {
            status: 'success',
            output: { improvedOutput: 'improved output' },
          },
          evaluateImprovedResponse: {
            status: 'success',
            output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          },
        });

        expect(mocks.promptAgent).toHaveBeenCalledTimes(2);
        expect(mocks.getUserInput).toHaveBeenCalledTimes(0);
      },
    );

    it.skipIf(skipTests.restartParallel)('should restart workflow with parallel steps', async () => {
      const { workflow, mocks, resetMocks } = registry!['restart-parallel']!;
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        return;
      }

      const runId = `restart-parallel-${Date.now()}`;

      // Simulate a workflow that was interrupted during parallel execution
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0, 0], // Both parallel paths active
          activeStepsPath: { step1: [0], step2: [0] },
          value: {},
          context: {
            input: { value: 5 },
            step1: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'running',
            },
            step2: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      // step1: 5 * 2 = 10, step2: 5 + 10 = 15
      expect((result.steps.step1 as any)?.output).toEqual({ result: 10 });
      expect((result.steps.step2 as any)?.output).toEqual({ result: 15 });
      expect(mocks.step1).toHaveBeenCalledTimes(1);
      expect(mocks.step2).toHaveBeenCalledTimes(1);
    });
  });
}
