import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { buildObserverUserPrompt, OBSERVER_INSTRUCTIONS } from './observer-agent';
import { ObservationalMemory } from './processor';
import { buildReflectorUserPrompt, REFLECTOR_INSTRUCTIONS } from './reflector-agent';
import { estimateTokenCount, compressObservationTokens, getMessageTextContent } from './utils';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock storage with in-memory observations
 */
function createMockStorage(): MastraStorage & { _observations: Map<string, any> } {
  const observations = new Map<string, any>();

  const store = new InMemoryStore({ id: 'test-storage' }) as MastraStorage & { _observations: Map<string, any> };

  // Add observations map for test inspection
  store._observations = observations;

  // Override the memory store methods
  if (!store.stores) throw new Error(`store.stores must exist for this test to work`);
  store.stores = {
    ...store.stores,
    memory: {
      ...store.stores?.memory,
      listObservations: vi.fn(async ({ threadId }: { threadId: string }) => {
        return Array.from(observations.values()).filter((o: any) => o.threadId === threadId);
      }),
      saveObservations: vi.fn(async ({ observations: obs }: { observations: any[] }) => {
        for (const o of obs) {
          observations.set(o.id, o);
        }
      }),
    } as any,
  };

  return store;
}

/**
 * Create a test message
 */
function createMessage(role: 'user' | 'assistant' | 'system', content: string, id?: string): MastraDBMessage {
  return {
    id: id || crypto.randomUUID(),
    role,
    content: {
      format: 2,
      content,
      parts: [{ type: 'text', text: content }],
    },
    type: 'text',
    createdAt: new Date(),
    threadId: 'test-thread',
  };
}

/**
 * Create a MessageList with messages
 */
function createMessageList(messages: MastraDBMessage[]): MessageList {
  const list = new MessageList({
    threadId: 'test-thread',
    resourceId: 'test-resource',
  });
  list.add(messages, 'memory');
  return list;
}

/**
 * Generate text of approximately N tokens
 */
function generateTokenText(tokenCount: number): string {
  // ~4 chars per token
  const chars = tokenCount * 4;
  return 'x'.repeat(chars);
}

/**
 * Create a mock request context with memory info
 */
function createRequestContext(threadId: string, resourceId: string) {
  return {
    get: (key: string) => {
      if (key === 'MastraMemory') {
        return {
          thread: { id: threadId },
          resourceId,
        };
      }
      return undefined;
    },
  } as any;
}

/**
 * Create a mock abort function for processor args
 */
function createAbort(): (reason?: string) => never {
  return (reason?: string) => {
    throw new Error(reason || 'Aborted');
  };
}

/**
 * Create ProcessInputArgs for testing
 */
function createProcessInputArgs(messageList: MessageList, requestContext?: any): ProcessInputArgs {
  return {
    messageList,
    messages: messageList.get.all.db(),
    systemMessages: [],
    abort: createAbort(),
    requestContext,
  };
}

/**
 * Create ProcessOutputResultArgs for testing
 */
function createProcessOutputResultArgs(
  messages: MastraDBMessage[],
  messageList: MessageList,
  requestContext?: any,
): ProcessOutputResultArgs {
  return {
    messages,
    messageList,
    abort: createAbort(),
    requestContext,
  };
}

// ============================================================================
// Unit Tests: Token Utilities
// ============================================================================

