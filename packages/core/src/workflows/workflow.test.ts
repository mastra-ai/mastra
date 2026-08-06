import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type {
  WorkflowResult,
  ResumeWorkflowOptions,
  TimeTravelWorkflowOptions,
  StreamWorkflowResult,
  StreamEvent,
} from '@internal/workflow-test-utils';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { MastraNonRetryableError } from '../error';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from '../loop/test-utils/MastraLanguageModelV2Mock';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { MockStore } from '../storage/mock';
import { createTool } from '../tools/tool';
import { PUBSUB_SYMBOL } from './constants';
import { createWorkflow } from './create';
import type { Workflow } from './types';
import { createStep } from './workflow';

// ============================================================================
// Shared Test Suite (Default Engine)
// ============================================================================

// Shared storage for all tests - provides persistence for resume tests
const sharedStorage = new MockStore();

// Create a shared Mastra instance for tests that need it
let _mastra: Mastra;

createWorkflowTestSuite({
  name: 'Workflow (Default Engine)',

  getWorkflowFactory: () => {
    return { createWorkflow, createStep, createTool, Agent };
  },

  // Register workflows with Mastra for storage/resume support
  registerWorkflows: async registry => {
    // Collect all workflows + any Mastra-level agents/tools the entries declare
    // (used by `.agent('id')` / `.tool('id')` by-id forms).
    const workflows: Record<string, any> = {};
    const agents: Record<string, any> = {};
    const tools: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow;
      if (entry.mastraAgents) Object.assign(agents, entry.mastraAgents);
      if (entry.mastraTools) Object.assign(tools, entry.mastraTools);
    }

    // Create Mastra with all workflows - this automatically binds mastra to each workflow
    _mastra = new Mastra({
      logger: false,
      storage: sharedStorage,
      workflows,
      agents: Object.keys(agents).length ? agents : undefined,
      tools: Object.keys(tools).length ? tools : undefined,
    });
  },

  getStorage: () => sharedStorage,

  beforeAll: async () => {
    vi.unmock('crypto');
    vi.unmock('node:crypto');
  },

  afterAll: async () => {
    // Nothing to cleanup
  },

  beforeEach: async () => {
    vi.clearAllMocks();
  },

  // ============================================================================
  // Domain-level skips
  // ============================================================================
  skip: {
    // All domains should work on Default Engine
    restart: false, // Default engine supports restart
  },

  // ============================================================================
  // Individual test skips
  // ============================================================================
  skipTests: {
    // Enable all tests - Default Engine is the reference implementation
    // Enable opt-in tests that require storage
    errorStorageRoundtrip: false,
    errorPersistWithoutStack: false,
    errorPersistMastraError: false,
    // This test rebuilds workflow instances to simulate server restart,
    // requiring direct Mastra registration which the shared suite can't do.
    // The test remains in workflow.test.ts as a default-engine-specific test.
    resumeMapBranchCondition: true,

    //default engine uses the same runId for parent and nested workflows which makes this test fail.
    //The test will be added in workflow.test.ts as a default-engine-specific test.
    restartNested: true,
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({
      runId: options.runId,
      resourceId: options.resourceId,
    });

    // Use streaming API to ensure it works correctly - just await the result
    const streamResult = run.stream({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
      requestContext: options.requestContext as any,
      outputOptions: options.outputOptions,
    });

    // Consume the stream to ensure it completes
    for await (const _event of streamResult.fullStream) {
      // Discard events - we only care about the result
    }

    const result = await streamResult.result;

    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({ runId: options.runId });
    const result = await run.resume({
      step: options.step as any,
      label: options.label,
      resumeData: options.resumeData,
      forEachIndex: options.forEachIndex,
    });

    return result as WorkflowResult;
  },

  timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({ runId: options.runId });
    const result = await run.timeTravel({
      step: options.step as any,
      context: options.context as any,
      perStep: options.perStep,
      inputData: options.inputData as any,
      nestedStepsContext: options.nestedStepsContext as any,
      resumeData: options.resumeData as any,
    });

    return result as WorkflowResult;
  },

  streamWorkflow: async (workflow, inputData, options = {}, api = 'stream'): Promise<StreamWorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({
      runId: options.runId,
      resourceId: options.resourceId,
    });

    const events: StreamEvent[] = [];

    if (api === 'streamLegacy') {
      const { stream, getWorkflowState } = run.streamLegacy({
        inputData,
        initialState: options.initialState,
        perStep: options.perStep,
        requestContext: options.requestContext as any,
      });

      for await (const event of stream) {
        events.push(JSON.parse(JSON.stringify(event)));
      }

      const result = await getWorkflowState();
      return { events, result: result as WorkflowResult };
    } else {
      const streamResult = run.stream({
        inputData,
        initialState: options.initialState,
        perStep: options.perStep,
        requestContext: options.requestContext as any,
        closeOnSuspend: options.closeOnSuspend,
      });

      for await (const event of streamResult.fullStream) {
        events.push(JSON.parse(JSON.stringify(event)));
      }

      const result = await streamResult.result;
      return { events, result: result as WorkflowResult };
    }
  },

  streamResumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<StreamWorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({ runId: options.runId });

    const events: StreamEvent[] = [];
    const streamResult = run.resumeStream({
      step: options.step as any,
      label: options.label,
      resumeData: options.resumeData,
      forEachIndex: options.forEachIndex,
    });

    for await (const event of streamResult.fullStream) {
      events.push(JSON.parse(JSON.stringify(event)));
    }

    const result = await streamResult.result;
    return { events, result: result as WorkflowResult };
  },
});

