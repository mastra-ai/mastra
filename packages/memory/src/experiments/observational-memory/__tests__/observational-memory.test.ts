import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { ObservationalMemory } from '../observational-memory';
import {
  buildObserverPrompt,
  parseObserverOutput,
  optimizeObservationsForContext,
  formatMessagesForObserver,
} from '../observer-agent';
import { buildReflectorPrompt, parseReflectorOutput, validateCompression } from '../reflector-agent';
import { TokenCounter } from '../token-counter';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestMessage(content: string, role: 'user' | 'assistant' = 'user', id?: string): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };

  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: messageContent,
    type: 'text',
    createdAt: new Date(),
  };
}

function createTestMessages(count: number, baseContent = 'Test message'): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(`${baseContent} ${i + 1}`, i % 2 === 0 ? 'user' : 'assistant', `msg-${i}`),
  );
}

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({
    collection: {
      threads: new Map(),
      resources: new Map(),
      messages: new Map(),
      observationalMemory: new Map(),
    },
    operations: {} as any, // Not needed for OM tests
  });
}

// =============================================================================
// Unit Tests: Storage Operations
// =============================================================================

describe('Storage Operations', () => {
  let storage: InMemoryMemory;
  const threadId = 'test-thread';
  const resourceId = 'test-resource';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('initializeObservationalMemory', () => {
    it('should create a new record with empty observations', async () => {
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {
          observer: { historyThreshold: 10000, model: 'test-model' },
          reflector: { observationThreshold: 20000, model: 'test-model' },
        },
      });

      expect(record).toBeDefined();
      expect(record.threadId).toBe(threadId);
      expect(record.resourceId).toBe(resourceId);
      expect(record.scope).toBe('thread');
      expect(record.activeObservations).toBe('');
      expect(record.observedMessageIds).toEqual([]);
      expect(record.bufferedMessageIds).toEqual([]);
      expect(record.isObserving).toBe(false);
      expect(record.isReflecting).toBe(false);
    });

    it('should create record with null threadId for resource scope', async () => {
      const record = await storage.initializeObservationalMemory({
        threadId: null,
        resourceId,
        scope: 'resource',
        config: {},
      });

      expect(record.threadId).toBeNull();
      expect(record.scope).toBe('resource');
    });
  });

  describe('getObservationalMemory', () => {
    it('should return null for non-existent record', async () => {
      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeNull();
    });

    it('should return existing record', async () => {
      await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeDefined();
      expect(record?.threadId).toBe(threadId);
    });

    it('should return latest generation (most recent record)', async () => {
      // Create initial record
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Update with observations
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Test observation',
        messageIds: ['msg-1'],
        tokenCount: 100,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBe('- 🔴 Test observation');
    });
  });

  describe('markMessagesAsBuffering', () => {
    it('should add message IDs to bufferingMessageIds', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.markMessagesAsBuffering(initial.id, ['msg-1', 'msg-2']);

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferingMessageIds).toEqual(['msg-1', 'msg-2']);
    });

    it('should append to existing bufferingMessageIds', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.markMessagesAsBuffering(initial.id, ['msg-1']);
      await storage.markMessagesAsBuffering(initial.id, ['msg-2']);

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferingMessageIds).toEqual(['msg-1', 'msg-2']);
    });
  });

  describe('updateBufferedObservations', () => {
    it('should store observations and track buffered message IDs', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        observations: '- 🔴 Buffered observation',
        messageIds: ['msg-1', 'msg-2'],
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservations).toBe('- 🔴 Buffered observation');
      expect(record?.bufferedMessageIds).toEqual(['msg-1', 'msg-2']);
    });

    it('should append to existing buffered message IDs', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        observations: '- 🔴 First buffered',
        messageIds: ['msg-1'],
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        observations: '- 🔴 Second buffered',
        messageIds: ['msg-2'],
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservations).toBe('- 🔴 Second buffered');
      expect(record?.bufferedMessageIds).toContain('msg-1');
      expect(record?.bufferedMessageIds).toContain('msg-2');
    });
  });

  describe('swapBufferedToActive', () => {
    it('should append buffered to active and clear buffered', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Set initial active observations
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Active observation',
        messageIds: ['msg-0'],
        tokenCount: 50,
      });

      // Add buffered observations
      await storage.updateBufferedObservations({
        id: initial.id,
        observations: '- 🟡 Buffered observation',
        messageIds: ['msg-1', 'msg-2'],
      });

      await storage.swapBufferedToActive(initial.id);

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toContain('- 🔴 Active observation');
      expect(record?.activeObservations).toContain('- 🟡 Buffered observation');
      expect(record?.bufferedObservations).toBeUndefined();
      expect(record?.bufferedMessageIds).toEqual([]);
      expect(record?.observedMessageIds).toContain('msg-1');
      expect(record?.observedMessageIds).toContain('msg-2');
    });
  });

  describe('updateActiveObservations', () => {
    it('should update observations and track message IDs', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Test observation',
        messageIds: ['msg-1', 'msg-2'],
        tokenCount: 100,
        suggestedContinuation: 'Continue with...',
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBe('- 🔴 Test observation');
      expect(record?.observedMessageIds).toEqual(['msg-1', 'msg-2']);
      expect(record?.observationTokenCount).toBe(100);
      expect(record?.suggestedContinuation).toBe('Continue with...');
    });
  });

  describe('setObservingFlag / setReflectingFlag', () => {
    it('should set and clear observing flag', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.setObservingFlag(initial.id, true);
      let record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.isObserving).toBe(true);

      await storage.setObservingFlag(initial.id, false);
      record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.isObserving).toBe(false);
    });

    it('should set and clear reflecting flag', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.setReflectingFlag(initial.id, true);
      let record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.isReflecting).toBe(true);

      await storage.setReflectingFlag(initial.id, false);
      record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.isReflecting).toBe(false);
    });
  });

  describe('createReflectionGeneration', () => {
    it('should create new generation with reflection as active', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Original observations (very long...)',
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        tokenCount: 30000,
      });

      const currentRecord = await storage.getObservationalMemory(threadId, resourceId);

      const newRecord = await storage.createReflectionGeneration({
        currentRecord: currentRecord!,
        reflection: '- 🔴 Condensed reflection',
        tokenCount: 5000,
        suggestedContinuation: 'Continue by...',
      });

      expect(newRecord.activeObservations).toBe('- 🔴 Condensed reflection');
      expect(newRecord.observationTokenCount).toBe(5000);
      expect(newRecord.previousGenerationId).toBe(initial.id);
      expect(newRecord.originType).toBe('reflection');
      // Observed message IDs are preserved (for tracking purposes)
      expect(newRecord.observedMessageIds).toEqual(['msg-1', 'msg-2', 'msg-3']);
      // Buffered state is reset
      expect(newRecord.bufferedMessageIds).toEqual([]);
      expect(newRecord.bufferingMessageIds).toEqual([]);
    });
  });

  describe('getObservationalMemoryHistory', () => {
    it('should return all generations in order', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- Gen 1',
        messageIds: [],
        tokenCount: 100,
      });

      const gen1 = await storage.getObservationalMemory(threadId, resourceId);

      await storage.createReflectionGeneration({
        currentRecord: gen1!,
        reflection: '- Gen 2 (reflection)',
        tokenCount: 50,
      });

      const history = await storage.getObservationalMemoryHistory(threadId, resourceId);
      expect(history.length).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Create multiple generations
      let current = initial;
      for (let i = 0; i < 5; i++) {
        await storage.updateActiveObservations({
          id: current.id,
          observations: `- Gen ${i}`,
          messageIds: [],
          tokenCount: 100,
        });
        const record = await storage.getObservationalMemory(threadId, resourceId);
        if (i < 4) {
          current = await storage.createReflectionGeneration({
            currentRecord: record!,
            reflection: `- Reflection ${i}`,
            tokenCount: 50,
          });
        }
      }

      const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 2);
      expect(history.length).toBe(2);
    });
  });

  describe('clearObservationalMemory', () => {
    it('should remove all records for thread/resource', async () => {
      await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      let record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeDefined();

      await storage.clearObservationalMemory(threadId, resourceId);

      record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeNull();
    });
  });
});