describe('Token Utilities', () => {
  describe('estimateTokenCount', () => {
    it('should estimate tokens based on character count', () => {
      // 4 chars per token
      expect(estimateTokenCount('1234')).toBe(1);
      expect(estimateTokenCount('12345678')).toBe(2);
      expect(estimateTokenCount('123456789012')).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should round up partial tokens', () => {
      expect(estimateTokenCount('12345')).toBe(2); // 5 chars = ceil(5/4) = 2
    });
  });

  describe('compressObservationTokens', () => {
    it('should remove low priority emojis but keep high priority', () => {
      const text = '🔴 Important\n🟡 Medium\n🟢 Low';
      const compressed = compressObservationTokens(text);

      expect(compressed).toContain('🔴');
      expect(compressed).not.toContain('🟡');
      expect(compressed).not.toContain('🟢');
    });

    it('should remove tags in brackets', () => {
      const text = '- Item [tag1, tag2] description';
      const compressed = compressObservationTokens(text);

      expect(compressed).not.toContain('[tag1, tag2]');
      expect(compressed).toContain('Item');
      expect(compressed).toContain('description');
    });

    it('should preserve collapsed section markers', () => {
      const text = '- [72 items collapsed - ID: b1fa] Previous items';
      const compressed = compressObservationTokens(text);

      expect(compressed).toContain('[72 items collapsed - ID: b1fa]');
    });

    it('should remove arrow indicators', () => {
      const text = '  - -> Sub item';
      const compressed = compressObservationTokens(text);

      expect(compressed).not.toContain('->');
      expect(compressed).toContain('Sub item');
    });

    it('should normalize whitespace', () => {
      const text = 'Line 1\n\n\nLine 2   with   spaces';
      const compressed = compressObservationTokens(text);

      expect(compressed).toBe('Line 1\nLine 2 with spaces');
    });

    it('should allow selective compression options', () => {
      const text = '🟡 Item [tag] -> sub';

      // Keep priorities
      const keepPriorities = compressObservationTokens(text, { removePriorities: false });
      expect(keepPriorities).toContain('🟡');

      // Keep tags
      const keepTags = compressObservationTokens(text, { removeTags: false });
      expect(keepTags).toContain('[tag]');

      // Keep arrows
      const keepArrows = compressObservationTokens(text, { removeArrows: false });
      expect(keepArrows).toContain('->');
    });
  });

  describe('getMessageTextContent', () => {
    it('should extract content from string content', () => {
      const msg = { content: 'Hello world' } as any;
      expect(getMessageTextContent(msg)).toBe('Hello world');
    });

    it('should extract content from V2 format', () => {
      const msg = {
        content: {
          format: 2,
          content: 'Hello world',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
      } as any;
      expect(getMessageTextContent(msg)).toBe('Hello world');
    });

    it('should stringify complex content', () => {
      const msg = {
        content: {
          format: 2,
          parts: [{ type: 'tool-call', toolName: 'search' }],
        },
      } as any;
      const result = getMessageTextContent(msg);
      expect(result).toContain('tool-call');
    });
  });
});

// ============================================================================
// Unit Tests: Observer Agent Prompts
// ============================================================================

describe('Observer Agent', () => {
  describe('buildObserverUserPrompt', () => {
    it('should include existing observations when provided', () => {
      const exchange = {
        relevantMessages: [createMessage('user', 'Hello')],
        timestamp: new Date(),
      };
      const existingObservations = '- 🔴 User greeted the assistant';

      const prompt = buildObserverUserPrompt(exchange, existingObservations);

      expect(prompt).toContain('Existing observations');
      expect(prompt).toContain(existingObservations);
      expect(prompt).toContain('Do not repeat these existing observations');
    });

    it('should handle user-only messages', () => {
      const exchange = {
        relevantMessages: [createMessage('user', 'Hello')],
        timestamp: new Date(),
      };

      const prompt = buildObserverUserPrompt(exchange, '');

      expect(prompt).toContain('user messages');
      expect(prompt).toContain('no assistant messages are present');
    });

    it('should handle assistant-only messages', () => {
      const exchange = {
        relevantMessages: [createMessage('assistant', 'Hello back')],
        timestamp: new Date(),
      };

      const prompt = buildObserverUserPrompt(exchange, '');

      expect(prompt).toContain('assistant messages');
      expect(prompt).toContain('no user messages are present');
    });

    it('should handle mixed messages', () => {
      const exchange = {
        relevantMessages: [createMessage('user', 'Hello'), createMessage('assistant', 'Hello back')],
        timestamp: new Date(),
      };

      const prompt = buildObserverUserPrompt(exchange, '');

      expect(prompt).toContain('conversational exchange');
      expect(prompt).toContain('user message AND the assistant response');
    });

    it('should highlight the most recent user message', () => {
      const exchange = {
        relevantMessages: [
          createMessage('user', 'First message'),
          createMessage('assistant', 'Response'),
          createMessage('user', 'Most recent message'),
        ],
        timestamp: new Date(),
      };

      const prompt = buildObserverUserPrompt(exchange, '');

      expect(prompt).toContain('most recent user message is always important');
      expect(prompt).toContain('Most recent message');
    });

    it('should include MESSAGE_HISTORY with encoded messages', () => {
      const exchange = {
        relevantMessages: [createMessage('user', 'Test content')],
        timestamp: new Date(),
      };

      const prompt = buildObserverUserPrompt(exchange, '');

      expect(prompt).toContain('MESSAGE_HISTORY:');
    });
  });

  describe('OBSERVER_INSTRUCTIONS', () => {
    it('should include priority emoji guidance', () => {
      expect(OBSERVER_INSTRUCTIONS).toContain('🔴');
      expect(OBSERVER_INSTRUCTIONS).toContain('🟡');
      expect(OBSERVER_INSTRUCTIONS).toContain('🟢');
    });

    it('should include guidance on observation format', () => {
      expect(OBSERVER_INSTRUCTIONS).toContain('markdown list');
      expect(OBSERVER_INSTRUCTIONS).toContain('labels');
    });

    it('should emphasize observations are the only memory', () => {
      expect(OBSERVER_INSTRUCTIONS).toContain('ONLY information the assistant has');
      expect(OBSERVER_INSTRUCTIONS).toContain('ONLY memory');
    });

    it('should include guidance on current task tracking', () => {
      expect(OBSERVER_INSTRUCTIONS).toContain('current task');
      expect(OBSERVER_INSTRUCTIONS).toContain('next steps');
    });
  });
});

// ============================================================================
// Unit Tests: Reflector Agent Prompts
// ============================================================================

describe('Reflector Agent', () => {
  describe('buildReflectorUserPrompt', () => {
    it('should include existing observations', () => {
      const observations = '- 🔴 User preference\n- 🟡 Project context';

      const prompt = buildReflectorUserPrompt(observations);

      expect(prompt).toContain(observations);
      expect(prompt).toContain('Reflect on the existing observations');
    });

    it('should emphasize not losing information', () => {
      const prompt = buildReflectorUserPrompt('test');

      expect(prompt).toContain('ENTIRE memory');
      expect(prompt).toContain("don't lose any key important details");
    });

    it('should guide on combining similar items', () => {
      const prompt = buildReflectorUserPrompt('test');

      expect(prompt).toContain('combine');
      expect(prompt).toContain('single reflected observation');
    });
  });

  describe('REFLECTOR_INSTRUCTIONS', () => {
    it('should include the observer instructions context', () => {
      expect(REFLECTOR_INSTRUCTIONS).toContain('observational-memory-instruction');
    });

    it('should emphasize being a broader aspect of the psyche', () => {
      expect(REFLECTOR_INSTRUCTIONS).toContain('broader aspect of the psyche');
      expect(REFLECTOR_INSTRUCTIONS).toContain('off track');
    });

    it('should emphasize reflections are the entire memory', () => {
      expect(REFLECTOR_INSTRUCTIONS).toContain('THE ENTIRETY of the assistants memory');
    });
  });
});

// ============================================================================
// Unit Tests: ObservationalMemory Processor Configuration
// ============================================================================

describe('ObservationalMemory Configuration', () => {
  it('should use default thresholds when not specified', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({ storage });

    // Access private properties for testing
    expect((processor as any).historyThreshold).toBe(10_000);
    expect((processor as any).observationThreshold).toBeUndefined();
  });

  it('should use custom thresholds when specified', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: {
        historyThreshold: 5_000,
      },
      reflector: {
        observationThreshold: 20_000,
      },
    });

    expect((processor as any).historyThreshold).toBe(5_000);
    expect((processor as any).observationThreshold).toBe(20_000);
  });

  it('should support dynamic threshold ranges', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: {
        historyThreshold: { min: 5_000, max: 15_000 },
      },
    });

    expect((processor as any).historyThreshold).toEqual({ min: 5_000, max: 15_000 });
  });

  it('should default to thread scope', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({ storage });

    expect((processor as any).scope).toBe('thread');
  });

  it('should support resource scope', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      scope: 'resource',
    });

    expect((processor as any).scope).toBe('resource');
  });

  it('should create observer agent', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({ storage });

    expect((processor as any).observerAgent).toBeDefined();
  });

  it('should create reflector agent only when configured', () => {
    const storage = createMockStorage();

    const withoutReflector = new ObservationalMemory({ storage });
    expect((withoutReflector as any).reflectorAgent).toBeUndefined();

    const withReflector = new ObservationalMemory({
      storage,
      reflector: {},
    });
    expect((withReflector as any).reflectorAgent).toBeDefined();
  });
});

