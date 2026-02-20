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
import { z } from 'zod';
import { Agent } from '../agent';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from '../loop/test-utils/MastraLanguageModelV2Mock';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createTool } from '../tools/tool';
import type { Workflow } from './types';
import { createStep, createWorkflow } from './workflow';

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
    // Collect all workflows
    const workflows: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow;
    }

    // Create Mastra with all workflows - this automatically binds mastra to each workflow
    _mastra = new Mastra({
      logger: false,
      storage: sharedStorage,
      workflows,
    });
  },

  getStorage: () => sharedStorage,

  beforeAll: async () => {
    // Nothing special needed for default engine
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
      expect(result?.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
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
              input: JSON.stringify({ inputData: { taskId: 'test-task-123' } }),
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
              input: JSON.stringify({ inputData: { taskId: 'test-task-123' } }),
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
});
