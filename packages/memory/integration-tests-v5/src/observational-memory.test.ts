import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { ObservationalMemory } from '@mastra/memory/observational';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Integration tests for ObservationalMemory with real Agent and LibSQL storage.
 *
 * These tests verify that the ObservationalMemory processor correctly:
 * 1. Injects observations into the agent's context via system messages
 * 2. Creates observations from conversations after agent.generate
 * 3. Tracks observed message IDs correctly
 * 4. Works with the full agent pipeline
 */

let storage: LibSQLStore;
let dbPath: string;
const resourceId = 'observational-memory-test';

beforeEach(async () => {
  // Create a new unique database file in the temp directory for each test
  dbPath = join(await mkdtemp(join(tmpdir(), `observational-memory-test-`)), 'test.db');

  storage = new LibSQLStore({
    id: 'observational-memory-test-storage',
    url: `file:${dbPath}`,
  });

  // Initialize storage tables including observations
  await storage.init();
});

afterEach(async () => {
  //@ts-ignore
  await storage.client?.close?.();
});

// Helper to extract text from message content
function getTextFromContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }
  if (content?.parts) {
    return content.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }
  return '';
}

// Helper to check if a message contains specific text
function messageContainsText(msg: CoreMessage, text: string): boolean {
  const content = getTextFromContent(msg.content);
  return content.toLowerCase().includes(text.toLowerCase());
}