// ============================================================================
// Unit Tests: Dynamic Threshold Calculation
// ============================================================================

describe('Dynamic Threshold Calculation', () => {
  it('should return fixed threshold when configured as number', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10_000 },
    });

    const threshold = (processor as any).getCurrentHistoryThreshold(0);
    expect(threshold).toBe(10_000);

    const thresholdWithObservations = (processor as any).getCurrentHistoryThreshold(20_000);
    expect(thresholdWithObservations).toBe(10_000);
  });

  it('should use max threshold when observations are empty', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: { min: 5_000, max: 15_000 } },
      reflector: { observationThreshold: 30_000 },
    });

    const threshold = (processor as any).getCurrentHistoryThreshold(0);
    expect(threshold).toBe(15_000);
  });

  it('should use min threshold when observations are full', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: { min: 5_000, max: 15_000 } },
      reflector: { observationThreshold: 30_000 },
    });

    const threshold = (processor as any).getCurrentHistoryThreshold(30_000);
    expect(threshold).toBe(5_000);
  });

  it('should interpolate threshold based on observation fullness', () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: { min: 5_000, max: 15_000 } },
      reflector: { observationThreshold: 30_000 },
    });

    // 50% full -> halfway between min and max
    const threshold = (processor as any).getCurrentHistoryThreshold(15_000);
    expect(threshold).toBe(10_000);
  });
});

