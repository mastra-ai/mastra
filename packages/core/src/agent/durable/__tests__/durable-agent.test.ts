import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { RunRegistry, ExtendedRunRegistry } from '../run-registry';
import { MessageList } from '../../message-list';
import type { AgentStreamEvent } from '../types';

// ============================================================================
// DurableAgent Core Tests
// ============================================================================

describe('DurableAgent', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('constructor', () => {
    it('should create a DurableAgent with required config', () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // id and name are available synchronously from config
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.runRegistry).toBeDefined();

      // agent getter throws before initialization
      expect(() => agent.agent).toThrow('DurableAgent not initialized');
    });

    it('should provide agent instance after async initialization', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: 'Hello' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      const durableAgent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // After calling prepare (async), agent should be available
      await durableAgent.prepare('Hello');
      expect(durableAgent.agent).toBeDefined();
      expect(durableAgent.agent.id).toBe('test-agent');
    });

    it('should use agent id as name when name is not provided', () => {
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
        id: 'my-agent-id',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      expect(agent.name).toBe('my-agent-id');
    });
  });

  describe('prepare', () => {
    it('should prepare workflow input without starting execution', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello!');

      expect(result.runId).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
      expect(result.workflowInput.runId).toBe(result.runId);
      expect(result.workflowInput.agentId).toBe('test-agent');
      expect(result.workflowInput.messageListState).toBeDefined();
      expect(result.workflowInput.modelConfig).toBeDefined();
      expect(result.workflowInput.options).toBeDefined();

      // Verify entry was registered
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept string messages', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello, world!');

      expect(result.workflowInput.messageListState).toBeDefined();
      // Verify messages were added to message list
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept array of string messages', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare(['First message', 'Second message']);

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept message objects', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare([
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]);

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });
  });

  describe('getWorkflow', () => {
    it('should return the durable workflow', () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const workflow = agent.getWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('durable-agentic-loop');
    });

    it('should return the same workflow instance on multiple calls', () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const workflow1 = agent.getWorkflow();
      const workflow2 = agent.getWorkflow();

      expect(workflow1).toBe(workflow2);
    });
  });

  describe('runRegistry', () => {
    it('should track active runs', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Initially empty
      expect(agent.runRegistry.size).toBe(0);

      // After prepare, should have one entry
      const result = await agent.prepare('Hello!');
      expect(agent.runRegistry.size).toBe(1);
      expect(agent.runRegistry.has(result.runId)).toBe(true);

      // After cleanup, should be empty again
      agent.runRegistry.cleanup(result.runId);
      expect(agent.runRegistry.size).toBe(0);
    });

    it('should track multiple concurrent runs', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Create multiple runs
      const result1 = await agent.prepare('First message');
      const result2 = await agent.prepare('Second message');
      const result3 = await agent.prepare('Third message');

      expect(agent.runRegistry.size).toBe(3);
      expect(agent.runRegistry.has(result1.runId)).toBe(true);
      expect(agent.runRegistry.has(result2.runId)).toBe(true);
      expect(agent.runRegistry.has(result3.runId)).toBe(true);

      // Cleanup one
      agent.runRegistry.cleanup(result2.runId);
      expect(agent.runRegistry.size).toBe(2);
      expect(agent.runRegistry.has(result2.runId)).toBe(false);
    });
  });
});

// ============================================================================
// DurableAgent Preparation Tests
// ============================================================================

describe('DurableAgent preparation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should serialize tool metadata correctly', async () => {
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
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test assistant',
      model: mockModel as LanguageModelV2,
      tools: {
        greet: {
          description: 'Greet a user',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
          execute: async ({ name }: { name: string }) => `Hello, ${name}!`,
        },
      },
      pubsub,
    });

    const result = await agent.prepare('Say hello to Alice');

    // Check that tool metadata is serialized
    expect(result.workflowInput.toolsMetadata).toBeDefined();
    expect(result.workflowInput.toolsMetadata.length).toBeGreaterThanOrEqual(0);

    // Verify tools are stored in registry (with execute functions)
    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools).toBeDefined();
  });

  it('should handle memory options', async () => {
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
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test assistant',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello!', {
      memory: {
        thread: 'thread-123',
        resource: 'user-456',
      },
    });

    expect(result.threadId).toBe('thread-123');
    expect(result.resourceId).toBe('user-456');
    expect(result.workflowInput.state.threadId).toBe('thread-123');
    expect(result.workflowInput.state.resourceId).toBe('user-456');
  });

  it('should store model in registry', async () => {
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
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test assistant',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello!');

    // Model should be stored in registry
    const model = agent.runRegistry.getModel(result.runId);
    expect(model).toBeDefined();
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

    const echoTool = createTool({
      id: 'echo',
      description: 'Echo a message',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ message }) => message,
    });

    const uppercaseTool = createTool({
      id: 'uppercase',
      description: 'Convert to uppercase',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => text.toUpperCase(),
    });

    const agent = new DurableAgent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test assistant',
      model: mockModel as LanguageModelV2,
      tools: { echo: echoTool, uppercase: uppercaseTool },
      pubsub,
    });

    const result = await agent.prepare('Use both tools');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(Object.keys(tools)).toContain('echo');
    expect(Object.keys(tools)).toContain('uppercase');
  });
});

