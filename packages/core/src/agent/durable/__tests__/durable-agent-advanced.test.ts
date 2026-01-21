/**
 * DurableAgent Advanced Tests
 *
 * These tests cover low priority features:
 * - Structured output configuration
 * - Model version compatibility
 * - Instructions and context handling
 * - Message format handling
 * - Workflow state serialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';
import { MessageList } from '../../message-list';

// ============================================================================
// Helper Functions
// ============================================================================

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
    }),
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      warnings: [],
    }),
  });
}

function createJsonModel(jsonData: unknown) {
  const jsonString = JSON.stringify(jsonData);
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: jsonString },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => ({
      content: [{ type: 'text', text: jsonString }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      warnings: [],
    }),
  });
}

// ============================================================================
// Instructions and Context Handling Tests
// ============================================================================

describe('DurableAgent instructions handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should include agent instructions in workflow input', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'instructions-agent',
      name: 'Instructions Agent',
      instructions: 'You are a helpful assistant that speaks formally.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello');

    // MessageList state should include the instructions
    expect(result.workflowInput.messageListState).toBeDefined();
    expect(result.workflowInput.agentId).toBe('instructions-agent');
  });

  it('should handle array instructions', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'array-instructions-agent',
      name: 'Array Instructions Agent',
      instructions: ['First instruction.', 'Second instruction.', 'Third instruction.'],
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello');

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle empty instructions', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'no-instructions-agent',
      name: 'No Instructions Agent',
      instructions: '',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello');

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle instructions override in stream options', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'override-instructions-agent',
      name: 'Override Instructions Agent',
      instructions: 'Default instructions',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      instructions: 'Override instructions for this request',
    });

    expect(result.workflowInput.messageListState).toBeDefined();
  });
});

describe('DurableAgent context handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should include context messages in workflow input', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'context-agent',
      name: 'Context Agent',
      instructions: 'You are helpful',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      context: [{ role: 'user', content: 'Previous context message' }],
    });

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle string context', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'string-context-agent',
      name: 'String Context Agent',
      instructions: 'You are helpful',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      context: 'Some context information',
    });

    expect(result.workflowInput.messageListState).toBeDefined();
  });
});

// ============================================================================
// Message Format Handling Tests
// ============================================================================

describe('DurableAgent message format handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle string message input', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'string-message-agent',
      name: 'String Message Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Simple string message');

    expect(result.workflowInput.messageListState).toBeDefined();
    expect(result.runId).toBeDefined();
  });

  it('should handle array of strings', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'array-string-agent',
      name: 'Array String Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare(['First message', 'Second message', 'Third message']);

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle message objects with role and content', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'message-object-agent',
      name: 'Message Object Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ]);

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle mixed message formats', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'mixed-format-agent',
      name: 'Mixed Format Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Mix of string and object messages
    const result = await agent.prepare([{ role: 'user', content: 'First as object' }]);

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle empty content messages', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'empty-content-agent',
      name: 'Empty Content Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare({ role: 'user', content: '' });

    expect(result.workflowInput.messageListState).toBeDefined();
  });

  it('should handle multi-part content messages', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'multipart-agent',
      name: 'Multipart Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare({
      role: 'user',
      content: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' },
      ],
    });

    expect(result.workflowInput.messageListState).toBeDefined();
  });
});

// ============================================================================
// Workflow State Serialization Tests
// ============================================================================

describe('DurableAgent workflow state serialization', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should create fully JSON-serializable workflow input', async () => {
    const mockModel = createTextModel('Hello');

    const testTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => value,
    });

    const agent = new DurableAgent({
      id: 'serialization-test-agent',
      name: 'Serialization Test Agent',
      instructions: 'Test instructions',
      model: mockModel as LanguageModelV2,
      tools: { testTool },
      pubsub,
    });

    const result = await agent.prepare('Test message', {
      maxSteps: 5,
      toolChoice: 'auto',
      memory: {
        thread: 'thread-123',
        resource: 'user-456',
      },
    });

    // Full round-trip serialization
    const serialized = JSON.stringify(result.workflowInput);
    const deserialized = JSON.parse(serialized);

    // Verify all fields survived serialization
    expect(deserialized.runId).toBe(result.runId);
    expect(deserialized.agentId).toBe('serialization-test-agent');
    expect(deserialized.agentName).toBe('Serialization Test Agent');
    expect(deserialized.messageId).toBe(result.messageId);
    expect(deserialized.messageListState).toBeDefined();
    expect(deserialized.toolsMetadata).toBeDefined();
    expect(deserialized.modelConfig).toBeDefined();
    expect(deserialized.options).toBeDefined();
    expect(deserialized.state).toBeDefined();
  });

  it('should serialize model configuration correctly', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'model-config-agent',
      name: 'Model Config Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    const serialized = JSON.stringify(result.workflowInput.modelConfig);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.provider).toBeDefined();
    expect(deserialized.modelId).toBeDefined();
    expect(typeof deserialized.provider).toBe('string');
    expect(typeof deserialized.modelId).toBe('string');
  });

  it('should serialize state with memory info correctly', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'state-serialize-agent',
      name: 'State Serialize Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', {
      memory: {
        thread: 'thread-abc',
        resource: 'user-xyz',
      },
    });

    const serialized = JSON.stringify(result.workflowInput.state);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.threadId).toBe('thread-abc');
    expect(deserialized.resourceId).toBe('user-xyz');
  });

  it('should serialize options correctly', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'options-serialize-agent',
      name: 'Options Serialize Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', {
      maxSteps: 10,
      toolChoice: 'required',
      requireToolApproval: true,
      toolCallConcurrency: 3,
      modelSettings: { temperature: 0.8 },
    });

    const serialized = JSON.stringify(result.workflowInput.options);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.maxSteps).toBe(10);
    expect(deserialized.toolChoice).toBe('required');
    expect(deserialized.requireToolApproval).toBe(true);
    expect(deserialized.toolCallConcurrency).toBe(3);
    expect(deserialized.temperature).toBe(0.8);
  });

  it('should handle complex tool metadata serialization', async () => {
    const mockModel = createTextModel('Hello');

    const complexTool = createTool({
      id: 'complex-tool',
      description: 'A complex tool with nested schema',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        filters: z
          .object({
            category: z.enum(['A', 'B', 'C']).optional(),
            minValue: z.number().optional(),
            tags: z.array(z.string()).optional(),
          })
          .optional(),
        pagination: z
          .object({
            page: z.number().default(1),
            limit: z.number().default(10),
          })
          .optional(),
      }),
      execute: async input => ({ results: [], query: input.query }),
    });

    const agent = new DurableAgent({
      id: 'complex-tool-agent',
      name: 'Complex Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { complexTool },
      pubsub,
    });

    const result = await agent.prepare('Test');

    // Tools metadata should be serializable
    const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('should handle MessageList serialization and deserialization', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'messagelist-agent',
      name: 'MessageList Agent',
      instructions: 'Test instructions',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Response' },
      { role: 'user', content: 'Follow-up' },
    ]);

    // MessageList state should be serializable
    const serialized = JSON.stringify(result.workflowInput.messageListState);
    const deserialized = JSON.parse(serialized);

    // Should be able to recreate a MessageList from the state
    const newMessageList = new MessageList({});
    newMessageList.deserialize(deserialized);

    // Verify messages can be retrieved
    const messages = newMessageList.get.all.db();
    expect(messages.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Model Configuration Tests
// ============================================================================

describe('DurableAgent model configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should extract model provider and modelId', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'model-extract-agent',
      name: 'Model Extract Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    expect(result.workflowInput.modelConfig.provider).toBeDefined();
    expect(result.workflowInput.modelConfig.modelId).toBeDefined();
  });

  it('should store model in registry for runtime access', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'model-registry-agent',
      name: 'Model Registry Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    // Model should be stored in registry
    // Note: The model may be wrapped (e.g., in AISDKV5LanguageModel), so we check properties
    const storedModel = agent.runRegistry.getModel(result.runId);
    expect(storedModel).toBeDefined();
    expect(storedModel?.modelId).toBe('mock-model-id');
    expect(storedModel?.provider).toBe('mock-provider');
  });
});

// ============================================================================
// Agent ID and Name Tests
// ============================================================================

describe('DurableAgent ID and name handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should use explicit name when provided', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'agent-id',
      name: 'Explicit Name',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    expect(agent.id).toBe('agent-id');
    expect(agent.name).toBe('Explicit Name');

    const result = await agent.prepare('Test');
    expect(result.workflowInput.agentId).toBe('agent-id');
    expect(result.workflowInput.agentName).toBe('Explicit Name');
  });

  it('should use ID as name when name not provided', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'agent-id-as-name',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    expect(agent.id).toBe('agent-id-as-name');
    expect(agent.name).toBe('agent-id-as-name');
  });

  it('should handle special characters in ID', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'agent-with-dashes_and_underscores',
      name: 'Special ID Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    expect(agent.id).toBe('agent-with-dashes_and_underscores');

    const result = await agent.prepare('Test');
    expect(result.workflowInput.agentId).toBe('agent-with-dashes_and_underscores');
  });
});

// ============================================================================
// Run ID and Message ID Tests
// ============================================================================

describe('DurableAgent ID generation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should generate unique runIds for each prepare call', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'unique-id-agent',
      name: 'Unique ID Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const results = await Promise.all([
      agent.prepare('Message 1'),
      agent.prepare('Message 2'),
      agent.prepare('Message 3'),
      agent.prepare('Message 4'),
      agent.prepare('Message 5'),
    ]);

    const runIds = results.map(r => r.runId);
    const uniqueRunIds = new Set(runIds);

    expect(uniqueRunIds.size).toBe(5);
  });

  it('should generate unique messageIds for each prepare call', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'unique-messageid-agent',
      name: 'Unique MessageID Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const results = await Promise.all([
      agent.prepare('Message 1'),
      agent.prepare('Message 2'),
      agent.prepare('Message 3'),
    ]);

    const messageIds = results.map(r => r.messageId);
    const uniqueMessageIds = new Set(messageIds);

    expect(uniqueMessageIds.size).toBe(3);
  });

  it('should allow custom runId via options', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'custom-runid-agent',
      name: 'Custom RunID Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const customRunId = 'my-custom-run-id-12345';
    const { runId, cleanup } = await agent.stream('Test', {
      runId: customRunId,
    });

    expect(runId).toBe(customRunId);
    cleanup();
  });
});

// ============================================================================
// Concurrent Operation Tests
// ============================================================================

describe('DurableAgent concurrent operations', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle multiple concurrent prepare calls', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'concurrent-agent',
      name: 'Concurrent Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Fire off multiple prepare calls concurrently
    const preparePromises = Array.from({ length: 10 }, (_, i) => agent.prepare(`Message ${i}`));

    const results = await Promise.all(preparePromises);

    // All should have unique runIds
    const runIds = results.map(r => r.runId);
    expect(new Set(runIds).size).toBe(10);

    // All should be registered
    for (const result of results) {
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    }
  });

  it('should isolate registry entries between runs', async () => {
    const mockModel = createTextModel('Hello');

    const tool1 = createTool({
      id: 'tool1',
      description: 'Tool 1',
      inputSchema: z.object({ x: z.number() }),
      execute: async ({ x }) => x * 2,
    });

    const agent = new DurableAgent({
      id: 'isolation-agent',
      name: 'Isolation Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { tool1 },
      pubsub,
    });

    const result1 = await agent.prepare('First');
    const result2 = await agent.prepare('Second');

    // Both should have their own registry entries
    const tools1 = agent.runRegistry.getTools(result1.runId);
    const tools2 = agent.runRegistry.getTools(result2.runId);

    expect(tools1.tool1).toBeDefined();
    expect(tools2.tool1).toBeDefined();

    // Cleanup one shouldn't affect the other
    agent.runRegistry.cleanup(result1.runId);
    expect(agent.runRegistry.has(result1.runId)).toBe(false);
    expect(agent.runRegistry.has(result2.runId)).toBe(true);
    expect(agent.runRegistry.getTools(result2.runId).tool1).toBeDefined();
  });
});

// ============================================================================
// Lazy Initialization Tests
// ============================================================================

describe('DurableAgent lazy initialization', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should not initialize Agent until first async method call', () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'lazy-init-agent',
      name: 'Lazy Init Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Synchronous properties should work
    expect(agent.id).toBe('lazy-init-agent');
    expect(agent.name).toBe('Lazy Init Agent');
    expect(agent.runRegistry).toBeDefined();

    // But agent getter should throw before initialization
    expect(() => agent.agent).toThrow('DurableAgent not initialized');
  });

  it('should initialize Agent after prepare call', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'init-after-prepare-agent',
      name: 'Init After Prepare Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Before prepare
    expect(() => agent.agent).toThrow();

    // After prepare
    await agent.prepare('Test');
    expect(agent.agent).toBeDefined();
    expect(agent.agent.id).toBe('init-after-prepare-agent');
  });

  it('should initialize Agent after stream call', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'init-after-stream-agent',
      name: 'Init After Stream Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Before stream
    expect(() => agent.agent).toThrow();

    // After stream
    const { cleanup } = await agent.stream('Test');
    expect(agent.agent).toBeDefined();
    cleanup();
  });

  it('should only initialize once even with multiple concurrent calls', async () => {
    const mockModel = createTextModel('Hello');

    const agent = new DurableAgent({
      id: 'single-init-agent',
      name: 'Single Init Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    // Multiple concurrent prepare calls
    const results = await Promise.all([agent.prepare('Test 1'), agent.prepare('Test 2'), agent.prepare('Test 3')]);

    // All should succeed and return different runIds
    expect(results.length).toBe(3);
    expect(new Set(results.map(r => r.runId)).size).toBe(3);

    // Agent should be initialized
    expect(agent.agent).toBeDefined();
  });
});