// ============================================================================
// Integration Tests: Storage Operations
// ============================================================================

describe('Storage Operations', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let processor: ObservationalMemory;

  beforeEach(() => {
    storage = createMockStorage();
    processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 100 }, // Low threshold for testing
    });
  });

  describe('getOrCreateMemoryRecord', () => {
    it('should return null when no observations exist', async () => {
      const record = await (processor as any).getOrCreateMemoryRecord('test-thread', 'test-resource');
      expect(record).toBeNull();
    });

    it('should return existing record when observations exist', async () => {
      // Add an observation directly to storage
      storage._observations.set('obs-1', {
        id: 'obs-1',
        threadId: 'test-thread',
        resourceId: 'test-resource',
        observation: '- 🔴 Test observation',
        observedMessageIds: ['msg-1'],
        originType: 'initial',
        totalTokensObserved: 100,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          reflectionCount: 0,
        },
      });

      const record = await (processor as any).getOrCreateMemoryRecord('test-thread', 'test-resource');

      expect(record).not.toBeNull();
      expect(record?.id).toBe('obs-1');
      expect(record?.activeObservations).toBe('- 🔴 Test observation');
      expect(record?.observedMessageIds).toContain('msg-1');
    });

    it('should use thread scope by default', async () => {
      storage._observations.set('obs-1', {
        id: 'obs-1',
        threadId: 'thread-1',
        observation: 'test',
      });
      storage._observations.set('obs-2', {
        id: 'obs-2',
        threadId: 'thread-2',
        observation: 'other',
      });

      const record = await (processor as any).getOrCreateMemoryRecord('thread-1', 'resource-1');

      expect(record?.id).toBe('obs-1');
    });

    it('should use resource scope when configured', async () => {
      const resourceProcessor = new ObservationalMemory({
        storage,
        scope: 'resource',
      });

      storage._observations.set('obs-1', {
        id: 'obs-1',
        threadId: 'resource-1',
        observation: 'resource scoped',
      });

      const record = await (resourceProcessor as any).getOrCreateMemoryRecord('thread-1', 'resource-1');

      expect(record?.id).toBe('obs-1');
    });
  });
});

// ============================================================================
// Integration Tests: ProcessInput
// ============================================================================

