/**
 * InngestDurableAgent integration tests
 *
 * These tests run with the real Inngest dev server (Docker) to verify
 * InngestDurableAgent works correctly through Inngest's execution engine.
 *
 * Test isolation is achieved through:
 * - Unique agent IDs per test (workflow looks up agent via agentId)
 * - Unique run IDs per execution
 * - Shared Inngest infrastructure (one server, one client)
 */
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Mastra } from '@mastra/core/mastra';
import {
  MastraLanguageModelV2Mock as MockLanguageModelV2,
  simulateReadableStream,
} from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { InngestDurableAgent, createInngestDurableAgenticWorkflow, serve as inngestServe } from '../index';
import {
  INNGEST_PORT,
  generateTestId,
  getSharedInngest,
  setupDurableAgentTest,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

/**
 * Creates a mock model that streams text
 */
function createTextStreamModel(text: string) {
  const chunks = text
    .split('')
    .map((char, i, arr) => {
      if (i === arr.length - 1) {
        return [
          { type: 'text-delta' as const, textDelta: char },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: text.length },
          },
        ];
      }
      return [{ type: 'text-delta' as const, textDelta: char }];
    })
    .flat();

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks, chunkDelayMs: 5 }),
      request: {},
      response: { id: 'test', timestamp: new Date(), modelId: 'mock' },
      warnings: [],
    }),
  });
}