// =============================================================================
// Unit Tests: Observer Agent Helpers
// =============================================================================

describe('Observer Agent Helpers', () => {
  describe('formatMessagesForObserver', () => {
    it('should format messages with role labels and content', () => {
      const messages = [createTestMessage('Hello', 'user'), createTestMessage('Hi there!', 'assistant')];

      const formatted = formatMessagesForObserver(messages);
      expect(formatted).toContain('**User');
      expect(formatted).toContain('Hello');
      expect(formatted).toContain('**Assistant');
      expect(formatted).toContain('Hi there!');
    });

    it('should include timestamps if present', () => {
      const msg = createTestMessage('Test', 'user');
      msg.createdAt = new Date('2024-12-04T10:30:00Z');

      const formatted = formatMessagesForObserver([msg]);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('Dec');
    });
  });

  describe('buildObserverPrompt', () => {
    it('should include new messages in prompt', () => {
      const messages = [createTestMessage('What is TypeScript?', 'user')];
      const prompt = buildObserverPrompt(undefined, messages);

      expect(prompt).toContain('New Message History');
      expect(prompt).toContain('What is TypeScript?');
    });

    it('should include existing observations if present', () => {
      const messages = [createTestMessage('Follow up question', 'user')];
      const existingObs = '- 🔴 User asked about TypeScript [topic_discussed]';

      const prompt = buildObserverPrompt(existingObs, messages);

      expect(prompt).toContain('Previous Observations');
      expect(prompt).toContain('User asked about TypeScript');
    });

    it('should not include existing observations section if none', () => {
      const messages = [createTestMessage('Hello', 'user')];
      const prompt = buildObserverPrompt(undefined, messages);

      expect(prompt).not.toContain('Previous Observations');
    });
  });

  describe('parseObserverOutput', () => {
    it('should extract observations from output', () => {
      const output = `
- 🔴 User asked about React [topic_discussed]
- 🟡 User prefers examples [user_preference]
      `;

      const result = parseObserverOutput(output);
      expect(result.observations).toContain('🔴 User asked about React');
      expect(result.observations).toContain('🟡 User prefers examples');
    });

    it('should extract continuation hint from cohesion phrases', () => {
      const output = `
- 🔴 User asked about React [topic_discussed]

The assistant can maintain cohesion by "Let me show you an example..."
      `;

      const result = parseObserverOutput(output);
      expect(result.suggestedContinuation).toContain('Let me show you an example');
    });

    it('should extract continuation hint from start reply phrase', () => {
      const output = `
- 🔴 Observation here

Start the next reply with: "Here's the implementation..."
      `;

      const result = parseObserverOutput(output);
      expect(result.suggestedContinuation).toBeDefined();
    });

    it('should handle output without continuation hint', () => {
      const output = '- 🔴 Simple observation';
      const result = parseObserverOutput(output);

      expect(result.observations).toBe('- 🔴 Simple observation');
      expect(result.suggestedContinuation).toBeUndefined();
    });
  });

  describe('optimizeObservationsForContext', () => {
    it('should strip yellow and green emojis', () => {
      const observations = `
- 🔴 Critical info
- 🟡 Medium info
- 🟢 Low info
      `;

      const optimized = optimizeObservationsForContext(observations);
      expect(optimized).toContain('🔴 Critical info');
      expect(optimized).not.toContain('🟡');
      expect(optimized).not.toContain('🟢');
    });

    it('should preserve red emojis', () => {
      const observations = '- 🔴 Critical user preference';
      const optimized = optimizeObservationsForContext(observations);
      expect(optimized).toContain('🔴');
    });

    it('should simplify arrows', () => {
      const observations = '- Task -> completed successfully';
      const optimized = optimizeObservationsForContext(observations);
      expect(optimized).not.toContain('->');
    });

    it('should collapse multiple newlines', () => {
      const observations = `Line 1



Line 2`;
      const optimized = optimizeObservationsForContext(observations);
      expect(optimized).not.toContain('\n\n\n');
    });
  });
});

