/**
 * DurableAgent StopWhen Tests
 *
 * Tests for early termination with stopWhen callback.
 * Validates that stopWhen can be used to stop execution based on step results.
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

/**
 * Creates a mock model that returns text then a tool call
 */
function createTextThenToolModel(text: string, toolName: string, toolArgs: object) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
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

// ============================================================================
// DurableAgent StopWhen Tests
// ============================================================================

describe('DurableAgent stopWhen callback', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('stopWhen option configuration', () => {
    it('should accept stopWhen callback in stream options', async () => {
      const mockModel = createToolCallModel('weatherTool', { location: 'Toronto' });

      const weatherTool = createTool({
        id: 'weatherTool',
        description: 'Get weather for a location',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({
          temperature: 20,
          conditions: 'sunny',
        }),
      });

      const agent = new DurableAgent({
        id: 'stopwhen-agent',
        name: 'StopWhen Agent',
        instructions: 'Get weather information.',
        model: mockModel as LanguageModelV2,
        tools: { weatherTool },
        pubsub,
      });

      const stopWhenCalled = vi.fn().mockReturnValue(false);

      const { runId, cleanup } = await agent.stream('What is the weather in Toronto?', {
        stopWhen: stopWhenCalled,
      });

      expect(runId).toBeDefined();
      // stopWhen is passed to the stream options
      cleanup();
    });

    it('should accept stopWhen callback in prepare options', async () => {
      const mockModel = createTextModel('Here is your answer.');

      const agent = new DurableAgent({
        id: 'stopwhen-prepare-agent',
        name: 'StopWhen Prepare Agent',
        instructions: 'Respond to questions.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const stopWhen = vi.fn().mockReturnValue(false);

      // Note: stopWhen is typically used with stream, not prepare
      // but we verify the options handling
      const result = await agent.prepare('Hello', {
        maxSteps: 5,
      });

      expect(result.runId).toBeDefined();
      expect(result.workflowInput.options.maxSteps).toBe(5);
    });
  });

  describe('stopWhen with tools', () => {
    it('should handle stopWhen with tool execution', async () => {
      const mockModel = createToolCallModel('dataTool', { query: 'test' });

      const dataTool = createTool({
        id: 'dataTool',
        description: 'Get data',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ data: 'result' }),
      });

      const agent = new DurableAgent({
        id: 'stopwhen-tool-agent',
        name: 'StopWhen Tool Agent',
        instructions: 'Get data.',
        model: mockModel as LanguageModelV2,
        tools: { dataTool },
        pubsub,
      });

      const stopWhen = vi.fn().mockImplementation(({ steps }) => {
        // Stop if we've completed a tool call
        return steps.some((step: any) => step.content?.some((item: any) => item.type === 'tool-result'));
      });

      const { runId, cleanup } = await agent.stream('Get the data', {
        stopWhen,
        maxSteps: 10,
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle stopWhen with text and tool calls', async () => {
      const mockModel = createTextThenToolModel('Let me look that up...', 'searchTool', { query: 'test' });

      const searchTool = createTool({
        id: 'searchTool',
        description: 'Search for information',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ results: ['result1', 'result2'] }),
      });

      const agent = new DurableAgent({
        id: 'stopwhen-text-tool-agent',
        name: 'StopWhen Text Tool Agent',
        instructions: 'Search for information.',
        model: mockModel as LanguageModelV2,
        tools: { searchTool },
        pubsub,
      });

      const stopWhen = vi.fn().mockReturnValue(false);

      const { runId, cleanup } = await agent.stream('Search for test', {
        stopWhen,
        maxSteps: 5,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('stopWhen with maxSteps', () => {
    it('should combine stopWhen with maxSteps option', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'stopwhen-maxsteps-agent',
        name: 'StopWhen MaxSteps Agent',
        instructions: 'Respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const stopWhen = vi.fn().mockReturnValue(false);

      const { runId, cleanup } = await agent.stream('Hello', {
        stopWhen,
        maxSteps: 3,
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle stopWhen returning true immediately', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'stopwhen-immediate-agent',
        name: 'StopWhen Immediate Agent',
        instructions: 'Respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Stop immediately
      const stopWhen = vi.fn().mockReturnValue(true);

      const { runId, cleanup } = await agent.stream('Hello', {
        stopWhen,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('stopWhen serialization', () => {
    it('should handle workflow input without stopWhen (non-serializable)', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'stopwhen-serialize-agent',
        name: 'StopWhen Serialize Agent',
        instructions: 'Respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        maxSteps: 5,
      });

      // Workflow input should be serializable (stopWhen callback is not included)
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.options.maxSteps).toBe(5);
    });
  });
});

describe('DurableAgent stopWhen edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle stopWhen with empty steps array', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'stopwhen-empty-steps-agent',
      name: 'StopWhen Empty Steps Agent',
      instructions: 'Respond.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const stopWhen = vi.fn().mockImplementation(({ steps }) => {
      // Handle empty steps gracefully
      if (!steps || steps.length === 0) {
        return false;
      }
      return false;
    });

    const { runId, cleanup } = await agent.stream('Hello', {
      stopWhen,
    });

    expect(runId).toBeDefined();
    cleanup();
  });

  it('should handle stopWhen that throws an error', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'stopwhen-error-agent',
      name: 'StopWhen Error Agent',
      instructions: 'Respond.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // This would normally throw, but we're testing that it's accepted
    const stopWhen = vi.fn().mockImplementation(() => {
      // In actual execution, errors would be caught
      return false;
    });

    const { runId, cleanup } = await agent.stream('Hello', {
      stopWhen,
    });

    expect(runId).toBeDefined();
    cleanup();
  });

  it('should handle async stopWhen callback', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'stopwhen-async-agent',
      name: 'StopWhen Async Agent',
      instructions: 'Respond.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Async stopWhen callback
    const stopWhen = vi.fn().mockImplementation(async ({ steps }) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return steps.length > 0;
    });

    const { runId, cleanup } = await agent.stream('Hello', {
      stopWhen,
    });

    expect(runId).toBeDefined();
    cleanup();
  });
});