describe.sequential('InngestDurableAgent Integration', () => {
  // Setup shared infrastructure once for all tests
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  }, 30000);

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Small delay between tests to let Inngest event processing settle
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  describe('Agent Properties', () => {
    it('should expose agent id and name', () => {
      const inngest = new Inngest({
        id: 'test',
        baseUrl: `http://localhost:${INNGEST_PORT}`,
      });

      const mockModel = createTextStreamModel('test');

      const agent = new InngestDurableAgent({
        id: 'my-agent-id',
        name: 'My Agent Name',
        instructions: 'You are helpful',
        model: mockModel,
        inngest,
      });

      expect(agent.id).toBe('my-agent-id');
      expect(agent.name).toBe('My Agent Name');
      expect(agent.inngest).toBe(inngest);
    });

    it('should create workflow with expected id', () => {
      const inngest = new Inngest({
        id: 'test',
        baseUrl: `http://localhost:${INNGEST_PORT}`,
      });

      // Create workflow using the exported factory function
      const workflow = createInngestDurableAgenticWorkflow({ inngest });

      // The workflow id should be the static durable agentic loop id
      expect(workflow.id).toBe('durable-agentic-loop');
    });
  });

  describe('Workflow Registration', () => {
    it('should allow workflow to be registered with Mastra', async () => {
      const inngest = new Inngest({
        id: 'durable-agent-test',
        baseUrl: `http://localhost:${INNGEST_PORT}`,
        middleware: [realtimeMiddleware()],
      });

      // Create workflow using the exported factory function
      const workflow = createInngestDurableAgenticWorkflow({ inngest });

      // This should not throw
      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          [workflow.id]: workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      // Workflow should be listed
      const workflows = mastra.listWorkflows();
      expect(workflows[workflow.id]).toBeDefined();
    });
  });

  describe('Basic Streaming', () => {
    it('should execute workflow and return text response', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();
      const mockModel = createTextStreamModel('Hello World!');

      const agent = new InngestDurableAgent({
        id: `test-text-agent-${testId}`,
        name: 'Test Text Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      const { output, runId, cleanup } = await agent.stream('Hello!');

      expect(runId).toBeDefined();

      // Wait for the stream to complete
      const text = await output.text;

      expect(text).toBeDefined();

      cleanup();
    }, 90000);
  });

  describe('Tool Execution', () => {
    it('should execute tools through the durable workflow', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();
      const toolExecuted = vi.fn();

      const greetTool = createTool({
        id: 'greet',
        description: 'Greets a person',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async ({ name }) => {
          toolExecuted(name);
          return { greeting: `Hello, ${name}!` };
        },
      });

      // Create a model that first calls the tool, then returns text
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: tool call
            // Note: AI SDK stream format uses 'input' (JSON string) not 'args'
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'greet',
                    input: JSON.stringify({ name: 'World' }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 5 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            // Second call: text response after tool result
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Done!' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 15, outputTokens: 5 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-tool-agent-${testId}`,
        name: 'Test Tool Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { greet: greetTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Greet the world', {
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for the stream to complete
      const text = await output.text;

      expect(toolExecuted).toHaveBeenCalledWith('World');
      expect(finishData).not.toBeNull();
      expect(text).toBeDefined();

      cleanup();
    }, 90000);

    it('should execute multiple tools in sequence', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const addExecuted = vi.fn();
      const multiplyExecuted = vi.fn();

      const addTool = createTool({
        id: 'add',
        description: 'Adds two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        execute: async ({ a, b }) => {
          addExecuted(a, b);
          return { result: a + b };
        },
      });

      const multiplyTool = createTool({
        id: 'multiply',
        description: 'Multiplies two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        execute: async ({ a, b }) => {
          multiplyExecuted(a, b);
          return { result: a * b };
        },
      });

      // Model calls both tools, then returns text
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: two tool calls
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'add',
                    input: JSON.stringify({ a: 2, b: 3 }),
                    providerExecuted: false,
                  },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-2',
                    toolName: 'multiply',
                    input: JSON.stringify({ a: 4, b: 5 }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 10 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            // Second call: text response
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Results: 5 and 20' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 20, outputTokens: 10 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-multi-tool-agent-${testId}`,
        name: 'Test Multi Tool Agent',
        instructions: 'You are a calculator assistant',
        model: mockModel,
        tools: { add: addTool, multiply: multiplyTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: unknown = null;
      const { output, cleanup } = await agent.stream('Add 2+3 and multiply 4*5', {
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 60s')), 60000),
      );

      const text = await Promise.race([textPromise, timeoutPromise]);

      // Both tools should have been executed
      expect(addExecuted).toHaveBeenCalledWith(2, 3);
      expect(multiplyExecuted).toHaveBeenCalledWith(4, 5);
      expect(finishData).not.toBeNull();
      expect(text).toBeDefined();

      cleanup();
    }, 90000);

    // TODO: Tool execution errors currently cause workflow failure because the tool builder
    // re-throws errors after logging. This needs to be fixed in the tool execution step
    // to properly catch MastraError from the tool builder.
    it.skip('should handle tool execution errors gracefully', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const errorTool = createTool({
        id: 'errorTool',
        description: 'A tool that throws an error',
        inputSchema: z.object({ shouldFail: z.boolean() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ shouldFail }) => {
          if (shouldFail) {
            throw new Error('Tool execution failed intentionally');
          }
          return { result: 'success' };
        },
      });

      // Model calls the failing tool, then should continue with text
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'errorTool',
                    input: JSON.stringify({ shouldFail: true }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 5 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            // Second call: handle the error gracefully
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Tool failed, but I handled it' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 15, outputTokens: 10 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-error-tool-agent-${testId}`,
        name: 'Test Error Tool Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { errorTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: unknown = null;
      const { output, cleanup } = await agent.stream('Use the error tool', {
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 60s')), 60000),
      );

      const text = await Promise.race([textPromise, timeoutPromise]);

      // Workflow should complete even when tool throws
      expect(finishData).not.toBeNull();
      expect(text).toBeDefined();

      cleanup();
    }, 90000);
  });

  describe('Usage Tracking', () => {
    it('should accumulate token usage across multiple steps', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const echooTool = createTool({
        id: 'echo',
        description: 'Echoes the input',
        inputSchema: z.object({ message: z.string() }),
        outputSchema: z.object({ echo: z.string() }),
        execute: async ({ message }) => ({ echo: message }),
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'echo',
                    input: JSON.stringify({ message: 'hello' }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 100, outputTokens: 50 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Done' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 200, outputTokens: 100 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-usage-agent-${testId}`,
        name: 'Test Usage Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { echo: echooTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Echo hello', {
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 60s')), 60000),
      );

      await Promise.race([textPromise, timeoutPromise]);

      // Usage should be accumulated from both steps
      expect(finishData).not.toBeNull();
      expect(finishData.output.usage).toBeDefined();
      // Total: 100+200 input, 50+100 output
      expect(finishData.output.usage.inputTokens).toBe(300);
      expect(finishData.output.usage.outputTokens).toBe(150);
      expect(finishData.output.usage.totalTokens).toBe(450);

      cleanup();
    }, 90000);
  });

  describe('Configuration Options', () => {
    it('should pass maxSteps option to workflow', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const toolExecuted = vi.fn();

      // A simple tool that the model can call
      const echoTool = createTool({
        id: 'echo',
        description: 'Echoes the input',
        inputSchema: z.object({ message: z.string() }),
        outputSchema: z.object({ echo: z.string() }),
        execute: async ({ message }) => {
          toolExecuted(message);
          return { echo: message };
        },
      });

      // Model: call tool once, then return text
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'echo',
                    input: JSON.stringify({ message: 'hello' }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 5 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Done with echo' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 15, outputTokens: 10 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-maxsteps-agent-${testId}`,
        name: 'Test MaxSteps Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { echo: echoTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Echo hello', {
        maxSteps: 5, // Set maxSteps high enough to not interfere
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 60s')), 60000),
      );

      await Promise.race([textPromise, timeoutPromise]);

      // Should have completed with the tool execution and text response
      expect(finishData).not.toBeNull();
      expect(toolExecuted).toHaveBeenCalledWith('hello');
      // Should have 2 steps: one tool call, one text response
      expect(finishData.output.steps.length).toBe(2);

      cleanup();
    }, 90000);

    it('should pass memory options (thread and resource)', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();
      const mockModel = createTextStreamModel('Hello!');

      const agent = new InngestDurableAgent({
        id: `test-memory-agent-${testId}`,
        name: 'Test Memory Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      const { output, threadId, resourceId, cleanup } = await agent.stream('Hello!', {
        memory: {
          thread: 'test-thread-123',
          resource: 'test-user-456',
        },
      });

      // Wait for the stream to complete
      await output.text;

      // Memory options should be passed through
      expect(threadId).toBe('test-thread-123');
      expect(resourceId).toBe('test-user-456');

      cleanup();
    }, 90000);
  });

  describe('Tool Choice Configuration', () => {
    it('should pass toolChoice: auto to workflow', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const greetTool = createTool({
        id: 'greet',
        description: 'Greets a person',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
      });

      // Model that can use tools but chooses to return text
      const mockModel = createTextStreamModel('Hello there!');

      const agent = new InngestDurableAgent({
        id: `test-toolchoice-auto-agent-${testId}`,
        name: 'Test Tool Choice Auto Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { greet: greetTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Hello', {
        toolChoice: 'auto',
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for the stream to complete
      await output.text;

      // Workflow should complete with toolChoice: auto
      expect(finishData).not.toBeNull();
      expect(finishData.output).toBeDefined();

      cleanup();
    }, 90000);

    it('should pass toolChoice: none to workflow (no tool calls)', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const greetTool = createTool({
        id: 'greet',
        description: 'Greets a person',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
      });

      // With toolChoice: none, model should only return text
      const mockModel = createTextStreamModel('I cannot use tools right now.');

      const agent = new InngestDurableAgent({
        id: `test-toolchoice-none-agent-${testId}`,
        name: 'Test Tool Choice None Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { greet: greetTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Greet someone', {
        toolChoice: 'none',
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 30s')), 30000),
      );

      await Promise.race([textPromise, timeoutPromise]);

      // Workflow should complete without tool calls
      expect(finishData).not.toBeNull();
      expect(finishData.output).toBeDefined();
      // With toolChoice: none, there should be no tool execution steps
      const steps = finishData.output.steps || [];
      const hasToolCalls = steps.some((step: any) => step.toolCalls && step.toolCalls.length > 0);
      expect(hasToolCalls).toBe(false);

      cleanup();
    }, 90000);

    it('should pass toolChoice: required to workflow', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      const toolExecuted = vi.fn();

      const greetTool = createTool({
        id: 'greet',
        description: 'Greets a person',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async ({ name }) => {
          toolExecuted(name);
          return { greeting: `Hello, ${name}!` };
        },
      });

      // With toolChoice: required, model must use a tool
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'greet',
                    input: JSON.stringify({ name: 'Required' }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 5 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          } else {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'stream-start' as const, warnings: [] },
                  { type: 'response-metadata' as const, id: 'test-2', modelId: 'mock', timestamp: new Date() },
                  { type: 'text-delta' as const, textDelta: 'Tool was required and used!' },
                  {
                    type: 'finish' as const,
                    finishReason: 'stop' as const,
                    usage: { inputTokens: 15, outputTokens: 10 },
                  },
                ],
                chunkDelayMs: 5,
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          }
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-toolchoice-required-agent-${testId}`,
        name: 'Test Tool Choice Required Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        tools: { greet: greetTool },
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const { output, cleanup } = await agent.stream('Greet someone', {
        toolChoice: 'required',
        onFinish: data => {
          finishData = data;
        },
      });

      const textPromise = output.text;
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Text promise timeout after 60s')), 60000),
      );

      await Promise.race([textPromise, timeoutPromise]);

      // Tool should have been executed
      expect(toolExecuted).toHaveBeenCalledWith('Required');
      expect(finishData).not.toBeNull();

      cleanup();
    }, 90000);
  });

  describe('Callbacks', () => {
    it('should invoke onFinish callback with step data', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      // Simple text-only model for this test (no tools)
      const mockModel = createTextStreamModel('Hello from callback test!');

      const agent = new InngestDurableAgent({
        id: `test-callback-agent-${testId}`,
        name: 'Test Callback Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let finishData: any = null;
      const chunks: any[] = [];
      const { output, cleanup } = await agent.stream('Hello!', {
        onChunk: chunk => {
          chunks.push(chunk);
        },
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for the stream to complete
      await output.text;

      // onFinish should be called with step data
      expect(finishData).not.toBeNull();
      expect(finishData.output).toBeDefined();
      expect(finishData.output.steps).toBeDefined();
      expect(finishData.output.steps.length).toBeGreaterThanOrEqual(1);
      expect(finishData.stepResult).toBeDefined();
      expect(finishData.stepResult.reason).toBe('stop');

      cleanup();
    }, 90000);
  });

  describe('Error Handling', () => {
    it('should invoke onError callback when model throws during streaming', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      // Create a model that throws an error
      const errorModel = new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('Model initialization failed');
        },
      });

      const agent = new InngestDurableAgent({
        id: `test-error-model-agent-${testId}`,
        name: 'Test Error Model Agent',
        instructions: 'You are a helpful assistant',
        model: errorModel,
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      let errorReceived: Error | null = null;
      let finishData: any = null;

      const { output, cleanup } = await agent.stream('Hello!', {
        onError: error => {
          errorReceived = error;
        },
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for the stream to complete or error
      const textPromise = output.text.catch(() => 'error');
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 30s')), 30000),
      );

      await Promise.race([textPromise, timeoutPromise]);

      // Give async callbacks time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Either onError was called or workflow completed (possibly with error status)
      expect(errorReceived !== null || finishData !== null).toBe(true);

      cleanup();
    }, 90000);

    it('should handle stream errors gracefully without hanging', async () => {
      const testId = generateTestId();
      const inngest = getSharedInngest();

      // Create a model that errors mid-stream
      const errorModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'response-metadata' as const, id: 'test-1', modelId: 'mock', timestamp: new Date() },
              { type: 'text-delta' as const, textDelta: 'Starting...' },
              // Simulate error by having the stream fail
            ],
            chunkDelayMs: 10,
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      const agent = new InngestDurableAgent({
        id: `test-stream-error-agent-${testId}`,
        name: 'Test Stream Error Agent',
        instructions: 'You are a helpful assistant',
        model: errorModel,
        inngest,
      });

      await setupDurableAgentTest({ testId, agent });

      const chunks: any[] = [];
      let errorReceived: Error | null = null;

      const { output, cleanup } = await agent.stream('Hello!', {
        onChunk: chunk => {
          chunks.push(chunk);
        },
        onError: error => {
          errorReceived = error;
        },
      });

      // The stream should not hang - either complete or error within timeout
      const textPromise = output.text.catch(e => 'error: ' + e.message);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout - stream hung')), 30000),
      );

      try {
        await Promise.race([textPromise, timeoutPromise]);
        // If we get here, the stream completed (possibly with empty text)
      } catch (e: any) {
        // Timeout is a failure - the stream hung
        if (e.message === 'Timeout - stream hung') {
          throw e;
        }
        // Other errors are acceptable
      }

      cleanup();
    }, 90000);
  });
});