// =============================================================================
// Unit Tests: Reflector Agent Helpers
// =============================================================================

describe('Reflector Agent Helpers', () => {
  describe('buildReflectorPrompt', () => {
    it('should include observations to reflect on', () => {
      const observations = '- 🔴 User is building a React app';
      const prompt = buildReflectorPrompt(observations);

      expect(prompt).toContain('OBSERVATIONS TO REFLECT ON');
      expect(prompt).toContain('User is building a React app');
    });

    it('should include manual prompt guidance if provided', () => {
      const observations = '- 🔴 Test';
      const manualPrompt = 'Focus on authentication implementation';

      const prompt = buildReflectorPrompt(observations, manualPrompt);
      expect(prompt).toContain('SPECIFIC GUIDANCE');
      expect(prompt).toContain('Focus on authentication implementation');
    });

    it('should include compression retry guidance when flagged', () => {
      const observations = '- 🔴 Test';
      const prompt = buildReflectorPrompt(observations, undefined, true);

      expect(prompt).toContain('COMPRESSION REQUIRED');
      expect(prompt).toContain('aggressive condensation');
    });
  });

  describe('parseReflectorOutput', () => {
    it('should extract observations from output', () => {
      const output = `
- 🔴 **Project Context** [current_project]
  - User is building a dashboard
- 🟡 **Progress** [task]
  - Completed auth implementation
      `;

      const result = parseReflectorOutput(output);
      expect(result.observations).toContain('Project Context');
      expect(result.observations).toContain('Completed auth implementation');
    });

    it('should extract continuation hint', () => {
      const output = `
- 🔴 Observations here

<continuation>
Start by implementing the chart component...
</continuation>
      `;

      const result = parseReflectorOutput(output);
      expect(result.suggestedContinuation).toContain('implementing the chart component');
    });
  });

  describe('validateCompression', () => {
    it('should return true when output is smaller', () => {
      expect(validateCompression(10000, 5000)).toBe(true);
    });

    it('should return false when output is same size', () => {
      expect(validateCompression(10000, 10000)).toBe(false);
    });

    it('should return false when output is larger', () => {
      expect(validateCompression(10000, 12000)).toBe(false);
    });

    it('should use threshold for validation', () => {
      // 8500 is 85% of 10000, so with default 0.9 threshold it should pass
      expect(validateCompression(10000, 8500)).toBe(true);
      // 9500 is > 90% so should fail
      expect(validateCompression(10000, 9500)).toBe(false);
    });

    it('should respect custom threshold', () => {
      // With 0.8 threshold, output must be < 80% of original
      expect(validateCompression(10000, 7500, 0.8)).toBe(true);
      expect(validateCompression(10000, 8500, 0.8)).toBe(false);
    });
  });
});