// ============================================================================
// Default Engine-Specific Tests
// ============================================================================

const testStorage = new MockStore();

describe('Workflow (Default Engine Specifics)', () => {
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
      expect(result?.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });

  describe('Workflow as agent tool', () => {
    function createWorkflowToolMockModel({
      toolName,
      provider,
      modelId,
    }: {
      toolName: string;
      provider?: string;
      modelId?: string;
    }) {
      const toolInput = JSON.stringify({
        inputData: { taskId: 'test-task-123' },
        suspendedToolRunId: null,
        resumeData: null,
      });
      return new MockLanguageModelV2({
        ...(provider ? { provider: provider as any } : {}),
        ...(modelId ? { modelId: modelId as any } : {}),
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName,
              input: toolInput,
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: modelId ?? 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolCallType: 'function',
              toolName,
              input: toolInput,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });
    }

    async function streamAndCollectToolResults(agent: Agent) {
      const stream = await agent.stream('Fetch task test-task-123');
      for await (const _chunk of stream.fullStream) {
        // consume stream to drive execution
      }
    }

    it('should pass workflow input to the first step when called as agent tool via stream', async () => {
      const executeAction = vi.fn().mockImplementation(async ({ inputData }: { inputData: { taskId: string } }) => {
        return { result: `processed-${inputData.taskId}` };
      });

      const fetchTaskStep = createStep({
        id: 'fetch-task',
        description: 'Fetches a task by ID',
        inputSchema: z.object({ taskId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: executeAction,
      });

      const taskWorkflow = createWorkflow({
        id: 'task-workflow',
        description: 'A workflow that fetches a task',
        inputSchema: z.object({ taskId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: true },
      })
        .then(fetchTaskStep)
        .commit();

      const mockModel = createWorkflowToolMockModel({ toolName: 'workflow-taskWorkflow' });

      const agent = new Agent({
        id: 'task-agent',
        name: 'Task Agent',
        instructions: 'You are an agent that can fetch tasks.',
        model: mockModel,
        workflows: { taskWorkflow },
      });

      new Mastra({ agents: { taskAgent: agent }, logger: false, storage: testStorage });
      await streamAndCollectToolResults(agent);

      expect(executeAction).toHaveBeenCalled();
      expect(executeAction.mock.calls[0]![0].inputData).toEqual({ taskId: 'test-task-123' });
    });

    it('should pass workflow input to step when workflow has no inputSchema', async () => {
      const executeAction = vi.fn().mockImplementation(async ({ inputData }: { inputData: { taskId: string } }) => {
        return { result: `processed-${inputData.taskId}` };
      });

      const fetchTaskStep = createStep({
        id: 'fetch-task',
        description: 'Fetches a task by ID',
        inputSchema: z.object({ taskId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: executeAction,
      });

      // No inputSchema on the workflow - previously this caused a TypeError because
      // z.object({ inputData: undefined }) was created
      const taskWorkflow = createWorkflow({
        id: 'task-workflow',
        description: 'A workflow that fetches a task',
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: true },
      })
        .then(fetchTaskStep)
        .commit();

      const mockModel = createWorkflowToolMockModel({ toolName: 'workflow-taskWorkflow' });

      const agent = new Agent({
        id: 'task-agent',
        name: 'Task Agent',
        instructions: 'You are an agent that can fetch tasks.',
        model: mockModel,
        workflows: { taskWorkflow },
      });

      new Mastra({ agents: { taskAgent: agent }, logger: false, storage: testStorage });
      await streamAndCollectToolResults(agent);

      expect(executeAction).toHaveBeenCalled();
      expect(executeAction.mock.calls[0]![0].inputData).toEqual({ taskId: 'test-task-123' });
    });

    it('should pass workflow input to step when using OpenAI-compatible model', async () => {
      const executeAction = vi.fn().mockImplementation(async ({ inputData }: { inputData: { taskId: string } }) => {
        return { result: `processed-${inputData.taskId}` };
      });

      const fetchTaskStep = createStep({
        id: 'fetch-task',
        description: 'Fetches a task by ID',
        inputSchema: z.object({ taskId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: executeAction,
      });

      const taskWorkflow = createWorkflow({
        id: 'wait-task-workflow',
        description: 'A workflow that fetches a task',
        inputSchema: z.object({ taskId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: true },
      })
        .then(fetchTaskStep)
        .commit();

      const mockModel = createWorkflowToolMockModel({
        toolName: 'workflow-waitTaskWorkflow',
        provider: 'openai.chat',
        modelId: 'gpt-4o',
      });

      const agent = new Agent({
        id: 'task-agent',
        name: 'Task Agent',
        instructions: 'You are an agent that can fetch tasks.',
        model: mockModel,
        workflows: { waitTaskWorkflow: taskWorkflow },
      });

      new Mastra({ agents: { taskAgent: agent }, logger: false, storage: testStorage });
      await streamAndCollectToolResults(agent);

      expect(executeAction).toHaveBeenCalled();
      expect(executeAction.mock.calls[0]![0].inputData).toEqual({ taskId: 'test-task-123' });
    });
  });

  describe('Logger propagation', () => {
    it('should propagate logger to executionEngine when set via __setLogger', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
      };

      const step1 = createStep({
        id: 'step1',
        execute: async () => ({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-logger-propagation',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      // Set logger on the workflow
      workflow.__setLogger(mockLogger as any);

      // Verify logger was propagated to execution engine
      expect((workflow as any).executionEngine.logger).toBe(mockLogger);
    });

    it('should propagate logger to executionEngine when set via __registerPrimitives', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
      };

      const step1 = createStep({
        id: 'step1',
        execute: async () => ({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-logger-primitives-propagation',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      // Set logger via __registerPrimitives
      workflow.__registerPrimitives({ logger: mockLogger as any });

      // Verify logger was propagated to execution engine
      expect((workflow as any).executionEngine.logger).toBe(mockLogger);
    });

    it('should use custom logger for step execution errors instead of console.error', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
      };

      const failingStep = createStep({
        id: 'failing-step',
        execute: async () => {
          throw new Error('Test error from step');
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-logger-error-capture',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [failingStep],
      });
      workflow.then(failingStep).commit();

      // Set logger on the workflow
      workflow.__setLogger(mockLogger as any);

      // Spy on console.error to verify it's NOT called
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      // Verify workflow failed
      expect(result.status).toBe('failed');

      // Verify custom logger's error method was called for step error
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls.find((call: any[]) => call[0]?.includes('Error executing step'));
      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toContain('failing-step');

      // Verify trackException was called
      expect(mockLogger.trackException).toHaveBeenCalled();

      // Verify console.error was NOT called (errors go through custom logger instead)
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Clean up spy
      consoleErrorSpy.mockRestore();
    });
  });

  describe('non-retryable workflow failures', () => {
    it('does not retry workflow steps that throw MastraNonRetryableError', async () => {
      let calls = 0;

      const fatalStep = createStep({
        id: 'fatal-step',
        execute: async () => {
          calls++;
          throw new MastraNonRetryableError('permanent failure');
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'non-retryable-fatal-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { attempts: 3, delay: 0 },
        steps: [fatalStep],
      });
      workflow.then(fatalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'non-retryable-fatal-workflow': workflow },
      });

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(calls).toBe(1);

      const stepResult = result.steps['fatal-step'];
      expect(stepResult?.status).toBe('failed');
      expect(stepResult?.nonRetryable).toBe(true);
    });

    it('retries workflow steps that throw transient errors until attempts are exhausted', async () => {
      let calls = 0;

      const transientStep = createStep({
        id: 'transient-step',
        execute: async () => {
          calls++;
          throw new Error('transient failure');
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'retryable-transient-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { attempts: 3, delay: 0 },
        steps: [transientStep],
      });
      workflow.then(transientStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'retryable-transient-workflow': workflow },
      });

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(calls).toBe(4);

      const stepResult = result.steps['transient-step'];
      expect(stepResult?.status).toBe('failed');
      expect(stepResult?.nonRetryable).toBeUndefined();
    });
  });

  describe('tool step cancellation', () => {
    it('forwards abortSignal to tool-wrapped steps so run.cancel() can stop cooperative tools', async () => {
      let capturedAbortSignal: AbortSignal | undefined;
      let toolStoppedEarly = false;

      const cooperativeTool = createTool({
        id: 'cooperative-tool',
        description: 'Polls abortSignal until canceled',
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        execute: async (_input, context) => {
          capturedAbortSignal = context.abortSignal;
          const deadline = Date.now() + 5_000;
          while (Date.now() < deadline) {
            if (context.abortSignal?.aborted) {
              toolStoppedEarly = true;
              return { completed: false };
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          return { completed: true };
        },
      });

      const toolStep = createStep(cooperativeTool);
      const workflow = createWorkflow({
        id: 'tool-cancel-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        steps: [toolStep],
      });
      workflow.then(toolStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'tool-cancel-workflow': workflow },
      });

      const run = await workflow.createRun();
      const startedAt = Date.now();
      const startPromise = run.start({ inputData: {} });

      await new Promise(resolve => setTimeout(resolve, 1_000));
      await run.cancel();

      const result = await startPromise;

      expect(result.status).toBe('canceled');
      expect(capturedAbortSignal).toBeInstanceOf(AbortSignal);
      expect(toolStoppedEarly).toBe(true);
      expect(Date.now() - startedAt).toBeLessThan(3_000);
    }, 10_000);
  });

  describe('Tracing Context Persistence', () => {
    it('should persist tracing context when workflow suspends', async () => {
      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
      });

      const suspendStep = createStep({
        id: 'tracing-suspend-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ confirm: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData?.confirm) {
            await suspend({ message: 'Please confirm' });
          }
          return { result: `processed: ${inputData.value}` };
        },
      });

      const workflow = createWorkflow({
        id: 'tracing-context-persistence-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [suspendStep],
      })
        .then(suspendStep)
        .commit();

      workflow.__registerMastra(mastra);

      const run = await workflow.createRun({ runId: 'tracing-persistence-test-run' });
      const result = await run.start({ inputData: { value: 'test' } });

      expect(result.status).toBe('suspended');

      // Verify that the snapshot has the tracingContext field structure
      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'tracing-context-persistence-test',
        runId: 'tracing-persistence-test-run',
      });

      expect(snapshot).toBeDefined();
      expect(snapshot?.status).toBe('suspended');
      // The tracingContext should exist in the snapshot (may be undefined if no observability was configured)
      // The key is that the field structure is preserved in the snapshot
      expect('tracingContext' in (snapshot ?? {})).toBe(true);
    });
  });

  describe('Nested workflow resourceId propagation (issue #15246)', () => {
    it('persists the parent run resourceId on nested child workflow snapshots', async () => {
      const storage = new MockStore();
      const mastra = new Mastra({ logger: false, storage });

      const childStep = createStep({
        id: 'child-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        execute: async ({ inputData }) => ({ echoed: inputData.value }),
      });

      const childWorkflow = createWorkflow({
        id: 'nested-resource-id-child',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        steps: [childStep],
      })
        .then(childStep)
        .commit();

      const parentWorkflow = createWorkflow({
        id: 'nested-resource-id-parent',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        steps: [childWorkflow],
      })
        .then(childWorkflow)
        .commit();

      parentWorkflow.__registerMastra(mastra);

      const run = await parentWorkflow.createRun({ resourceId: 'workspace-1' });
      const result = await run.start({ inputData: { value: 'hello' } });

      expect(result.status).toBe('success');

      const workflowsStore = await storage.getStore('workflows');

      const parentRuns = await workflowsStore?.listWorkflowRuns({
        workflowName: 'nested-resource-id-parent',
        resourceId: 'workspace-1',
      });
      expect(parentRuns?.runs.length).toBe(1);
      expect(parentRuns?.runs[0]?.resourceId).toBe('workspace-1');

      const childRuns = await workflowsStore?.listWorkflowRuns({
        workflowName: 'nested-resource-id-child',
      });
      expect(childRuns?.runs.length).toBe(1);
      // Regression guard for #15246: child workflow snapshots must inherit the parent's resourceId.
      expect(childRuns?.runs[0]?.resourceId).toBe('workspace-1');
    });
  });

  describe('FGA checks', () => {
    function createFGAWorkflow() {
      const step = createStep({
        id: 'fga-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ inputData }) => inputData,
      });

      return createWorkflow({
        id: 'fga-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        steps: [step],
      })
        .then(step)
        .commit();
    }

    it('checks internal workflow execution FGA with request context metadata', async () => {
      const fgaProvider = {
        require: vi.fn().mockResolvedValue(undefined),
        check: vi.fn(),
        filterAccessible: vi.fn(),
      };
      const workflow = createFGAWorkflow();
      const mastra = new Mastra({
        logger: false,
        server: { fga: fgaProvider },
      });
      workflow.__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      const result = await (workflow as any).execute({
        runId: 'run-1',
        resourceId: 'tenant-1',
        inputData: { value: 'ok' },
        state: {},
        setState: vi.fn(),
        suspend: vi.fn(),
        [PUBSUB_SYMBOL]: new EventEmitterPubSub(),
        mastra,
        requestContext,
        abort: vi.fn(),
        abortSignal: new AbortController().signal,
        engine: 'default',
        bail: vi.fn(),
      });

      expect(result).toEqual({ value: 'ok' });
      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1' },
        {
          resource: { type: 'workflow', id: 'fga-workflow' },
          permission: 'workflows:execute',
          context: expect.objectContaining({
            resourceId: 'tenant-1',
            requestContext,
            metadata: expect.objectContaining({
              workflowId: 'fga-workflow',
              runId: 'run-1',
              resourceId: 'tenant-1',
            }),
          }),
        },
      );
    });

    it('fails closed when internal workflow FGA is configured and no user is available', async () => {
      const fgaProvider = {
        require: vi.fn().mockResolvedValue(undefined),
        check: vi.fn(),
        filterAccessible: vi.fn(),
      };
      const workflow = createFGAWorkflow();
      const mastra = new Mastra({
        logger: false,
        server: { fga: fgaProvider },
      });
      workflow.__registerMastra(mastra);

      await expect(
        (workflow as any).execute({
          runId: 'run-2',
          inputData: { value: 'ok' },
          state: {},
          setState: vi.fn(),
          suspend: vi.fn(),
          [PUBSUB_SYMBOL]: new EventEmitterPubSub(),
          mastra,
          requestContext: new RequestContext(),
          abort: vi.fn(),
          abortSignal: new AbortController().signal,
          engine: 'default',
          bail: vi.fn(),
        }),
      ).rejects.toThrow('authenticated user is required');
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('bypasses membership resolution for a tenant-scoped trusted actor', async () => {
      const fgaProvider = {
        require: vi.fn().mockResolvedValue(undefined),
        check: vi.fn(),
        filterAccessible: vi.fn(),
      };
      const workflow = createFGAWorkflow();
      const mastra = new Mastra({
        logger: false,
        server: { fga: fgaProvider },
      });
      workflow.__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'org-1');

      const result = await (workflow as any).execute({
        runId: 'run-3',
        inputData: { value: 'ok' },
        state: {},
        setState: vi.fn(),
        suspend: vi.fn(),
        [PUBSUB_SYMBOL]: new EventEmitterPubSub(),
        mastra,
        requestContext,
        actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
        abort: vi.fn(),
        abortSignal: new AbortController().signal,
        engine: 'default',
        bail: vi.fn(),
      });

      expect(result).toEqual({ value: 'ok' });
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });
  });

  describe('Nested workflow abort listener cleanup (issue #16125)', () => {
    it('removes abort listeners after nested workflow execution completes', async () => {
      const activeAbortListeners = new Map<AbortSignal, Set<EventListenerOrEventListenerObject>>();
      const originalAddEventListener = AbortSignal.prototype.addEventListener;
      const originalRemoveEventListener = AbortSignal.prototype.removeEventListener;
      const addAbortListener = (signal: AbortSignal, listener: EventListenerOrEventListenerObject) => {
        let listeners = activeAbortListeners.get(signal);
        if (!listeners) {
          listeners = new Set();
          activeAbortListeners.set(signal, listeners);
        }
        listeners.add(listener);
      };
      const removeAbortListener = (signal: AbortSignal, listener: EventListenerOrEventListenerObject) => {
        activeAbortListeners.get(signal)?.delete(listener);
      };

      const addEventListenerSpy = vi.spyOn(AbortSignal.prototype, 'addEventListener').mockImplementation(function (
        this: AbortSignal,
        ...args: Parameters<EventTarget['addEventListener']>
      ) {
        const [type, listener] = args;
        if (type === 'abort' && listener) {
          addAbortListener(this, listener);
        }
        return originalAddEventListener.apply(this, args);
      });
      const removeEventListenerSpy = vi
        .spyOn(AbortSignal.prototype, 'removeEventListener')
        .mockImplementation(function (this: AbortSignal, ...args: Parameters<EventTarget['removeEventListener']>) {
          const [type, listener] = args;
          if (type === 'abort' && listener) {
            removeAbortListener(this, listener);
          }
          return originalRemoveEventListener.apply(this, args);
        });

      try {
        const childStep = createStep({
          id: 'abort-cleanup-child-step',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ echoed: z.string() }),
          execute: async ({ inputData }) => ({ echoed: inputData.value }),
        });

        const childWorkflow = createWorkflow({
          id: 'abort-cleanup-child-workflow',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ echoed: z.string() }),
          steps: [childStep],
        })
          .then(childStep)
          .commit();

        const result = await (childWorkflow as any).execute({
          inputData: { value: 'hello' },
          state: {},
          setState: vi.fn(),
          suspend: vi.fn(),
          [PUBSUB_SYMBOL]: new EventEmitterPubSub(),
          mastra: new Mastra({ logger: false }),
          abort: vi.fn(),
          abortSignal: new AbortController().signal,
          engine: 'default',
          bail: vi.fn(),
        });

        expect(result).toEqual({ echoed: 'hello' });
        expect([...activeAbortListeners.values()].reduce((count, listeners) => count + listeners.size, 0)).toBe(0);
      } finally {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
      }
    });
  });

  describe('Nested workflow restart', () => {
    it('should restart a workflow execution that was previously active and has nested workflows', async () => {
      const storage = new MockStore();
      const mastra = new Mastra({ logger: false, storage });

      const mockStep1 = vi.fn().mockResolvedValue({ step1Result: 2 });
      const mockStep2 = vi.fn().mockResolvedValue({ step2Result: 3 });

      const step1 = createStep({
        id: 'step1',
        execute: mockStep1,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: mockStep2,
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

      workflow.__registerMastra(mastra);

      const workflowsStore = await storage?.getStore('workflows');

      const runId = `restart-nested-${Date.now()}`;

      if (!workflowsStore) {
        return;
      }

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
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          'restart-nestedWorkflow': {
            status: 'success',
            output: { nestedFinal: 4 },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step4: {
            status: 'success',
            output: { final: 5 },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });

      // step1 was already completed in the snapshot, should not be re-executed
      expect(mockStep1).toHaveBeenCalledTimes(0);
      // step2 was already completed in the nested snapshot, should not be re-executed
      expect(mockStep2).toHaveBeenCalledTimes(0);

      const nestedWorkflowStoreResult = await workflowsStore.loadWorkflowSnapshot({
        workflowName: 'restart-nestedWorkflow',
        runId,
      });

      expect(nestedWorkflowStoreResult?.status).toBe('success');
    });
  });
});