describe('ObservationalMemory with Agent Integration', () => {
  describe('Observation Injection into Agent Context', () => {
    it('should inject existing observations as system message when agent.generate is called', async () => {
      const threadId = 'inject-test-thread';

      // Pre-populate observations in storage
      await storage.stores!.memory.saveObservations({
        observations: [
          {
            id: 'obs-inject-1',
            threadId,
            resourceId,
            observation: '- User prefers TypeScript over JavaScript\n- User lives in San Francisco',
            observedMessageIds: ['old-msg-1', 'old-msg-2'],
            bufferedMessageIds: [],
            bufferingMessageIds: [],
            originType: 'initial',
            totalTokensObserved: 100,
            observationTokenCount: 50,
            isReflecting: false,
            metadata: { reflectionCount: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Create ObservationalMemory processor
      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 10000, // High threshold to prevent new observations
        },
        debug: true,
      });

      // Create Memory with standard options
      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      // Create agent with ObservationalMemory as input processor
      const agent = new Agent({
        id: 'observation-inject-agent',
        name: 'Observation Inject Agent',
        instructions: 'You are a helpful assistant. Use the observational memory to recall user preferences.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
      });

      // Call agent.generate - this should inject observations
      const response = await agent.generate('What programming language do I prefer?', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Check the actual request sent to the LLM
      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Find system messages containing observations
      const observationSystemMessage = requestMessages.find(
        msg => msg.role === 'system' && messageContainsText(msg, 'observational_memory'),
      );

      expect(observationSystemMessage).toBeDefined();

      // Verify the observations content is included
      const systemContent = getTextFromContent(observationSystemMessage?.content);
      expect(systemContent).toContain('TypeScript');
      expect(systemContent).toContain('San Francisco');
    });

    it('should not inject observations when none exist for the thread', async () => {
      const threadId = 'no-observations-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 10000,
        },
        debug: false,
      });

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'no-observation-agent',
        name: 'No Observation Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
      });

      const response = await agent.generate('Hello!', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should NOT have an observational_memory system message
      const observationSystemMessage = requestMessages.find(
        msg => msg.role === 'system' && messageContainsText(msg, 'observational_memory'),
      );

      expect(observationSystemMessage).toBeUndefined();
    });
  });

  describe('Observation Creation after agent.generate', () => {
    it('should create observations after agent.generate when history threshold is exceeded', async () => {
      const threadId = 'create-obs-thread';

      // Create processor with LOW threshold to trigger observation
      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 50, // Very low threshold
        },
        debug: true,
      });

      // Mock the observer agent to return controlled observations
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockResolvedValue({
          text: '- User greeted the assistant\n- User asked about weather',
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'create-obs-agent',
        name: 'Create Observation Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Generate with a message that exceeds the threshold (~50 tokens)
      const longMessage =
        'Hello, I would like to know about the weather forecast for this week. Can you help me with that? I am planning a trip and need to know if it will rain or be sunny.';

      await agent.generate(longMessage, {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Verify observations were saved to storage
      const observations = await storage.stores!.memory.listObservations({ threadId });

      expect(observations.length).toBeGreaterThan(0);
      expect(observations[0].observation).toContain('User greeted');
      expect(observations[0].observation).toContain('weather');
      expect(observations[0].originType).toBe('initial');
    });

    it('should track message IDs that have been observed', async () => {
      const threadId = 'track-ids-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 20, // Very low threshold
        },
        debug: true,
      });

      // Mock the observer agent
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockResolvedValue({
          text: '- Test observation',
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'track-ids-agent',
        name: 'Track IDs Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // First generate call
      await agent.generate('This is my first message with enough content to trigger observation.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Check that message IDs were tracked
      const observations = await storage.stores!.memory.listObservations({ threadId });

      expect(observations.length).toBeGreaterThan(0);
      expect(observations[0].observedMessageIds.length).toBeGreaterThan(0);
    });

    it('should NOT create observations when history is below threshold', async () => {
      const threadId = 'below-threshold-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 100000, // Very high threshold
        },
        debug: false,
      });

      // Mock the observer agent - should NOT be called
      const mockGenerate = vi.fn().mockResolvedValue({
        text: '- Should not be created',
      });
      (observationalMemory as any).observerAgent = {
        generate: mockGenerate,
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'below-threshold-agent',
        name: 'Below Threshold Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Short message - should not trigger observation
      await agent.generate('Hi', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Observer should NOT have been called
      expect(mockGenerate).not.toHaveBeenCalled();

      // No observations should exist
      const observations = await storage.stores!.memory.listObservations({ threadId });
      expect(observations).toHaveLength(0);
    });
  });

  describe('Multi-turn Conversation with Observations', () => {
    it('should accumulate observations across multiple agent.generate calls', async () => {
      const threadId = 'multi-turn-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 30, // Low threshold
        },
        debug: true,
      });

      let callCount = 0;
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            text: `- Observation from call ${callCount}`,
          });
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'multi-turn-agent',
        name: 'Multi-turn Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // First turn
      await agent.generate('First message with enough content to trigger observation and build context.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Second turn
      await agent.generate('Second message continuing our conversation with additional details.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Check observations
      const observations = await storage.stores!.memory.listObservations({ threadId });

      expect(observations.length).toBeGreaterThanOrEqual(1);
      // The observation should contain accumulated content
      const latestObs = observations[observations.length - 1];
      expect(latestObs.observation).toBeDefined();
    });

    it('should use observations from previous turns in subsequent agent.generate calls', async () => {
      const threadId = 'use-previous-obs-thread';

      // First, create observations manually
      await storage.stores!.memory.saveObservations({
        observations: [
          {
            id: 'prev-obs-1',
            threadId,
            resourceId,
            observation: '- User mentioned their favorite color is blue\n- User is interested in photography',
            observedMessageIds: ['old-msg-1'],
            bufferedMessageIds: [],
            bufferingMessageIds: [],
            originType: 'initial',
            totalTokensObserved: 50,
            observationTokenCount: 30,
            isReflecting: false,
            metadata: { reflectionCount: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 100000, // High to prevent new observations
        },
        debug: true,
      });

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'use-previous-agent',
        name: 'Use Previous Agent',
        instructions: 'You are a helpful assistant. Use the observations to personalize your responses.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Generate - should inject the previous observations
      const response = await agent.generate('What do you remember about me?', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Verify observations were injected
      const requestMessages: CoreMessage[] = (response.request.body as any).input;
      const observationMessage = requestMessages.find(
        msg => msg.role === 'system' && messageContainsText(msg, 'observational_memory'),
      );

      expect(observationMessage).toBeDefined();
      const content = getTextFromContent(observationMessage?.content);
      expect(content).toContain('blue');
      expect(content).toContain('photography');
    });
  });

  describe('Reflection Triggering', () => {
    it('should trigger reflection when observations exceed threshold after agent.generate', async () => {
      const threadId = 'reflection-trigger-thread';

      // Pre-populate with large observations
      await storage.stores!.memory.saveObservations({
        observations: [
          {
            id: 'large-obs',
            threadId,
            resourceId,
            observation: 'A'.repeat(1000), // Large observation
            observedMessageIds: ['old-msg-1'],
            bufferedMessageIds: [],
            bufferingMessageIds: [],
            originType: 'initial',
            totalTokensObserved: 250,
            observationTokenCount: 250,
            isReflecting: false,
            metadata: { reflectionCount: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 20, // Low threshold to trigger observation
        },
        reflector: {
          observationThreshold: 50, // Low threshold to trigger reflection
        },
        debug: true,
      });

      // Mock both agents
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockResolvedValue({
          text: '- New observation from latest conversation',
        }),
      };
      (observationalMemory as any).reflectorAgent = {
        generate: vi.fn().mockResolvedValue({
          text: '- Condensed summary of all observations',
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'reflection-agent',
        name: 'Reflection Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Generate to trigger observation + reflection
      await agent.generate('This is a new message that should trigger both observation and reflection.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Verify reflector was called
      expect((observationalMemory as any).reflectorAgent.generate).toHaveBeenCalled();

      // Check that a reflection generation was created
      const observations = await storage.stores!.memory.listObservations({ threadId });
      const latestObs = observations[observations.length - 1];

      expect(latestObs.originType).toBe('reflection');
      expect(latestObs.previousGenerationId).toBe('large-obs');
      expect(latestObs.observation).toContain('Condensed');
    });
  });

  describe('Storage Operations with Agent Flow', () => {
    it('should persist observations to LibSQL after agent.generate', async () => {
      const threadId = 'persist-test-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 20,
        },
        debug: true,
      });

      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockResolvedValue({
          text: '- User asked for help\n- Topic: general greeting',
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'persist-agent',
        name: 'Persist Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      await agent.generate('Hello, I need help with something important today.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Query storage directly to verify persistence
      const observations = await storage.stores!.memory.listObservations({ threadId });

      expect(observations).toHaveLength(1);
      expect(observations[0].threadId).toBe(threadId);
      expect(observations[0].observation).toContain('User asked for help');
      expect(observations[0].observedMessageIds.length).toBeGreaterThan(0);
      expect(observations[0].createdAt).toBeInstanceOf(Date);
      expect(observations[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should correctly isolate observations between different threads', async () => {
      const threadId1 = 'thread-isolation-1';
      const threadId2 = 'thread-isolation-2';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 20,
        },
        debug: false,
      });

      let callCount = 0;
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            text: `- Observation for thread call ${callCount}`,
          });
        }),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'isolation-agent',
        name: 'Isolation Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Generate in thread 1
      await agent.generate('Message for thread 1 with enough content to trigger.', {
        threadId: threadId1,
        resourceId,
        maxSteps: 1,
      });

      // Generate in thread 2
      await agent.generate('Message for thread 2 with enough content to trigger.', {
        threadId: threadId2,
        resourceId,
        maxSteps: 1,
      });

      // Check observations are isolated
      const obs1 = await storage.stores!.memory.listObservations({ threadId: threadId1 });
      const obs2 = await storage.stores!.memory.listObservations({ threadId: threadId2 });

      expect(obs1.length).toBeGreaterThan(0);
      expect(obs2.length).toBeGreaterThan(0);

      // Each thread should have its own observation
      expect(obs1[0].threadId).toBe(threadId1);
      expect(obs2[0].threadId).toBe(threadId2);
    });
  });

  describe('Error Handling in Agent Flow', () => {
    it('should handle observer agent errors gracefully and not break agent.generate', async () => {
      const threadId = 'error-handling-thread';

      const observationalMemory = new ObservationalMemory({
        storage,
        observer: {
          historyThreshold: 20,
        },
        debug: false,
      });

      // Mock observer to throw an error
      (observationalMemory as any).observerAgent = {
        generate: vi.fn().mockRejectedValue(new Error('Model API error')),
      };

      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
        },
      });

      const agent = new Agent({
        id: 'error-agent',
        name: 'Error Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
        memory,
        inputProcessors: [observationalMemory],
        outputProcessors: [observationalMemory],
      });

      // Should not throw - agent.generate should complete successfully
      const response = await agent.generate('This message should still work even if observer fails.', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      // Agent should still produce a response
      expect(response.text).toBeDefined();
    });
  });
});