describe('processInput', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let processor: ObservationalMemory;

  beforeEach(() => {
    storage = createMockStorage();
    processor = new ObservationalMemory({
      storage,
      debug: false,
    });
  });

  it('should return messageList unchanged when no memory context', async () => {
    const messages = [createMessage('user', 'Hello')];
    const messageList = createMessageList(messages);

    const result = await processor.processInput(createProcessInputArgs(messageList, undefined));

    expect(result).toBe(messageList);
  });

  it('should inject observations as system message when they exist', async () => {
    // Add existing observations
    storage._observations.set('obs-1', {
      id: 'obs-1',
      threadId: 'test-thread',
      observation: '- 🔴 User lives in California',
      observedMessageIds: [],
      bufferedMessageIds: [],
      bufferingMessageIds: [],
    });

    // Create processor with debug enabled to see what's happening
    const debugProcessor = new ObservationalMemory({
      storage,
      debug: true,
    });

    const messages = [createMessage('user', 'What is my location?')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await debugProcessor.processInput(createProcessInputArgs(messageList, requestContext));

    // Check the AIV5 prompt format which includes system messages
    const aiPrompt = messageList.get.all.aiV5.prompt();
    const aiSystemMessages = aiPrompt.filter(m => m.role === 'system');

    expect(aiSystemMessages.length).toBeGreaterThan(0);
    expect(
      aiSystemMessages.some(m => {
        const content = typeof m.content === 'string' ? m.content : '';
        return content.includes('observational_memory');
      }),
    ).toBe(true);
  });

  it('should compress observations before injecting', async () => {
    storage._observations.set('obs-1', {
      id: 'obs-1',
      threadId: 'test-thread',
      observation: '- 🔴 Important [critical]\n- 🟡 Medium [tag]\n- 🟢 Low [minor]',
      observedMessageIds: [],
      bufferedMessageIds: [],
      bufferingMessageIds: [],
    });

    const messageList = createMessageList([createMessage('user', 'Test')]);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processInput(createProcessInputArgs(messageList, requestContext));

    // Use aiV5.prompt() to get system messages
    const aiPrompt = messageList.get.all.aiV5.prompt();
    const systemMessage = aiPrompt.find(
      m => m.role === 'system' && typeof m.content === 'string' && m.content.includes('observational_memory'),
    );

    // Should contain high priority but not low priority emoji
    expect(systemMessage).toBeDefined();
    const content = typeof systemMessage?.content === 'string' ? systemMessage.content : '';
    expect(content).toContain('🔴');
    expect(content).not.toContain('🟡');
    expect(content).not.toContain('🟢');
  });
});

// ============================================================================
// Integration Tests: ProcessOutputResult
// ============================================================================

describe('processOutputResult', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('should not trigger observation when below threshold', async () => {
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10_000 }, // High threshold
    });

    const messages = [createMessage('user', 'Short message'), createMessage('assistant', 'Short response')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Should not have saved any observations
    expect(storage._observations.size).toBe(0);
  });

  it('should track message IDs that have been observed', async () => {
    // Create a mock observer agent that returns immediately
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 }, // Very low threshold
    });

    // Mock the observer agent
    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({
        text: '- 🔴 User said something',
      }),
    };

    const messages = [
      createMessage('user', generateTokenText(50), 'msg-1'),
      createMessage('assistant', generateTokenText(50), 'msg-2'),
    ];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Check that observation was saved with message IDs
    expect(storage._observations.size).toBe(1);
    const savedObs = Array.from(storage._observations.values())[0];
    expect(savedObs.observedMessageIds).toContain('msg-1');
    expect(savedObs.observedMessageIds).toContain('msg-2');
  });

  it('should append to existing observations', async () => {
    // Add existing observation
    storage._observations.set('obs-1', {
      id: 'obs-1',
      threadId: 'test-thread',
      observation: '- 🔴 Previous observation',
      observedMessageIds: ['old-msg'],
      bufferedMessageIds: [],
      bufferingMessageIds: [],
      totalTokensObserved: 100,
      metadata: { createdAt: new Date(), updatedAt: new Date(), reflectionCount: 0 },
    });

    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({
        text: '- 🔴 New observation',
      }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'new-msg')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Should have updated the observation
    const savedObs = storage._observations.get('obs-1');
    expect(savedObs.observation).toContain('Previous observation');
    expect(savedObs.observation).toContain('New observation');
    expect(savedObs.observedMessageIds).toContain('old-msg');
    expect(savedObs.observedMessageIds).toContain('new-msg');
  });
});