describe('createRun storage existence read (issue #19015)', () => {
  const ioSchema = z.object({ value: z.string() });
  const buildStep = () =>
    createStep({
      id: 'passthrough',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      execute: async ({ inputData }) => inputData,
    });

  it('skips the storage read for a transient (non-persisting) workflow with a freshly minted runId', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow({
      id: 'transient-createrun-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      options: { shouldPersistSnapshot: () => false },
    })
      .then(buildStep())
      .commit();
    new Mastra({ logger: false, storage, workflows: { 'transient-createrun-wf': workflow } });

    const workflowsStore = await storage.getStore('workflows');
    const readSpy = vi.spyOn(workflowsStore!, 'getWorkflowRunById');
    const persistSpy = vi.spyOn(workflowsStore!, 'persistWorkflowSnapshot');

    await workflow.createRun();

    // The run id was just generated and the workflow never persists a snapshot, so
    // the existence read would be a guaranteed miss — it must be short-circuited.
    expect(readSpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('still reads storage for a default (persisting) workflow', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow({
      id: 'persisting-createrun-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
    })
      .then(buildStep())
      .commit();
    new Mastra({ logger: false, storage, workflows: { 'persisting-createrun-wf': workflow } });

    const workflowsStore = await storage.getStore('workflows');
    const readSpy = vi.spyOn(workflowsStore!, 'getWorkflowRunById');

    await workflow.createRun();

    expect(readSpy).toHaveBeenCalled();
  });

  it('still reads storage for a transient workflow when an explicit runId is provided', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow({
      id: 'transient-explicit-createrun-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      options: { shouldPersistSnapshot: () => false },
    })
      .then(buildStep())
      .commit();
    new Mastra({ logger: false, storage, workflows: { 'transient-explicit-createrun-wf': workflow } });

    const workflowsStore = await storage.getStore('workflows');
    const readSpy = vi.spyOn(workflowsStore!, 'getWorkflowRunById');

    // An explicit runId may reference an existing (resumable) run, so the read must run.
    await workflow.createRun({ runId: 'explicit-run-id' });

    expect(readSpy).toHaveBeenCalled();
  });
});