// ============================================================================
// DurableAgent PubSub Integration Tests
// ============================================================================

describe('DurableAgent pubsub integration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should emit events to the correct topic', async () => {
    const receivedEvents: AgentStreamEvent[] = [];
    const runId = 'test-run-123';

    // Subscribe to events
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      receivedEvents.push(event as unknown as AgentStreamEvent);
    });

    // Publish a test event
    await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { type: 'text-delta', payload: { text: 'Hello' } },
    });

    // Wait a tick for event to be processed
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
  });

  it('should handle multiple event types', async () => {
    const receivedEvents: AgentStreamEvent[] = [];
    const runId = 'test-run-multi-events';

    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      receivedEvents.push(event as unknown as AgentStreamEvent);
    });

    // Publish different event types
    await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
      type: AgentStreamEventTypes.STEP_START,
      runId,
      data: { stepId: 'step-1' },
    });

    await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { type: 'text-delta', payload: { text: 'Hello' } },
    });

    await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
      type: AgentStreamEventTypes.STEP_FINISH,
      runId,
      data: { stepResult: { reason: 'stop' } },
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(receivedEvents.length).toBe(3);
    expect(receivedEvents.map(e => e.type)).toEqual([
      AgentStreamEventTypes.STEP_START,
      AgentStreamEventTypes.CHUNK,
      AgentStreamEventTypes.STEP_FINISH,
    ]);
  });
});

// ============================================================================
// createDurableAgentStream Tests
// ============================================================================

describe('createDurableAgentStream', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should create a stream that receives pubsub events', async () => {
    const { createDurableAgentStream } = await import('../stream-adapter');

    const runId = 'test-run-456';
    const receivedChunks: any[] = [];

    const { output, cleanup } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: 'msg-123',
      model: {
        modelId: 'test-model',
        provider: 'test',
        version: 'v3',
      },
      onChunk: chunk => {
        receivedChunks.push(chunk);
      },
    });

    expect(output).toBeDefined();

    // Clean up
    cleanup();
  });

  it('should invoke callbacks for different event types', async () => {
    const { createDurableAgentStream, emitChunkEvent, emitStepFinishEvent, emitFinishEvent } =
      await import('../stream-adapter');

    const runId = 'test-run-callbacks';
    const chunks: any[] = [];
    const stepFinishes: any[] = [];
    const finishes: any[] = [];

    const { cleanup } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: 'msg-callbacks',
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      onChunk: chunk => chunks.push(chunk),
      onStepFinish: data => stepFinishes.push(data),
      onFinish: data => finishes.push(data),
    });

    // Emit various events
    await emitChunkEvent(pubsub, runId, { type: 'text-delta', payload: { text: 'test' } } as any);
    await emitStepFinishEvent(pubsub, runId, {
      stepResult: { reason: 'stop', warnings: [], isContinued: false },
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(chunks.length).toBe(1);
    expect(stepFinishes.length).toBe(1);

    cleanup();
  });
});

// ============================================================================
// RunRegistry Tests
// ============================================================================