// =============================================================================
// Unit Tests: Token Counter
// =============================================================================

describe('Token Counter', () => {
  let counter: TokenCounter;

  beforeEach(() => {
    counter = new TokenCounter();
  });

  describe('countString', () => {
    it('should count tokens in a string', () => {
      const count = counter.countString('Hello, world!');
      expect(count).toBeGreaterThan(0);
    });

    it('should return 0 for empty string', () => {
      expect(counter.countString('')).toBe(0);
    });

    it('should count more tokens for longer strings', () => {
      const short = counter.countString('Hello');
      const long = counter.countString('Hello, this is a much longer string with many more words');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('countMessage', () => {
    it('should count tokens in a message', () => {
      const msg = createTestMessage('Hello, how can I help you today?');
      const count = counter.countMessage(msg);
      expect(count).toBeGreaterThan(0);
    });

    it('should include overhead for message structure', () => {
      const msg = createTestMessage('Hi');
      const stringCount = counter.countString('Hi');
      const msgCount = counter.countMessage(msg);
      // Message should have overhead beyond just the content
      expect(msgCount).toBeGreaterThan(stringCount);
    });
  });

  describe('countMessages', () => {
    it('should count tokens in multiple messages', () => {
      const messages = createTestMessages(5);
      const count = counter.countMessages(messages);
      expect(count).toBeGreaterThan(0);
    });

    it('should include conversation overhead', () => {
      const messages = createTestMessages(3);
      const individualSum = messages.reduce((sum, m) => sum + counter.countMessage(m), 0);
      const totalCount = counter.countMessages(messages);
      // Should have conversation overhead
      expect(totalCount).toBeGreaterThan(individualSum);
    });

    it('should return 0 for empty array', () => {
      expect(counter.countMessages([])).toBe(0);
    });
  });

  describe('countObservations', () => {
    it('should count tokens in observation string', () => {
      const observations = `
- 🔴 User is building a React app [current_project]
- 🟡 User prefers TypeScript [user_preference]
      `;
      const count = counter.countObservations(observations);
      expect(count).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Integration Tests: ObservationalMemory Class
// =============================================================================

describe('ObservationalMemory Integration', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'test-thread';
  const resourceId = 'test-resource';

  beforeEach(() => {
    storage = createInMemoryStorage();

    om = new ObservationalMemory({
      storage,
      observer: {
        historyThreshold: 500, // Low threshold for testing
        model: 'test-model',
      },
      reflector: {
        observationThreshold: 1000,
        model: 'test-model',
      },
    });
  });

  describe('getOrCreateRecord', () => {
    it('should return null when record does not exist', async () => {
      const record = await om.getRecord(threadId, resourceId);
      expect(record).toBeNull();
    });

    it('should return record after initialization via storage', async () => {
      await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const afterInit = await om.getRecord(threadId, resourceId);
      expect(afterInit).toBeDefined();
    });
  });

  describe('getObservations', () => {
    it('should return undefined when no observations exist', async () => {
      const obs = await om.getObservations(threadId, resourceId);
      expect(obs).toBeUndefined();
    });

    it('should return observations after they are created', async () => {
      // Initialize and add observations directly to storage
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: record.id,
        observations: '- 🔴 Test observation',
        messageIds: [],
        tokenCount: 50,
      });

      const obs = await om.getObservations(threadId, resourceId);
      expect(obs).toBe('- 🔴 Test observation');
    });
  });

  describe('clear', () => {
    it('should clear all memory for thread/resource', async () => {
      // Initialize
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: record.id,
        observations: '- 🔴 Test',
        messageIds: [],
        tokenCount: 50,
      });

      // Verify it exists
      expect(await om.getObservations(threadId, resourceId)).toBeDefined();

      // Clear
      await om.clear(threadId, resourceId);

      // Verify it's gone
      expect(await om.getRecord(threadId, resourceId)).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return observation history across generations', async () => {
      // Create initial generation
      const gen1 = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: gen1.id,
        observations: '- 🔴 Generation 1',
        messageIds: [],
        tokenCount: 100,
      });

      // Create reflection (new generation)
      const gen1Record = await storage.getObservationalMemory(threadId, resourceId);
      await storage.createReflectionGeneration({
        currentRecord: gen1Record!,
        reflection: '- 🔴 Generation 2 (reflection)',
        tokenCount: 50,
      });

      const history = await om.getHistory(threadId, resourceId);
      expect(history.length).toBe(2);
    });
  });

  describe('getTokenCounter', () => {
    it('should return the token counter instance', () => {
      const counter = om.getTokenCounter();
      expect(counter).toBeInstanceOf(TokenCounter);
    });
  });

  describe('getStorage', () => {
    it('should return the storage instance', () => {
      const s = om.getStorage();
      expect(s).toBe(storage);
    });
  });
});

// =============================================================================
// Scenario Tests
// =============================================================================

describe('Scenario: Basic Observation Flow', () => {
  it('should track which messages have been observed', async () => {
    const storage = createInMemoryStorage();

    // Initialize record
    const record = await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Simulate observing messages
    const messageIds = ['msg-1', 'msg-2', 'msg-3'];
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- 🔴 User asked about X',
      messageIds,
      tokenCount: 100,
    });

    // Verify messages are tracked
    const updated = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(updated?.observedMessageIds).toEqual(messageIds);
  });
});

describe('Scenario: Buffering Flow', () => {
  it('should support async buffering workflow', async () => {
    const storage = createInMemoryStorage();

    const record = await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Step 1: Mark messages as buffering (async observation started)
    await storage.markMessagesAsBuffering(record.id, ['msg-1', 'msg-2']);

    let current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.bufferingMessageIds).toEqual(['msg-1', 'msg-2']);

    // Step 2: Buffering completes - store buffered observations
    await storage.updateBufferedObservations({
      id: record.id,
      observations: '- 🟡 Buffered observation',
      messageIds: ['msg-1', 'msg-2'],
    });

    current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.bufferedObservations).toBe('- 🟡 Buffered observation');
    expect(current?.bufferedMessageIds).toEqual(['msg-1', 'msg-2']);

    // Buffered observations should NOT be in active yet
    expect(current?.activeObservations).toBe('');

    // Step 3: Threshold hit, swap buffered to active
    await storage.swapBufferedToActive(record.id);

    current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.activeObservations).toContain('Buffered observation');
    expect(current?.observedMessageIds).toContain('msg-1');
    expect(current?.bufferedObservations).toBeUndefined();
  });
});

