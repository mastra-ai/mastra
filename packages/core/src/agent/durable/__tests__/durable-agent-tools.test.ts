/**
 * DurableAgent Tool Execution Tests
 *
 * These tests verify tool execution behavior through the durable workflow,
 * including tool calls, tool results, multi-step execution, and tool approval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import type { AgentStreamEvent } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

function createToolCallModel(toolName: string, args: Record<string, unknown>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(args),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createMultiToolCallModel(toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...toolCalls.map((tc, i) => ({
          type: 'tool-call' as const,
          toolCallId: `call-${i + 1}`,
          toolName: tc.toolName,
          input: JSON.stringify(tc.args),
          providerExecuted: false,
        })),
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10 * toolCalls.length, totalTokens: 15 + 10 * toolCalls.length },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: finalText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
    },
  });
}

// ============================================================================
// Tool Registration Tests
// ============================================================================

describe('DurableAgent tool registration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should register tools with execute functions in registry', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ message }) => `Echo: ${message}`,
    });

    const agent = new DurableAgent({
      id: 'tool-registration-agent',
      name: 'Tool Registration Agent',
      instructions: 'Use tools',
      model: mockModel as LanguageModelV2,
      tools: { echo: echoTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.echo).toBeDefined();
    expect(typeof tools.echo.execute).toBe('function');

    // Execute the tool directly
    const execResult = await tools.echo.execute!({ message: 'hello' }, {} as any);
    expect(execResult).toBe('Echo: hello');
  });

  it('should handle multiple tools', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const addTool = createTool({
      id: 'add',
      description: 'Add two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    });

    const multiplyTool = createTool({
      id: 'multiply',
      description: 'Multiply two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a * b,
    });

    const agent = new DurableAgent({
      id: 'multi-tool-agent',
      name: 'Multi Tool Agent',
      instructions: 'Calculate',
      model: mockModel as LanguageModelV2,
      tools: { add: addTool, multiply: multiplyTool },
      pubsub,
    });

    const result = await agent.prepare('Calculate something');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools.add).toBeDefined();
    expect(tools.multiply).toBeDefined();

    // Test both tools
    expect(await tools.add.execute!({ a: 2, b: 3 }, {} as any)).toBe(5);
    expect(await tools.multiply.execute!({ a: 2, b: 3 }, {} as any)).toBe(6);
  });

  it('should handle tools with complex input schemas', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const complexTool = createTool({
      id: 'complex',
      description: 'A tool with complex input',
      inputSchema: z.object({
        name: z.string(),
        age: z.number().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z
          .object({
            key: z.string(),
            value: z.unknown(),
          })
          .optional(),
      }),
      execute: async input => ({ received: input }),
    });

    const agent = new DurableAgent({
      id: 'complex-tool-agent',
      name: 'Complex Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { complex: complexTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);
    const execResult = await tools.complex.execute!(
      {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        metadata: { key: 'foo', value: 123 },
      },
      {} as any,
    );

    expect(execResult).toEqual({
      received: {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        metadata: { key: 'foo', value: 123 },
      },
    });
  });
});

// ============================================================================
// Tool Execution Through Workflow Tests
// ============================================================================

describe('DurableAgent tool execution through workflow', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should prepare tool call data in workflow input', async () => {
    const mockModel = createToolCallModel('greet', { name: 'Alice' });

    const greetTool = createTool({
      id: 'greet',
      description: 'Greet someone',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => `Hello, ${name}!`,
    });

    const agent = new DurableAgent({
      id: 'tool-workflow-agent',
      name: 'Tool Workflow Agent',
      instructions: 'Greet users',
      model: mockModel as LanguageModelV2,
      tools: { greet: greetTool },
      pubsub,
    });

    const result = await agent.prepare('Greet Alice');

    // Tools metadata should be in workflow input
    expect(result.workflowInput.toolsMetadata).toBeDefined();

    // Tools with execute should be in registry
    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.greet).toBeDefined();
  });

  it('should handle tool with async execution', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const asyncTool = createTool({
      id: 'async-tool',
      description: 'An async tool',
      inputSchema: z.object({ delay: z.number() }),
      execute: async ({ delay }) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return `Completed after ${delay}ms`;
      },
    });

    const agent = new DurableAgent({
      id: 'async-tool-agent',
      name: 'Async Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { asyncTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);
    const execResult = await tools.asyncTool.execute!({ delay: 10 }, {} as any);
    expect(execResult).toBe('Completed after 10ms');
  });

  it('should handle tool execution errors', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const errorTool = createTool({
      id: 'error-tool',
      description: 'A tool that throws',
      inputSchema: z.object({ shouldFail: z.boolean() }),
      execute: async ({ shouldFail }) => {
        if (shouldFail) {
          throw new Error('Tool execution failed');
        }
        return 'Success';
      },
    });

    const agent = new DurableAgent({
      id: 'error-tool-agent',
      name: 'Error Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { errorTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);

    // Should succeed when shouldFail is false
    const successResult = await tools.errorTool.execute!({ shouldFail: false }, {} as any);
    expect(successResult).toBe('Success');

    // When shouldFail is true, the tool execution should fail
    // The tool builder may return an error object instead of throwing
    try {
      const result = await tools.errorTool.execute!({ shouldFail: true }, {} as any);
      // If it returned (didn't throw), check if result contains error info
      if (result && typeof result === 'object' && 'message' in result) {
        expect((result as any).message).toContain('Tool execution failed');
      } else {
        // Should have thrown
        expect.fail('Expected tool to throw or return error');
      }
    } catch (error: any) {
      // If it threw, verify error message
      expect(error.message).toContain('Tool execution failed');
    }
  });
});

// ============================================================================
// Tool Metadata Serialization Tests
// ============================================================================

describe('DurableAgent tool metadata serialization', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should serialize tool metadata without execute functions', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const testTool = createTool({
      id: 'test-tool',
      description: 'Test tool description',
      inputSchema: z.object({
        param1: z.string().describe('First parameter'),
        param2: z.number().optional().describe('Second parameter'),
      }),
      execute: async ({ param1, param2 }) => `${param1}-${param2}`,
    });

    const agent = new DurableAgent({
      id: 'serialization-agent',
      name: 'Serialization Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { testTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    // Serialize and deserialize to verify no functions
    const serialized = JSON.stringify(result.workflowInput);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.toolsMetadata).toBeDefined();
    // Tools metadata should be an array (can be serialized)
    expect(Array.isArray(deserialized.toolsMetadata)).toBe(true);
  });

  it('should preserve tool descriptions in metadata', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const describedTool = createTool({
      id: 'described-tool',
      description: 'This is a detailed description of what this tool does',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => input,
    });

    const agent = new DurableAgent({
      id: 'description-agent',
      name: 'Description Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { describedTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    // The tools in registry should have description
    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.describedTool.description).toBe('This is a detailed description of what this tool does');
  });
});

// ============================================================================
// Multi-Step Agentic Loop Tests
// ============================================================================

describe('DurableAgent multi-step execution', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should support maxSteps configuration', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'max-steps-agent',
      name: 'Max Steps Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { maxSteps: 3 });

    expect(result.workflowInput.options.maxSteps).toBe(3);
  });

  it('should prepare for multi-tool execution', async () => {
    const mockModel = createMultiToolCallModel([
      { toolName: 'tool1', args: { a: 1 } },
      { toolName: 'tool2', args: { b: 2 } },
    ]);

    const tool1 = createTool({
      id: 'tool1',
      description: 'First tool',
      inputSchema: z.object({ a: z.number() }),
      execute: async ({ a }) => `tool1: ${a}`,
    });

    const tool2 = createTool({
      id: 'tool2',
      description: 'Second tool',
      inputSchema: z.object({ b: z.number() }),
      execute: async ({ b }) => `tool2: ${b}`,
    });

    const agent = new DurableAgent({
      id: 'multi-tool-exec-agent',
      name: 'Multi Tool Exec Agent',
      instructions: 'Use multiple tools',
      model: mockModel as LanguageModelV2,
      tools: { tool1, tool2 },
      pubsub,
    });

    const result = await agent.prepare('Use both tools');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.tool1).toBeDefined();
    expect(tools.tool2).toBeDefined();

    // Both tools should be executable
    expect(await tools.tool1.execute!({ a: 1 }, {} as any)).toBe('tool1: 1');
    expect(await tools.tool2.execute!({ b: 2 }, {} as any)).toBe('tool2: 2');
  });
});

// ============================================================================
// Tool Choice Configuration Tests
// ============================================================================

describe('DurableAgent tool choice configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass toolChoice: auto to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'tool-choice-auto-agent',
      name: 'Tool Choice Auto Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { toolChoice: 'auto' });

    expect(result.workflowInput.options.toolChoice).toBe('auto');
  });

  it('should pass toolChoice: none to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'tool-choice-none-agent',
      name: 'Tool Choice None Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { toolChoice: 'none' });

    expect(result.workflowInput.options.toolChoice).toBe('none');
  });

  it('should pass toolChoice: required to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'tool-choice-required-agent',
      name: 'Tool Choice Required Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { toolChoice: 'required' });

    expect(result.workflowInput.options.toolChoice).toBe('required');
  });
});

// ============================================================================
// Tool Approval Configuration Tests
// ============================================================================

describe('DurableAgent tool approval configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass requireToolApproval to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'approval-config-agent',
      name: 'Approval Config Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { requireToolApproval: true });

    expect(result.workflowInput.options.requireToolApproval).toBe(true);
  });

  it('should handle tool with requireApproval flag', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const approvalTool = createTool({
      id: 'approval-tool',
      description: 'A tool that requires approval',
      inputSchema: z.object({ action: z.string() }),
      requireApproval: true,
      execute: async ({ action }) => `Executed: ${action}`,
    });

    const agent = new DurableAgent({
      id: 'approval-tool-agent',
      name: 'Approval Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { approvalTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.approvalTool).toBeDefined();
    // The tool itself has requireApproval flag
    expect((tools.approvalTool as any).requireApproval).toBe(true);
  });
});

// ============================================================================
// Tool Concurrency Configuration Tests
// ============================================================================

describe('DurableAgent tool concurrency configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass toolCallConcurrency to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new DurableAgent({
      id: 'concurrency-agent',
      name: 'Concurrency Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', { toolCallConcurrency: 5 });

    expect(result.workflowInput.options.toolCallConcurrency).toBe(5);
  });
});