// ============================================================================
// Integration Tests: Reflection Triggering
// ============================================================================

describe('Reflection Triggering', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('should trigger reflection when observations exceed threshold', async () => {
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
      reflector: { observationThreshold: 100 }, // Low threshold for testing
    });

    // Mock both agents
    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({
        text: generateTokenText(150), // More than reflection threshold
      }),
    };
    (processor as any).reflectorAgent = {
      generate: vi.fn().mockResolvedValue({
        text: '- 🔴 Condensed observations',
      }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'msg-1')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Reflector should have been called
    expect((processor as any).reflectorAgent.generate).toHaveBeenCalled();

    // Saved observation should be the reflected version
    const savedObs = Array.from(storage._observations.values())[0];
    expect(savedObs.observation).toBe('- 🔴 Condensed observations');
    expect(savedObs.originType).toBe('reflection');
    expect(savedObs.metadata.reflectionCount).toBe(1);
  });

  it('should not trigger reflection when below threshold', async () => {
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
      reflector: { observationThreshold: 10_000 }, // High threshold
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({
        text: '- 🔴 Small observation',
      }),
    };
    (processor as any).reflectorAgent = {
      generate: vi.fn(),
    };

    const messages = [createMessage('user', generateTokenText(50), 'msg-1')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Reflector should NOT have been called
    expect((processor as any).reflectorAgent.generate).not.toHaveBeenCalled();

    // Origin type should be initial
    const savedObs = Array.from(storage._observations.values())[0];
    expect(savedObs.originType).toBe('initial');
  });

  it('should create new generation on reflection', async () => {
    // Add existing observation
    storage._observations.set('obs-1', {
      id: 'obs-1',
      threadId: 'test-thread',
      observation: generateTokenText(200),
      observedMessageIds: ['old-msg'],
      bufferedMessageIds: [],
      bufferingMessageIds: [],
      originType: 'initial',
      totalTokensObserved: 800,
      metadata: { createdAt: new Date(), updatedAt: new Date(), reflectionCount: 0 },
    });

    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
      reflector: { observationThreshold: 100 },
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({
        text: generateTokenText(100),
      }),
    };
    (processor as any).reflectorAgent = {
      generate: vi.fn().mockResolvedValue({
        text: '- 🔴 Reflected observations',
      }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'new-msg')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Should have created a new record with previousGenerationId
    expect(storage._observations.size).toBe(2);
    const newObs = Array.from(storage._observations.values()).find(o => o.id !== 'obs-1');
    expect(newObs).toBeDefined();
    expect(newObs?.previousGenerationId).toBe('obs-1');
    expect(newObs?.originType).toBe('reflection');
    expect(newObs?.metadata.reflectionCount).toBe(1);
  });
});

// ============================================================================
// Integration Tests: Message State Tracking
// ============================================================================