describe('Scenario: Reflection Creates New Generation', () => {
  it('should create new generation with reflection replacing observations', async () => {
    const storage = createInMemoryStorage();

    // Create initial generation
    const gen1 = await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Add lots of observations
    await storage.updateActiveObservations({
      id: gen1.id,
      observations: '- 🔴 Observation 1\n- 🟡 Observation 2\n- 🟡 Observation 3\n... (many more)',
      messageIds: ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'],
      tokenCount: 25000, // Exceeds reflector threshold
    });

    const gen1Record = await storage.getObservationalMemory('thread-1', 'resource-1');

    // Reflection creates new generation
    const gen2 = await storage.createReflectionGeneration({
      currentRecord: gen1Record!,
      reflection: '- 🔴 Condensed: User working on project X',
      tokenCount: 500,
      suggestedContinuation: 'Continue with implementation...',
    });

    // New generation has reflection as active observations
    expect(gen2.activeObservations).toBe('- 🔴 Condensed: User working on project X');
    expect(gen2.observationTokenCount).toBe(500);
    expect(gen2.previousGenerationId).toBe(gen1.id);
    expect(gen2.originType).toBe('reflection');
    expect(gen2.suggestedContinuation).toBe('Continue with implementation...');

    // Observed message IDs are preserved for tracking
    expect(gen2.observedMessageIds.length).toBe(5);

    // Getting current record returns new generation
    const current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.id).toBe(gen2.id);
    expect(current?.activeObservations).toBe('- 🔴 Condensed: User working on project X');
  });
});
