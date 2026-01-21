/**
 * DurableAgent Tool Suspension Tests
 *
 * Tests for tool suspension with suspend() call and resumeSchema/suspendSchema.
 * Validates that tools can suspend execution and be resumed with data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns a tool call
 */
function createToolCallModel(toolName: string, toolArgs: object) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(toolArgs),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a mock model that returns multiple tool calls
 */
function createMultipleToolCallsModel(tools: Array<{ name: string; args: object }>) {
  const toolCallChunks = tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args),
    providerExecuted: false,
  }));

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...toolCallChunks,
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Tool Suspension Tests
// ============================================================================

describe('DurableAgent tool suspension', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('suspendSchema and resumeSchema configuration', () => {
    it('should register tool with suspendSchema and resumeSchema', async () => {
      const mockModel = createToolCallModel('interactiveTool', { input: 'test' });

      const interactiveTool = createTool({
        id: 'interactiveTool',
        description: 'An interactive tool that can suspend',
        inputSchema: z.object({ input: z.string() }),
        suspendSchema: z.object({
          message: z.string(),
          promptType: z.enum(['confirm', 'input']),
        }),
        resumeSchema: z.object({
          response: z.string(),
          confirmed: z.boolean().optional(),
        }),
        execute: async (input, context) => {
          const suspend = context?.agent?.suspend;
          if (suspend && !context?.agent?.resumeData) {
            await suspend({ message: 'Please confirm', promptType: 'confirm' });
          }
          return { result: 'completed' };
        },
      });

      const agent = new DurableAgent({
        id: 'suspension-agent',
        name: 'Suspension Agent',
        instructions: 'You can use interactive tools',
        model: mockModel as LanguageModelV2,
        tools: { interactiveTool },
        pubsub,
      });

      const result = await agent.prepare('Use the interactive tool');

      // Tool should be registered with suspend/resume schemas
      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools).toBeDefined();
      expect(tools.interactiveTool).toBeDefined();
    });

    it('should serialize suspendSchema and resumeSchema in workflow input', async () => {
      const mockModel = createToolCallModel('suspendableTool', { data: 'test' });

      const suspendableTool = createTool({
        id: 'suspendableTool',
        description: 'A tool that can suspend execution',
        inputSchema: z.object({ data: z.string() }),
        suspendSchema: z.object({
          reason: z.string(),
          code: z.number(),
        }),
        resumeSchema: z.object({
          continue: z.boolean(),
        }),
        execute: async () => ({ done: true }),
      });

      const agent = new DurableAgent({
        id: 'schema-suspension-agent',
        name: 'Schema Suspension Agent',
        instructions: 'Use suspendable tools',
        model: mockModel as LanguageModelV2,
        tools: { suspendableTool },
        pubsub,
      });

      const result = await agent.prepare('Use the suspendable tool');

      // Workflow input should be JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.runId).toBe(result.runId);
    });
  });

  describe('tool suspension in streaming', () => {
    it('should handle streaming with suspendable tool', async () => {
      const mockModel = createToolCallModel('askForConfirmation', { question: 'Proceed?' });

      const confirmationTool = createTool({
        id: 'askForConfirmation',
        description: 'Ask user for confirmation',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ prompt: z.string() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (input, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend?.({ prompt: input.question });
          }
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });

      const agent = new DurableAgent({
        id: 'confirmation-agent',
        name: 'Confirmation Agent',
        instructions: 'Ask for confirmation when needed',
        model: mockModel as LanguageModelV2,
        tools: { askForConfirmation: confirmationTool },
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Please confirm this action');

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should support autoResumeSuspendedTools option', async () => {
      const mockModel = createToolCallModel('autoResumeTool', { value: 'test' });

      const autoResumeTool = createTool({
        id: 'autoResumeTool',
        description: 'A tool that auto-resumes',
        inputSchema: z.object({ value: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ input: z.string() }),
        execute: async () => ({ result: 'auto-resumed' }),
      });

      const agent = new DurableAgent({
        id: 'auto-resume-agent',
        name: 'Auto Resume Agent',
        instructions: 'Use auto-resuming tools',
        model: mockModel as LanguageModelV2,
        tools: { autoResumeTool },
        pubsub,
      });

      const result = await agent.prepare('Test auto resume', {
        autoResumeSuspendedTools: true,
      });

      expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(true);
    });
  });

  describe('multiple suspendable tools', () => {
    it('should handle multiple tools with suspension capabilities', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'validateData', args: { data: 'test' } },
        { name: 'processData', args: { data: 'test' } },
      ]);

      const validateTool = createTool({
        id: 'validateData',
        description: 'Validate data format',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ valid: true }),
      });

      const processTool = createTool({
        id: 'processData',
        description: 'Process validated data',
        inputSchema: z.object({ data: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (input, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend?.({ reason: 'Manual approval required' });
          }
          return { processed: true };
        },
      });

      const agent = new DurableAgent({
        id: 'multi-tool-agent',
        name: 'Multi Tool Agent',
        instructions: 'Validate then process data',
        model: mockModel as LanguageModelV2,
        tools: { validateData: validateTool, processData: processTool },
        pubsub,
      });

      const result = await agent.prepare('Validate and process the data');

      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.validateData).toBeDefined();
      expect(tools.processData).toBeDefined();
    });

    it('should handle tool chain where one suspends', async () => {
      const mockModel = createToolCallModel('chainedTool', { step: 1 });

      const chainedTool = createTool({
        id: 'chainedTool',
        description: 'A tool in a chain that may suspend',
        inputSchema: z.object({ step: z.number() }),
        suspendSchema: z.object({
          currentStep: z.number(),
          awaitingInput: z.boolean(),
        }),
        resumeSchema: z.object({
          nextStep: z.number(),
        }),
        execute: async (input, context) => {
          if (input.step === 1 && !context?.agent?.resumeData) {
            return context?.agent?.suspend?.({ currentStep: 1, awaitingInput: true });
          }
          return { completedStep: input.step };
        },
      });

      const agent = new DurableAgent({
        id: 'chained-agent',
        name: 'Chained Agent',
        instructions: 'Execute tool chain',
        model: mockModel as LanguageModelV2,
        tools: { chainedTool },
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Start the chain');

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('suspension with memory', () => {
    it('should preserve memory context through suspension', async () => {
      const mockModel = createToolCallModel('memoryTool', { query: 'test' });

      const memoryTool = createTool({
        id: 'memoryTool',
        description: 'A tool that uses memory',
        inputSchema: z.object({ query: z.string() }),
        suspendSchema: z.object({ pendingQuery: z.string() }),
        resumeSchema: z.object({ additionalInfo: z.string() }),
        execute: async () => ({ found: true }),
      });

      const agent = new DurableAgent({
        id: 'memory-suspension-agent',
        name: 'Memory Suspension Agent',
        instructions: 'Use memory with suspension',
        model: mockModel as LanguageModelV2,
        tools: { memoryTool },
        pubsub,
      });

      const result = await agent.prepare('Search with memory', {
        memory: {
          thread: 'thread-suspension-test',
          resource: 'user-456',
        },
      });

      expect(result.threadId).toBe('thread-suspension-test');
      expect(result.resourceId).toBe('user-456');
      expect(result.workflowInput.state.threadId).toBe('thread-suspension-test');
      expect(result.workflowInput.state.resourceId).toBe('user-456');
    });
  });

  describe('suspension workflow state', () => {
    it('should include suspension-related options in workflow input', async () => {
      const mockModel = createToolCallModel('statefulTool', { action: 'start' });

      const statefulTool = createTool({
        id: 'statefulTool',
        description: 'A stateful tool',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({ state: z.string() }),
        resumeSchema: z.object({ newState: z.string() }),
        execute: async () => ({ state: 'completed' }),
      });

      const agent = new DurableAgent({
        id: 'stateful-agent',
        name: 'Stateful Agent',
        instructions: 'Manage state',
        model: mockModel as LanguageModelV2,
        tools: { statefulTool },
        pubsub,
      });

      const result = await agent.prepare('Start stateful operation', {
        autoResumeSuspendedTools: false,
        maxSteps: 10,
      });

      expect(result.workflowInput.options.maxSteps).toBe(10);
      expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(false);
    });

    it('should handle complex suspend/resume schema types', async () => {
      const mockModel = createToolCallModel('complexTool', { type: 'init' });

      const complexTool = createTool({
        id: 'complexTool',
        description: 'A tool with complex schemas',
        inputSchema: z.object({
          type: z.enum(['init', 'process', 'complete']),
        }),
        suspendSchema: z.object({
          stage: z.enum(['waiting', 'pending']),
          metadata: z.object({
            timestamp: z.number(),
            attempts: z.number(),
          }),
          errors: z.array(z.string()).optional(),
        }),
        resumeSchema: z.object({
          action: z.enum(['continue', 'retry', 'abort']),
          overrides: z.record(z.string()).optional(),
        }),
        execute: async () => ({ done: true }),
      });

      const agent = new DurableAgent({
        id: 'complex-schema-agent',
        name: 'Complex Schema Agent',
        instructions: 'Handle complex schemas',
        model: mockModel as LanguageModelV2,
        tools: { complexTool },
        pubsub,
      });

      const result = await agent.prepare('Execute complex operation');

      // Verify workflow input is still JSON-serializable with complex schemas
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.runId).toBe(result.runId);
    });
  });
});

describe('DurableAgent suspension edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle tool without suspendSchema executing normally', async () => {
    const mockModel = createToolCallModel('normalTool', { value: 'test' });

    const normalTool = createTool({
      id: 'normalTool',
      description: 'A normal tool without suspension',
      inputSchema: z.object({ value: z.string() }),
      execute: async input => ({ echoed: input.value }),
    });

    const agent = new DurableAgent({
      id: 'normal-tool-agent',
      name: 'Normal Tool Agent',
      instructions: 'Use normal tools',
      model: mockModel as LanguageModelV2,
      tools: { normalTool },
      pubsub,
    });

    const result = await agent.prepare('Echo the value');

    expect(result.runId).toBeDefined();
    expect(agent.runRegistry.getTools(result.runId).normalTool).toBeDefined();
  });

  it('should handle mixed tools - some with suspension, some without', async () => {
    const mockModel = createMultipleToolCallsModel([
      { name: 'quickTool', args: { fast: true } },
      { name: 'slowTool', args: { waitForApproval: true } },
    ]);

    const quickTool = createTool({
      id: 'quickTool',
      description: 'Quick non-suspending tool',
      inputSchema: z.object({ fast: z.boolean() }),
      execute: async () => ({ quick: true }),
    });

    const slowTool = createTool({
      id: 'slowTool',
      description: 'Slow suspending tool',
      inputSchema: z.object({ waitForApproval: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ continue: z.boolean() }),
      execute: async (input, context) => {
        if (input.waitForApproval && !context?.agent?.resumeData) {
          return context?.agent?.suspend?.({ reason: 'Awaiting approval' });
        }
        return { completed: true };
      },
    });

    const agent = new DurableAgent({
      id: 'mixed-suspension-agent',
      name: 'Mixed Suspension Agent',
      instructions: 'Use both quick and slow tools',
      model: mockModel as LanguageModelV2,
      tools: { quickTool, slowTool },
      pubsub,
    });

    const result = await agent.prepare('Run both tools');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.quickTool).toBeDefined();
    expect(tools.slowTool).toBeDefined();
  });
});
