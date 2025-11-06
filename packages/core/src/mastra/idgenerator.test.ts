import { MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent';
import { MessageList } from '../agent/message-list';
import { MastraError } from '../error';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { Mastra } from './index';

// Helper function to create a Mastra instance with proper memory registration
function createMastraWithMemory(idGenerator?: () => string) {
  // Create a mock memory instance
  const memory = new MockMemory();

  // Create an agent with the registered memory
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent',
    model: new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Test response',
      }),
    }),
    memory,
  });

  const mastra = new Mastra({
    idGenerator,
    logger: false,
    agents: {
      testAgent: agent,
    },
  });

  return { mastra, agent, memory };
}

describe('Mastra ID Generator', () => {
  let customIdGenerator: () => string;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;
    customIdGenerator = vi.fn(() => `custom-id-${++idCounter}`);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core ID Generator Functionality', () => {
    it('should use custom ID generator when provided', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(customIdGenerator).toHaveBeenCalledTimes(2);
      expect(id1).toBe('custom-id-1');
      expect(id2).toBe('custom-id-2');
    });

    it('should fallback to crypto.randomUUID when no custom generator is provided', () => {
      const mastra = new Mastra({
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(customIdGenerator).not.toHaveBeenCalled();
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id1).not.toBe(id2);
    });

    it('should return the custom ID generator function via getIdGenerator', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      expect(mastra.getIdGenerator()).toBe(customIdGenerator);
    });

    it('should return undefined for getIdGenerator when no custom generator is provided', () => {
      const mastra = new Mastra({
        logger: false,
      });

      expect(mastra.getIdGenerator()).toBeUndefined();
    });

    it('should maintain ID uniqueness across multiple generations', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(mastra.generateId());
      }

      expect(ids.size).toBe(10);
      expect(customIdGenerator).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent ID generation', async () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const promises = Array.from({ length: 10 }, () => Promise.resolve(mastra.generateId()));
      const ids = await Promise.all(promises);

      expect(customIdGenerator).toHaveBeenCalledTimes(10);
      expect(ids.length).toBe(10);
      expect(new Set(ids).size).toBe(10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null ID generator gracefully', () => {
      const mastra = new Mastra({
        idGenerator: null as any,
        logger: false,
      });

      const id = mastra.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle undefined ID generator gracefully', () => {
      const mastra = new Mastra({
        idGenerator: undefined as any,
        logger: false,
      });

      const id = mastra.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle ID generator that returns empty string', () => {
      const emptyIdGenerator = vi.fn(() => '');

      const mastra = new Mastra({
        idGenerator: emptyIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
      expect(emptyIdGenerator).toHaveBeenCalledTimes(2);
    });

    it('should handle ID generator that returns the same value', () => {
      const staticIdGenerator = vi.fn(() => 'static-id');

      const mastra = new Mastra({
        idGenerator: staticIdGenerator,
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(id1).toBe('static-id');
      expect(id2).toBe('static-id');
      expect(staticIdGenerator).toHaveBeenCalledTimes(2);
    });

    it('should handle ID generator that throws an error', () => {
      const errorIdGenerator = vi.fn(() => {
        throw new Error('ID generation failed');
      });

      const mastra = new Mastra({
        idGenerator: errorIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow('ID generation failed');
      expect(errorIdGenerator).toHaveBeenCalledTimes(1);
    });

    it('should handle ID generator that returns null', () => {
      const nullIdGenerator = vi.fn(() => null as any);

      const mastra = new Mastra({
        idGenerator: nullIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
    });

    it('should handle ID generator that returns undefined', () => {
      const undefinedIdGenerator = vi.fn(() => undefined as any);

      const mastra = new Mastra({
        idGenerator: undefinedIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
    });
  });

  describe('MessageList Integration', () => {
    it('should use custom ID generator for message creation', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });

      messageList.add('User message', 'user');
      messageList.add({ role: 'assistant', content: 'Assistant message' }, 'response');
      messageList.addSystem('System message', 'system'); // System messages don't get IDs

      expect(customIdGenerator).toHaveBeenCalledTimes(2); // Only user and assistant messages
    });

    it('should fallback to randomUUID when no custom ID generator provided', () => {
      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
      });

      messageList.add('Test message', 'user');
      expect(customIdGenerator).not.toHaveBeenCalled();
    });

    it('should handle context binding issues properly', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      // Test unbound function (should fail)
      const unboundGenerator = mastra.generateId;
      const messageList1 = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: unboundGenerator,
      });
      expect(() => messageList1.add('Test message', 'user')).toThrow('Cannot read private member #idGenerator');

      // Test properly bound function (should work)
      const messageList2 = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });
      messageList2.add('Test message', 'user');
      expect(customIdGenerator).toHaveBeenCalled();
    });
  });

  describe('Agent Integration with Memory', () => {
    it('should use custom ID generator in agent operations', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory(customIdGenerator);

      await agent.generateLegacy('Hello');
      expect(customIdGenerator).toHaveBeenCalled();
    });

    it('should use custom ID generator for agent memory operations', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      const id = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(id).toMatch(/^custom-id-\d+$/);
    });

    it('should use custom ID generator across multiple agents', async () => {
      const memory1 = new MockMemory();
      const agent1 = new Agent({
        id: 'agent1',
        name: 'Agent 1',
        instructions: 'You are agent 1',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Response 1',
          }),
        }),
        memory: memory1,
      });

      const memory2 = new MockMemory();
      const agent2 = new Agent({
        id: 'agent2',
        name: 'Agent 2',
        instructions: 'You are agent 2',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Response 2',
          }),
        }),
        memory: memory2,
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { agent1, agent2 },
      });

      await agent1.generateLegacy('Hello from agent 1');
      await agent2.generateLegacy('Hello from agent 2');

      expect(customIdGenerator).toHaveBeenCalled();
    });

    it('should use custom ID generator in streaming operations', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory(customIdGenerator);

      await agent.streamLegacy('Hello', {
        threadId: 'test-thread',
        resourceId: 'test-resource',
      });

      expect(customIdGenerator).toHaveBeenCalled();
    });
  });

  describe('Dynamic Memory Creation', () => {
    it('should pass Mastra instance and request context to dynamic memory function', async () => {
      let receivedMastraInstance: Mastra | undefined;
      let receivedRequestContext: RequestContext | undefined;

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Test response',
          }),
        }),
        memory: ({ requestContext, mastra: mastraInstance }) => {
          receivedMastraInstance = mastraInstance;
          receivedRequestContext = requestContext;

          // Verify the Mastra instance has the custom ID generator
          if (mastraInstance) {
            expect(mastraInstance.getIdGenerator()).toBe(customIdGenerator);
          }

          return new MockMemory();
        },
      });

      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      expect(receivedMastraInstance).toBe(mastra);
      expect(receivedRequestContext).toBeDefined();
      expect(typeof receivedRequestContext?.get).toBe('function');
      expect(typeof receivedRequestContext?.set).toBe('function');

      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should handle dynamic memory creation with request context data', async () => {
      let contextUserId: string | undefined;
      let contextSessionId: string | undefined;

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a context-aware agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Context-aware response',
          }),
        }),
        memory: ({ requestContext, mastra: mastraInstance }) => {
          contextUserId = requestContext.get('userId');
          contextSessionId = requestContext.get('sessionId');

          // Verify access to custom ID generator
          expect(mastraInstance?.getIdGenerator()).toBe(customIdGenerator);

          const memory = new MockMemory();
          // Customize memory based on context
          if (contextUserId && contextSessionId) {
            memory.name = `memory-${contextUserId}-${contextSessionId}`;
          }
          return memory;
        },
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      // Create request context with user data
      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      requestContext.set('sessionId', 'session-456');

      const agentMemory = await agent.getMemory({ requestContext });
      if (!agentMemory) throw new Error('Memory not found');

      expect(contextUserId).toBe('user-123');
      expect(contextSessionId).toBe('session-456');
      expect(agentMemory.name).toBe('memory-user-123-session-456');

      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should create different memory instances for different request contexts', async () => {
      const memoryInstances: MockMemory[] = [];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a multi-context agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Multi-context response',
          }),
        }),
        memory: ({ requestContext, mastra: mastraInstance }) => {
          const userId = requestContext.get('userId');
          expect(mastraInstance?.getIdGenerator()).toBe(customIdGenerator);

          const memory = new MockMemory();
          memory.name = `memory-${userId}`;
          memoryInstances.push(memory);
          return memory;
        },
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      // Create different request contexts
      const context1 = new RequestContext();
      context1.set('userId', 'user-1');

      const context2 = new RequestContext();
      context2.set('userId', 'user-2');

      const memory1 = await agent.getMemory({ requestContext: context1 });
      const memory2 = await agent.getMemory({ requestContext: context2 });

      expect(memory1).not.toBe(memory2);
      expect(memory1?.name).toBe('memory-user-1');
      expect(memory2?.name).toBe('memory-user-2');
      expect(memoryInstances).toHaveLength(2);

      // Both should use the same custom ID generator
      const id1 = memory1?.generateId();
      const id2 = memory2?.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(id1).toMatch(/^custom-id-\d+$/);
      expect(id2).toMatch(/^custom-id-\d+$/);
    });

    it('should handle dynamic memory creation errors gracefully', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Test response',
          }),
        }),
        memory: ({ requestContext, mastra: mastraInstance }) => {
          // Verify the ID generator is available even when memory creation might fail
          expect(mastraInstance?.getIdGenerator()).toBe(customIdGenerator);

          const shouldFail = requestContext.get('shouldFail');
          if (shouldFail) {
            throw new Error('Memory creation failed');
          }
          return new MockMemory();
        },
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      // Test successful memory creation
      const successContext = new RequestContext();
      successContext.set('shouldFail', false);
      const successMemory = await agent.getMemory({ requestContext: successContext });
      expect(successMemory).toBeDefined();

      // Test failed memory creation
      const failContext = new RequestContext();
      failContext.set('shouldFail', true);
      await expect(agent.getMemory({ requestContext: failContext })).rejects.toThrow('Memory creation failed');
    });
  });

  describe('ID Generator Lifecycle and Consistency', () => {
    it('should maintain consistency across all components', async () => {
      const { mastra, agent } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Test all components use the same generator
      const mastraId = mastra.generateId();
      const memoryId = agentMemory.generateId();

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });
      messageList.add('Test message', 'user');

      expect(customIdGenerator).toHaveBeenCalled();
      expect(mastraId).toMatch(/^custom-id-\d+$/);
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should allow changing ID generator after creation', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const newIdGenerator = vi.fn(() => `new-id-${++idCounter}`);
      mastra.setIdGenerator(newIdGenerator);

      expect(mastra.getIdGenerator()).toBe(newIdGenerator);
      expect(mastra.generateId()).toBe('new-id-1');
    });

    it('should propagate ID generator changes to components', async () => {
      const { mastra, agent } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      const newIdGenerator = vi.fn(() => `new-id-${++idCounter}`);
      mastra.setIdGenerator(newIdGenerator);

      const memoryId = agentMemory.generateId();
      expect(newIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^new-id-\d+$/);
    });
  });

  describe('End-to-End User Workflows', () => {
    it('should handle complete user conversation workflow', async () => {
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'help-agent',
        name: 'Help Agent',
        instructions: 'You are a helpful assistant',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'I can help you with that!',
          }),
        }),
        memory,
      });

      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { helpAgent: agent },
      });

      // Simulate user conversation
      await agent.generateLegacy('Hello, can you help me?', {
        threadId: 'user-conversation',
        resourceId: 'user-session',
      });

      expect(customIdGenerator).toHaveBeenCalled();
      expect(mastra.getIdGenerator()).toBe(customIdGenerator);
    });

    it('should handle multi-user concurrent conversations', async () => {
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'multi-user-agent',
        name: 'Multi-User Agent',
        instructions: 'You are a multi-user assistant',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Hello! I can help multiple users.',
          }),
        }),
        memory,
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { multiUserAgent: agent },
      });

      // Simulate concurrent conversations
      const conversations = [
        { threadId: 'user1-thread', resourceId: 'user1-session', message: 'Hello from user 1' },
        { threadId: 'user2-thread', resourceId: 'user2-session', message: 'Hello from user 2' },
        { threadId: 'user3-thread', resourceId: 'user3-session', message: 'Hello from user 3' },
      ];

      const results = await Promise.all(
        conversations.map(conv =>
          agent.generateLegacy(conv.message, {
            threadId: conv.threadId,
            resourceId: conv.resourceId,
          }),
        ),
      );

      expect(customIdGenerator).toHaveBeenCalled();
      expect(results).toHaveLength(3);
    });

    it('should handle complex workflow with memory operations', async () => {
      const memory = new MockMemory();

      const agent = new Agent({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        instructions: 'You are a workflow assistant',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Workflow step completed.',
          }),
        }),
        memory,
      });

      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { workflowAgent: agent },
      });

      // Register mastra with memory so it can use the custom ID generator
      memory.__registerMastra(mastra);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Create workflow thread
      const thread = await agentMemory.createThread({
        threadId: 'workflow-thread',
        resourceId: 'workflow-resource',
        title: 'Multi-step Workflow',
      });

      // Add workflow steps
      const steps = ['Initialize', 'Process', 'Validate', 'Complete'];
      const savedMessageIds: string[] = [];
      for (const step of steps) {
        const result = await agentMemory.saveMessages({
          messages: [
            {
              // Omit id to let saveMessages/memory generate it using the custom generator
              threadId: thread.id,
              resourceId: 'workflow-resource',
              content: {
                format: 2,
                parts: [{ type: 'text', text: `${step} workflow step` }],
              },
              role: 'user',
              createdAt: new Date(),
            },
          ],
        });
        savedMessageIds.push(...result.messages.map(m => m.id));
      }

      // Verify custom ID generator was called
      expect(customIdGenerator).toHaveBeenCalled();

      // Verify all saved message IDs start with the custom prefix
      savedMessageIds.forEach(id => {
        expect(id).toMatch(/^custom-id-/);
      });
    });

    it('should handle streaming operations with memory persistence', async () => {
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'streaming-agent',
        name: 'Streaming Agent',
        instructions: 'You are a streaming assistant',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Streaming response content.',
          }),
        }),
        memory,
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { streamingAgent: agent },
      });

      await agent.streamLegacy('Please provide a streaming response', {
        threadId: 'streaming-thread',
        resourceId: 'streaming-resource',
      });

      expect(customIdGenerator).toHaveBeenCalled();
    });
  });
});