describe('Message State Tracking', () => {
  it('should exclude observed messages from unobserved count', async () => {
    const storage = createMockStorage();

    // Add observation with some messages already observed
    storage._observations.set('obs-1', {
      id: 'obs-1',
      threadId: 'test-thread',
      observation: '- 🔴 Previous',
      observedMessageIds: ['msg-1', 'msg-2'],
      bufferedMessageIds: [],
      bufferingMessageIds: [],
      totalTokensObserved: 100,
      metadata: { createdAt: new Date(), updatedAt: new Date(), reflectionCount: 0 },
    });

    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 1000 }, // High threshold
    });

    (processor as any).observerAgent = {
      generate: vi.fn(),
    };

    // Include already observed messages plus one new one
    const messages = [
      createMessage('user', generateTokenText(100), 'msg-1'),
      createMessage('assistant', generateTokenText(100), 'msg-2'),
      createMessage('user', 'New short message', 'msg-3'),
    ];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(createProcessOutputResultArgs(messages, messageList, requestContext));

    // Should NOT have triggered observation because only msg-3 is unobserved
    // and it's below the threshold
    expect((processor as any).observerAgent.generate).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Integration Tests: Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('should handle storage errors gracefully in processInput', async () => {
    const storage = createMockStorage();
    storage.stores!.memory.listObservations = vi.fn().mockRejectedValue(new Error('Storage error'));

    const processor = new ObservationalMemory({
      storage,
      debug: false,
    });

    const messageList = createMessageList([createMessage('user', 'Test')]);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    // Should not throw
    const result = await processor.processInput(
      createProcessInputArgs(messageList, requestContext)
    );
    expect(result).toBe(messageList);
  });

  it('should handle storage errors gracefully in processOutputResult', async () => {
    const storage = createMockStorage();
    storage.stores!.memory.listObservations = vi.fn().mockRejectedValue(new Error('Storage error'));

    const processor = new ObservationalMemory({
      storage,
      debug: false,
    });

    const messages = [createMessage('user', 'Test')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    // Should not throw
    const result = await processor.processOutputResult(
      createProcessOutputResultArgs(messages, messageList, requestContext)
    );
    expect(result).toBe(messageList);
  });

  it('should handle observer agent errors gracefully', async () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
      debug: false,
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockRejectedValue(new Error('Model error')),
    };

    const messages = [createMessage('user', generateTokenText(50))];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    // Should not throw
    const result = await processor.processOutputResult(
      createProcessOutputResultArgs(messages, messageList, requestContext)
    );
    expect(result).toBe(messageList);
  });
});

// ============================================================================
// Integration Tests: Scope Behavior
// ============================================================================

describe('Scope Behavior', () => {
  it('should scope observations to thread by default', async () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({ text: '- 🔴 Thread observation' }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'msg-1')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('thread-1', 'resource-1');

    await processor.processOutputResult(
      createProcessOutputResultArgs(messages, messageList, requestContext)
    );

    const savedObs = Array.from(storage._observations.values())[0];
    expect(savedObs.threadId).toBe('thread-1');
  });

  it('should scope observations to resource when configured', async () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      scope: 'resource',
      observer: { historyThreshold: 10 },
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({ text: '- 🔴 Resource observation' }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'msg-1')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('thread-1', 'resource-1');

    await processor.processOutputResult(
      createProcessOutputResultArgs(messages, messageList, requestContext)
    );

    const savedObs = Array.from(storage._observations.values())[0];
    // For resource scope, threadId in storage should be the resourceId
    expect(savedObs.threadId).toBe('resource-1');
  });
});

// ============================================================================
// Integration Tests: ObservationalMemoryRecord Structure
// ============================================================================

describe('ObservationalMemoryRecord Structure', () => {
  it('should save all required fields to storage', async () => {
    const storage = createMockStorage();
    const processor = new ObservationalMemory({
      storage,
      observer: { historyThreshold: 10 },
    });

    (processor as any).observerAgent = {
      generate: vi.fn().mockResolvedValue({ text: '- 🔴 Test observation' }),
    };

    const messages = [createMessage('user', generateTokenText(50), 'msg-1')];
    const messageList = createMessageList(messages);
    const requestContext = createRequestContext('test-thread', 'test-resource');

    await processor.processOutputResult(
      createProcessOutputResultArgs(messages, messageList, requestContext)
    );

    const savedObs = Array.from(storage._observations.values())[0];

    // Verify all required fields are present
    expect(savedObs.id).toBeDefined();
    expect(savedObs.threadId).toBe('test-thread');
    expect(savedObs.resourceId).toBe('test-resource');
    expect(savedObs.observation).toBe('- 🔴 Test observation');
    expect(savedObs.observedMessageIds).toContain('msg-1');
    expect(savedObs.bufferedMessageIds).toEqual([]);
    expect(savedObs.bufferingMessageIds).toEqual([]);
    expect(savedObs.originType).toBe('initial');
    expect(savedObs.totalTokensObserved).toBeGreaterThan(0);
    expect(savedObs.observationTokenCount).toBeGreaterThan(0);
    expect(savedObs.isReflecting).toBe(false);
    expect(savedObs.metadata).toBeDefined();
    expect(savedObs.metadata.createdAt).toBeInstanceOf(Date);
    expect(savedObs.metadata.updatedAt).toBeInstanceOf(Date);
    expect(savedObs.metadata.reflectionCount).toBe(0);
  });
});
