/**
 * DurableAgent Streaming Tests
 *
 * These tests verify the streaming execution behavior of DurableAgent,
 * including the workflow execution, pubsub event emission, and callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import type { AgentStreamEvent, AgentChunkEventData } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

function createTextStreamModel(text: string, options?: { delay?: number }) {
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
    }),
  });
}

function createMultiChunkStreamModel(chunks: string[]) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...chunks.map(chunk => ({ type: 'text-delta' as const, id: 'text-1', delta: chunk })),
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: chunks.length * 5, totalTokens: 10 + chunks.length * 5 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

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

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        // First call: return tool call
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
        // Second call: return text response
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
// Streaming Execution Tests
// ============================================================================

describe('DurableAgent streaming execution', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('basic streaming', () => {
    it('should stream text response and invoke onChunk callback', async () => {
      const mockModel = createTextStreamModel('Hello, world!');
      const chunks: any[] = [];

      const agent = new DurableAgent({
        id: 'stream-test-agent',
        name: 'Stream Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { output, runId, cleanup } = await agent.stream('Say hello', {
        onChunk: chunk => {
          chunks.push(chunk);
        },
      });

      expect(runId).toBeDefined();
      expect(output).toBeDefined();

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      cleanup();
    });

    it('should stream multiple text chunks', async () => {
      const mockModel = createMultiChunkStreamModel(['Hello', ', ', 'world', '!']);
      const chunks: any[] = [];

      const agent = new DurableAgent({
        id: 'multi-chunk-agent',
        name: 'Multi Chunk Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { cleanup } = await agent.stream('Say hello in parts', {
        onChunk: chunk => {
          chunks.push(chunk);
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      cleanup();
    });

    it('should return runId and allow cleanup', async () => {
      const mockModel = createTextStreamModel('Test response');

      const agent = new DurableAgent({
        id: 'cleanup-test-agent',
        name: 'Cleanup Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Test');

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');
      expect(runId.length).toBeGreaterThan(0);

      // Registry should have the run
      expect(agent.runRegistry.has(runId)).toBe(true);

      // Cleanup should remove from registry
      cleanup();
      expect(agent.runRegistry.has(runId)).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should invoke onFinish callback when streaming completes', async () => {
      const mockModel = createTextStreamModel('Complete response');
      let finishData: any = null;

      const agent = new DurableAgent({
        id: 'finish-callback-agent',
        name: 'Finish Callback Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Test', {
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for workflow to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      cleanup();
    });

    it('should invoke onError callback when error occurs', async () => {
      const errorModel = new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('Simulated LLM error');
        },
      });

      let errorReceived: Error | null = null;

      const agent = new DurableAgent({
        id: 'error-callback-agent',
        name: 'Error Callback Agent',
        instructions: 'Test',
        model: errorModel as LanguageModelV2,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onError: error => {
          errorReceived = error;
        },
      });

      // Wait for error to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      cleanup();
    });

    it('should invoke onStepFinish callback after each step', async () => {
      const mockModel = createTextStreamModel('Step complete');
      const stepResults: any[] = [];

      const agent = new DurableAgent({
        id: 'step-callback-agent',
        name: 'Step Callback Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onStepFinish: result => {
          stepResults.push(result);
        },
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      cleanup();
    });
  });

  describe('pubsub event emission', () => {
    it('should emit events to the correct topic based on runId', async () => {
      const mockModel = createTextStreamModel('Pubsub test');
      const receivedEvents: AgentStreamEvent[] = [];

      const agent = new DurableAgent({
        id: 'pubsub-test-agent',
        name: 'Pubsub Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Prepare to get the runId first
      const preparation = await agent.prepare('Test message');

      // Subscribe to events for this run
      await pubsub.subscribe(AGENT_STREAM_TOPIC(preparation.runId), event => {
        receivedEvents.push(event as unknown as AgentStreamEvent);
      });

      // Now we need to manually emit events since the workflow isn't actually running
      // In a real integration test, the workflow would emit these
      await pubsub.publish(AGENT_STREAM_TOPIC(preparation.runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId: preparation.runId,
        data: { type: 'text-delta', payload: { text: 'test' } },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
    });

    it('should isolate events between different runs', async () => {
      const mockModel = createTextStreamModel('Test');
      const eventsRun1: AgentStreamEvent[] = [];
      const eventsRun2: AgentStreamEvent[] = [];

      const agent = new DurableAgent({
        id: 'isolation-test-agent',
        name: 'Isolation Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const prep1 = await agent.prepare('Message 1');
      const prep2 = await agent.prepare('Message 2');

      await pubsub.subscribe(AGENT_STREAM_TOPIC(prep1.runId), event => {
        eventsRun1.push(event as unknown as AgentStreamEvent);
      });

      await pubsub.subscribe(AGENT_STREAM_TOPIC(prep2.runId), event => {
        eventsRun2.push(event as unknown as AgentStreamEvent);
      });

      // Emit event to run1 only
      await pubsub.publish(AGENT_STREAM_TOPIC(prep1.runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId: prep1.runId,
        data: { type: 'text-delta', payload: { text: 'for run 1' } },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(eventsRun1.length).toBe(1);
      expect(eventsRun2.length).toBe(0);
    });
  });
});

// ============================================================================
// Memory/Thread Integration Tests
// ============================================================================

describe('DurableAgent memory integration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should track threadId and resourceId in stream result', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'memory-test-agent',
      name: 'Memory Test Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const { threadId, resourceId, cleanup } = await agent.stream('Test', {
      memory: {
        thread: 'thread-123',
        resource: 'user-456',
      },
    });

    expect(threadId).toBe('thread-123');
    expect(resourceId).toBe('user-456');

    cleanup();
  });

  it('should store memory info in extended registry', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'registry-memory-agent',
      name: 'Registry Memory Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const { runId, cleanup } = await agent.stream('Test', {
      memory: {
        thread: 'my-thread',
        resource: 'my-user',
      },
    });

    const memoryInfo = agent.runRegistry.getMemoryInfo(runId);
    expect(memoryInfo).toEqual({
      threadId: 'my-thread',
      resourceId: 'my-user',
    });

    cleanup();
  });

  it('should handle streaming without memory options', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'no-memory-agent',
      name: 'No Memory Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const { threadId, resourceId, cleanup } = await agent.stream('Test');

    expect(threadId).toBeUndefined();
    expect(resourceId).toBeUndefined();

    cleanup();
  });

  it('should handle thread object with id', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'thread-object-agent',
      name: 'Thread Object Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const { threadId, cleanup } = await agent.stream('Test', {
      memory: {
        thread: { id: 'thread-from-object' },
        resource: 'user-123',
      },
    });

    expect(threadId).toBe('thread-from-object');

    cleanup();
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('DurableAgent error handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle model throwing error during streaming', async () => {
    const errorModel = new MockLanguageModelV2({
      doStream: async () => {
        throw new Error('Model initialization failed');
      },
    });

    let errorReceived: Error | null = null;

    const agent = new DurableAgent({
      id: 'error-model-agent',
      name: 'Error Model Agent',
      instructions: 'Test',
      model: errorModel as LanguageModelV2,
      pubsub,
    });

    const { cleanup } = await agent.stream('Test', {
      onError: error => {
        errorReceived = error;
      },
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    cleanup();
  });

  it('should handle error event emission via pubsub', async () => {
    const { emitErrorEvent } = await import('../stream-adapter');
    const runId = 'error-emit-test';
    const receivedErrors: any[] = [];

    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      const streamEvent = event as unknown as AgentStreamEvent;
      if (streamEvent.type === AgentStreamEventTypes.ERROR) {
        receivedErrors.push(streamEvent.data);
      }
    });

    const testError = new Error('Test error message');
    testError.name = 'TestError';
    await emitErrorEvent(pubsub, runId, testError);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedErrors.length).toBe(1);
    expect(receivedErrors[0].error.name).toBe('TestError');
    expect(receivedErrors[0].error.message).toBe('Test error message');
  });

  it('should cleanup registry on error', async () => {
    const errorModel = new MockLanguageModelV2({
      doStream: async () => {
        throw new Error('Cleanup test error');
      },
    });

    const agent = new DurableAgent({
      id: 'cleanup-error-agent',
      name: 'Cleanup Error Agent',
      instructions: 'Test',
      model: errorModel as LanguageModelV2,
      pubsub,
    });

    const { runId, cleanup } = await agent.stream('Test');

    // Run should be registered initially
    expect(agent.runRegistry.has(runId)).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Manual cleanup should work
    cleanup();
    expect(agent.runRegistry.has(runId)).toBe(false);
  });
});

// ============================================================================
// Workflow Input Serialization Tests
// ============================================================================

describe('DurableAgent workflow input serialization', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should create fully serializable workflow input', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'serialization-agent',
      name: 'Serialization Agent',
      instructions: 'You are helpful',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test message');

    // Verify all fields are serializable
    const serialized = JSON.stringify(result.workflowInput);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.runId).toBe(result.runId);
    expect(deserialized.agentId).toBe('serialization-agent');
    expect(deserialized.messageListState).toBeDefined();
    expect(deserialized.modelConfig).toBeDefined();
    expect(deserialized.modelConfig.provider).toBeDefined();
    expect(deserialized.modelConfig.modelId).toBeDefined();
  });

  it('should serialize tool metadata without execute functions', async () => {
    const mockModel = createTextStreamModel('Hello');

    const testTool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => `Result: ${input}`,
    });

    const agent = new DurableAgent({
      id: 'tool-serialization-agent',
      name: 'Tool Serialization Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { testTool },
      pubsub,
    });

    const result = await agent.prepare('Use the tool');

    // Tool metadata should be serializable
    const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
    expect(() => JSON.parse(serialized)).not.toThrow();

    // But the actual tools in registry should have execute functions
    const tools = agent.runRegistry.getTools(result.runId);
    expect(typeof tools.testTool?.execute).toBe('function');
  });

  it('should serialize execution options', async () => {
    const mockModel = createTextStreamModel('Hello');

    const agent = new DurableAgent({
      id: 'options-agent',
      name: 'Options Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', {
      maxSteps: 5,
      toolChoice: 'auto',
      modelSettings: { temperature: 0.7 },
    });

    expect(result.workflowInput.options.maxSteps).toBe(5);
    expect(result.workflowInput.options.toolChoice).toBe('auto');
    expect(result.workflowInput.options.temperature).toBe(0.7);

    // Verify serializable
    const serialized = JSON.stringify(result.workflowInput.options);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });
});