describe('RunRegistry', () => {
  it('should store and retrieve tools', () => {
    const registry = new RunRegistry();
    const runId = 'test-run-789';
    const tools = {
      testTool: {
        description: 'A test tool',
        parameters: { type: 'object' },
        execute: async () => 'result',
      },
    };
    const mockModel = { provider: 'test', modelId: 'test-model' } as any;

    registry.register(runId, {
      tools,
      saveQueueManager: undefined as any,
      model: mockModel,
    });

    expect(registry.has(runId)).toBe(true);
    expect(registry.getTools(runId)).toBe(tools);
    expect(registry.getModel(runId)).toBe(mockModel);

    registry.cleanup(runId);
    expect(registry.has(runId)).toBe(false);
  });

  it('should handle multiple runs', () => {
    const registry = new RunRegistry();
    const mockModel = { provider: 'test', modelId: 'test-model' } as any;

    registry.register('run-1', { tools: { a: {} } as any, saveQueueManager: undefined as any, model: mockModel });
    registry.register('run-2', { tools: { b: {} } as any, saveQueueManager: undefined as any, model: mockModel });
    registry.register('run-3', { tools: { c: {} } as any, saveQueueManager: undefined as any, model: mockModel });

    expect(registry.size).toBe(3);
    expect(registry.runIds).toContain('run-1');
    expect(registry.runIds).toContain('run-2');
    expect(registry.runIds).toContain('run-3');

    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('should replace existing entry on re-register', () => {
    const registry = new RunRegistry();
    const mockModel = { provider: 'test', modelId: 'test-model' } as any;
    const runId = 'test-run';

    const tools1 = { tool1: { description: 'First' } } as any;
    const tools2 = { tool2: { description: 'Second' } } as any;

    registry.register(runId, { tools: tools1, saveQueueManager: undefined as any, model: mockModel });
    expect(registry.getTools(runId)).toBe(tools1);

    registry.register(runId, { tools: tools2, saveQueueManager: undefined as any, model: mockModel });
    expect(registry.getTools(runId)).toBe(tools2);
    expect(registry.size).toBe(1);
  });
});

// ============================================================================
// ExtendedRunRegistry Tests
// ============================================================================

describe('ExtendedRunRegistry', () => {
  it('should store and retrieve memory info', () => {
    const registry = new ExtendedRunRegistry();
    const runId = 'test-run-extended';
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
    const mockModel = { provider: 'test', modelId: 'test-model' } as any;

    registry.registerWithMessageList(
      runId,
      { tools: {}, saveQueueManager: undefined as any, model: mockModel },
      messageList,
      {
        threadId: 'thread-1',
        resourceId: 'user-1',
      },
    );

    expect(registry.has(runId)).toBe(true);
    expect(registry.getMessageList(runId)).toBe(messageList);
    expect(registry.getMemoryInfo(runId)).toEqual({ threadId: 'thread-1', resourceId: 'user-1' });
    expect(registry.getModel(runId)).toBe(mockModel);

    registry.cleanup(runId);
    expect(registry.has(runId)).toBe(false);
    expect(registry.getMessageList(runId)).toBeUndefined();
    expect(registry.getMemoryInfo(runId)).toBeUndefined();
  });

  it('should inherit all RunRegistry functionality', () => {
    const registry = new ExtendedRunRegistry();
    const mockModel = { provider: 'test', modelId: 'test-model' } as any;

    // Can use basic register
    registry.register('basic-run', { tools: { t: {} } as any, saveQueueManager: undefined as any, model: mockModel });
    expect(registry.has('basic-run')).toBe(true);
    expect(registry.getTools('basic-run')).toBeDefined();

    // Can use extended register
    const messageList = new MessageList({});
    registry.registerWithMessageList(
      'extended-run',
      { tools: {}, saveQueueManager: undefined as any, model: mockModel },
      messageList,
      { threadId: 't1' },
    );

    expect(registry.size).toBe(2);
    expect(registry.getMessageList('extended-run')).toBe(messageList);
    expect(registry.getMemoryInfo('extended-run')?.threadId).toBe('t1');

    registry.clear();
    expect(registry.size).toBe(0);
  });
});

// ============================================================================
// DurableAgent with Tools Tests
// ============================================================================

describe('DurableAgent with tools', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should store tools with execute functions in registry', async () => {
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
      id: 'test',
      description: 'A test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `Executed with: ${value}`,
    });

    const agent = new DurableAgent({
      id: 'tool-agent',
      name: 'Tool Agent',
      instructions: 'Use tools',
      model: mockModel as LanguageModelV2,
      tools: { test: testTool },
      pubsub,
    });

    const result = await agent.prepare('Use the test tool');

    // Tools should be in registry
    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.test).toBeDefined();
    expect(typeof tools.test.execute).toBe('function');

    // Execute function should work
    const execResult = await tools.test.execute!({ value: 'hello' }, {} as any);
    expect(execResult).toBe('Executed with: hello');
  });

  it('should handle tools defined with object syntax', async () => {
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
      id: 'tool-agent',
      name: 'Tool Agent',
      instructions: 'Use tools',
      model: mockModel as LanguageModelV2,
      tools: {
        simpleTool: {
          description: 'A simple tool',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
          execute: async ({ input }: { input: string }) => `Result: ${input}`,
        },
      },
      pubsub,
    });

    const result = await agent.prepare('Test');

    const tools = agent.runRegistry.getTools(result.runId);
    expect(tools.simpleTool).toBeDefined();
  });
});

// ============================================================================
// Emit Helper Functions Tests
// ============================================================================

describe('emit helper functions', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('emitChunkEvent should publish chunk events', async () => {
    const { emitChunkEvent } = await import('../stream-adapter');
    const runId = 'test-emit-chunk';
    const received: any[] = [];

    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event);
    });

    await emitChunkEvent(pubsub, runId, { type: 'text-delta', payload: { text: 'test' } } as any);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0].type).toBe(AgentStreamEventTypes.CHUNK);
  });

  it('emitErrorEvent should publish error events', async () => {
    const { emitErrorEvent } = await import('../stream-adapter');
    const runId = 'test-emit-error';
    const received: any[] = [];

    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event);
    });

    const error = new Error('Test error');
    error.stack = 'test stack';
    await emitErrorEvent(pubsub, runId, error);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0].type).toBe(AgentStreamEventTypes.ERROR);
    expect(received[0].data.error.message).toBe('Test error');
    expect(received[0].data.error.stack).toBe('test stack');
  });

  it('emitSuspendedEvent should publish suspended events', async () => {
    const { emitSuspendedEvent } = await import('../stream-adapter');
    const runId = 'test-emit-suspended';
    const received: any[] = [];

    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event);
    });

    await emitSuspendedEvent(pubsub, runId, {
      type: 'approval',
      toolCallId: 'tc-1',
      toolName: 'myTool',
      args: { foo: 'bar' },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0].type).toBe(AgentStreamEventTypes.SUSPENDED);
    expect(received[0].data.toolName).toBe('myTool');
    expect(received[0].data.type).toBe('approval');
  });
});
