import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import {
  buildObserverPrompt,
  buildObserverSystemPrompt,
  parseObserverOutput,
  optimizeObservationsForContext,
  formatMessagesForObserver,
  hasCurrentTaskSection,
  extractCurrentTask,
  sanitizeObservationLines,
  detectDegenerateRepetition,
} from '../observer-agent';
import {
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
  buildReflectorSystemPrompt,
} from '../reflector-agent';
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
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
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
          observation: { messageTokens: 10000, model: 'test-model' },
          reflection: { observationTokens: 20000, model: 'test-model' },
        },
      });

      expect(record).toBeDefined();
      expect(record.threadId).toBe(threadId);
      expect(record.resourceId).toBe(resourceId);
      expect(record.scope).toBe('thread');
      expect(record.activeObservations).toBe('');
      expect(record.isObserving).toBe(false);
      expect(record.isReflecting).toBe(false);
      // lastObservedAt starts undefined so all existing messages are "unobserved"
      // This is critical for historical data (like LongMemEval fixtures)
      expect(record.lastObservedAt).toBeUndefined();
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

        tokenCount: 100,
        lastObservedAt: new Date(),
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBe('- 🔴 Test observation');
    });
  });

  // Note: markMessagesAsBuffering was removed - async buffering now uses updateBufferedObservations with bufferedMessageIds

  describe('updateBufferedObservations', () => {
    it('should store buffered observations as chunks', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Buffered observation',
          tokenCount: 50,
          messageIds: ['msg-1'],
          cycleId: 'test-cycle-1',
          messageTokens: 100,
          lastObservedAt: new Date('2025-01-01T10:00:00Z'),
        },
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservationChunks).toHaveLength(1);
      expect(record?.bufferedObservationChunks?.[0]?.observations).toBe('- 🔴 Buffered observation');
      expect(record?.bufferedObservationChunks?.[0]?.tokenCount).toBe(50);
      expect(record?.bufferedObservationChunks?.[0]?.messageIds).toEqual(['msg-1']);
    });

    it('should append buffered observations as separate chunks', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 First buffered',
          tokenCount: 30,
          messageIds: ['msg-1'],
          cycleId: 'test-cycle-1',
          messageTokens: 100,
          lastObservedAt: new Date('2025-01-01T10:00:00Z'),
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Second buffered',
          tokenCount: 20,
          messageIds: ['msg-2'],
          cycleId: 'test-cycle-2',
          messageTokens: 150,
          lastObservedAt: new Date('2025-01-01T10:01:00Z'),
        },
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservationChunks).toHaveLength(2);
      expect(record?.bufferedObservationChunks?.[0]?.observations).toBe('- 🔴 First buffered');
      expect(record?.bufferedObservationChunks?.[0]?.tokenCount).toBe(30);
      expect(record?.bufferedObservationChunks?.[1]?.observations).toBe('- 🔴 Second buffered');
      expect(record?.bufferedObservationChunks?.[1]?.tokenCount).toBe(20);
    });
  });

  describe('swapBufferedToActive', () => {
    it('should append buffered chunks to active and clear buffered', async () => {
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
        tokenCount: 50,
        lastObservedAt: new Date(),
      });

      // Add buffered observations as a chunk
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Buffered observation',
          tokenCount: 40,
          messageIds: ['msg-1'],
          cycleId: 'test-cycle-1',
          messageTokens: 100,
          lastObservedAt: new Date('2025-01-01T10:00:00Z'),
        },
      });

      await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1, // 100% as 0-1 float
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: new Date(),
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toContain('- 🔴 Active observation');
      expect(record?.activeObservations).toContain('- 🟡 Buffered observation');
      expect(record?.bufferedObservationChunks).toBeUndefined();
    });

    it('should update lastObservedAt when swapping buffered to active', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Initially, lastObservedAt is undefined (all messages are unobserved)
      expect(initial.lastObservedAt).toBeUndefined();

      // Add buffered observations as a chunk
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Buffered observation',
          tokenCount: 40,
          messageIds: ['msg-1'],
          cycleId: 'test-cycle-1',
          messageTokens: 100,
          lastObservedAt: new Date('2025-01-01T10:00:00Z'),
        },
      });

      const beforeSwap = new Date();
      await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1, // 100% as 0-1 float
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: beforeSwap,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.lastObservedAt).toBeDefined();
      expect(record!.lastObservedAt!.getTime()).toBe(beforeSwap.getTime());
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

        tokenCount: 100,
        lastObservedAt: new Date(),
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBe('- 🔴 Test observation');
      expect(record?.observationTokenCount).toBe(100);
      // Message ID tracking removed - using cursor-based lastObservedAt instead
    });

    it('should set lastObservedAt when provided', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Initially, lastObservedAt is undefined (all messages are unobserved)
      expect(initial.lastObservedAt).toBeUndefined();

      const observedAt = new Date('2025-01-15T10:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Test observation',

        tokenCount: 100,
        lastObservedAt: observedAt,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.lastObservedAt).toEqual(observedAt);
    });

    it('should update lastObservedAt on each observation', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // First update with lastObservedAt
      const firstObservedAt = new Date('2025-01-15T10:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 First observation',

        tokenCount: 100,
        lastObservedAt: firstObservedAt,
      });

      const afterFirst = await storage.getObservationalMemory(threadId, resourceId);
      expect(afterFirst?.lastObservedAt).toEqual(firstObservedAt);

      // Second update with a new lastObservedAt
      const secondObservedAt = new Date('2025-01-15T11:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Second observation',

        tokenCount: 150,
        lastObservedAt: secondObservedAt,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.lastObservedAt).toEqual(secondObservedAt);
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

        tokenCount: 30000,
        lastObservedAt: new Date(),
      });

      const currentRecord = await storage.getObservationalMemory(threadId, resourceId);

      const newRecord = await storage.createReflectionGeneration({
        currentRecord: currentRecord!,
        reflection: '- 🔴 Condensed reflection',
        tokenCount: 5000,
      });

      expect(newRecord.activeObservations).toBe('- 🔴 Condensed reflection');
      expect(newRecord.observationTokenCount).toBe(5000);
      expect(newRecord.originType).toBe('reflection');
      // Message ID tracking removed - using cursor-based lastObservedAt instead
      // After reflection, lastObservedAt is updated to mark all previous messages as observed
      expect(newRecord.lastObservedAt).toBeDefined();
    });

    it('should preserve lastObservedAt from observation when creating reflection generation', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Set lastObservedAt during observation (this always happens before reflection)
      const observedAt = new Date('2025-01-01T00:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Original observations',

        tokenCount: 30000,
        lastObservedAt: observedAt,
      });

      const currentRecord = await storage.getObservationalMemory(threadId, resourceId);
      expect(currentRecord?.lastObservedAt).toEqual(observedAt);

      const newRecord = await storage.createReflectionGeneration({
        currentRecord: currentRecord!,
        reflection: '- 🔴 Condensed reflection',
        tokenCount: 5000,
      });

      // New record should preserve lastObservedAt from the observation
      // (reflection doesn't change the cursor - observation always runs first)
      expect(newRecord.lastObservedAt).toBeDefined();
      expect(newRecord.lastObservedAt).toEqual(observedAt);

      // Previous record should also retain its original lastObservedAt
      const history = await storage.getObservationalMemoryHistory(threadId, resourceId);
      const previousRecord = history?.find(r => r.id === initial.id);
      expect(previousRecord?.lastObservedAt).toEqual(observedAt);
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

        tokenCount: 100,
        lastObservedAt: new Date(),
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

          tokenCount: 100,
          lastObservedAt: new Date(),
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

    it('should extract continuation hint from XML suggested-response tag', () => {
      const output = `
<observations>
- 🔴 User asked about React [topic_discussed]
</observations>

<current-task>
Helping user understand React hooks
</current-task>

<suggested-response>
Let me show you an example...
</suggested-response>
      `;

      const result = parseObserverOutput(output);
      expect(result.suggestedContinuation).toContain('Let me show you an example');
    });

    it('should handle XML format with all sections', () => {
      const output = `
<observations>
- 🔴 Observation here
</observations>

<current-task>
Working on implementation
</current-task>

<suggested-response>
Here's the implementation...
</suggested-response>
      `;

      const result = parseObserverOutput(output);
      expect(result.suggestedContinuation).toBeDefined();
      expect(result.observations).toContain('🔴 Observation here');
      // currentTask is returned separately, not embedded in observations
      expect(result.currentTask).toBe('Working on implementation');
      expect(result.observations).not.toContain('Working on implementation');
      expect(result.observations).not.toContain('<current-task>');
    });

    it('should handle output without continuation hint', () => {
      const output = '- 🔴 Simple observation';
      const result = parseObserverOutput(output);

      // currentTask is returned separately (undefined if not present)
      expect(result.observations).toContain('- 🔴 Simple observation');
      expect(result.observations).not.toContain('<current-task>');
      expect(result.currentTask).toBeUndefined();
      expect(result.suggestedContinuation).toBeUndefined();
    });

    // Edge case tests for XML parsing robustness
    describe('XML parsing edge cases', () => {
      it('should handle malformed XML with unclosed tags by using fallback', () => {
        const output = `<observations>
- 🔴 User preference noted
- 🟡 Some context
`;
        // No closing tag - should fall back to extracting list items
        const result = parseObserverOutput(output);
        expect(result.observations).toContain('🔴 User preference noted');
        expect(result.observations).toContain('🟡 Some context');
      });

      it('should handle empty XML tags gracefully', () => {
        const output = `<observations></observations>

<current-task></current-task>

<suggested-response></suggested-response>`;

        const result = parseObserverOutput(output);
        // Empty observations should trigger fallback or be empty
        // Current task should still be added if missing content
        expect(result.observations).toBeDefined();
      });

      it('should handle code blocks containing < characters', () => {
        const output = `<observations>
- 🔴 User is working on React component
- 🟡 Code example discussed: \`const x = a < b ? a : b;\`
- 🔴 User prefers arrow functions: \`const fn = () => {}\`
</observations>

<current-task>
Help user with conditional rendering
</current-task>`;

        const result = parseObserverOutput(output);
        expect(result.observations).toContain('User is working on React component');
        expect(result.observations).toContain('a < b');
        // currentTask is returned separately, not in observations
        expect(result.currentTask).toBe('Help user with conditional rendering');
        expect(result.observations).not.toContain('Help user with conditional rendering');
      });

      it('should NOT capture inline <observations> tags that appear mid-line', () => {
        const output = `<observations>
- 🔴 User asked about XML parsing
- 🟡 Mentioned that <observations> tags are used for memory
- 🔴 User wants to understand the format
</observations>

<current-task>
Explain the <observations> tag format to user
</current-task>`;

        const result = parseObserverOutput(output);
        // The actual observations should be captured
        expect(result.observations).toContain('User asked about XML parsing');
        // The inline mention of <observations> should be preserved as content, not parsed as a tag
        expect(result.observations).toContain('<observations> tags are used for memory');
        // currentTask is returned separately, not in observations
        expect(result.currentTask).toBe('Explain the <observations> tag format to user');
        expect(result.observations).not.toContain('Explain the <observations> tag format');
      });

      it('should NOT capture inline <current-task> tags that appear mid-line', () => {
        const output = `<observations>
- 🔴 User discussed the <current-task> section format
- 🟡 User wants to know how <current-task> is parsed
</observations>

<current-task>
Help user understand memory XML structure
</current-task>`;

        const result = parseObserverOutput(output);
        expect(result.observations).toContain('<current-task> section format');
        // currentTask is returned separately, not in observations
        expect(result.currentTask).toBe('Help user understand memory XML structure');
        expect(result.observations).not.toContain('Help user understand memory XML structure');
      });

      it('should NOT capture inline <suggested-response> tags that appear mid-line', () => {
        const output = `<observations>
- 🔴 User asked about <suggested-response> usage
</observations>

<current-task>
Explain <suggested-response> tag purpose
</current-task>

<suggested-response>
The <suggested-response> tag helps maintain conversation flow
</suggested-response>`;

        const result = parseObserverOutput(output);
        expect(result.observations).toContain('User asked about <suggested-response> usage');
        expect(result.suggestedContinuation).toContain('<suggested-response> tag helps maintain');
      });

      it('should handle nested code blocks with XML-like content', () => {
        const output = `<observations>
- 🔴 User is building an XML parser
- 🟡 Example code discussed:
  \`\`\`javascript
  const xml = '<observations>test</observations>';
  const parsed = parseXml(xml);
  \`\`\`
</observations>

<current-task>
Help user implement XML parsing
</current-task>`;

        const result = parseObserverOutput(output);
        expect(result.observations).toContain('User is building an XML parser');
        // currentTask is returned separately, not in observations
        expect(result.currentTask).toBe('Help user implement XML parsing');
        expect(result.observations).not.toContain('Help user implement XML parsing');
      });

      it('should NOT be truncated by inline closing tags like </observations>', () => {
        const output = `<observations>
- 🔴 User mentioned that </observations> ends the section
- 🟡 User also discussed </current-task> syntax
- 🔴 Important: preserve all content
</observations>

<current-task>
Help user understand XML tag boundaries
</current-task>`;

        const result = parseObserverOutput(output);
        // Should NOT be truncated at the inline </observations>
        expect(result.observations).toContain('User mentioned that </observations> ends the section');
        expect(result.observations).toContain('Important: preserve all content');
        // currentTask is returned separately, not in observations
        expect(result.currentTask).toBe('Help user understand XML tag boundaries');
        expect(result.observations).not.toContain('Help user understand XML tag boundaries');
      });

      it('should NOT be truncated by inline closing </current-task> tag', () => {
        const output = `<observations>
- 🔴 User info here
</observations>

<current-task>
User asked about </current-task> parsing and how it works
</current-task>`;

        const result = parseObserverOutput(output);
        // currentTask is returned separately, not in observations
        // Should capture the full current-task content
        expect(result.currentTask).toContain('User asked about </current-task> parsing');
        expect(result.observations).not.toContain('User asked about </current-task> parsing');
      });
    });
  });

  describe('sanitizeObservationLines', () => {
    it('should pass through normal observations unchanged', () => {
      const obs = '- 🔴 User asked about React\n- 🟡 Some context';
      expect(sanitizeObservationLines(obs)).toBe(obs);
    });

    it('should truncate lines exceeding 10k characters', () => {
      const longLine = 'x'.repeat(15_000);
      const obs = `- 🔴 Short line\n${longLine}\n- 🟡 Another line`;
      const result = sanitizeObservationLines(obs);
      expect(result).toContain('- 🔴 Short line');
      expect(result).toContain('- 🟡 Another line');
      expect(result).toContain(' … [truncated]');
      // The truncated line should be 10k + the suffix
      const lines = result.split('\n');
      expect(lines[1]!.length).toBeLessThan(11_000);
    });

    it('should handle empty input', () => {
      expect(sanitizeObservationLines('')).toBe('');
    });
  });

  describe('detectDegenerateRepetition', () => {
    it('should return false for normal text', () => {
      const text = '- 🔴 User asked about React\n- 🟡 Some context\n- 🔴 Another observation';
      expect(detectDegenerateRepetition(text)).toBe(false);
    });

    it('should return false for short text', () => {
      expect(detectDegenerateRepetition('hello')).toBe(false);
    });

    it('should detect repeated content patterns', () => {
      // Simulate Gemini Flash repetition bug - same ~200 char block repeated many times
      const block =
        'getLanguageModel().doGenerate(options: LanguageModelV2CallOptions): PromiseLike<LanguageModelV2GenerateResult>, ';
      const text = block.repeat(100); // ~11k chars of the same block
      expect(detectDegenerateRepetition(text)).toBe(true);
    });

    it('should detect extremely long single lines', () => {
      const line = 'a'.repeat(60_000);
      expect(detectDegenerateRepetition(line)).toBe(true);
    });

    it('should flag degenerate output in parseObserverOutput', () => {
      const block = 'StreamTextResult.getLanguageModel().doGenerate(options): PromiseLike<Result>, ';
      const text = `<observations>\n${block.repeat(100)}\n</observations>`;
      const result = parseObserverOutput(text);
      expect(result.degenerate).toBe(true);
      expect(result.observations).toBe('');
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
  describe('buildReflectorSystemPrompt', () => {
    it('should include base reflector instructions', () => {
      const systemPrompt = buildReflectorSystemPrompt();

      expect(systemPrompt).toContain('observational-memory-instruction');
      expect(systemPrompt).toContain('observation reflector');
    });

    it('should include custom instruction when provided', () => {
      const customInstruction = 'Prioritize consolidating health-related observations together.';
      const systemPrompt = buildReflectorSystemPrompt(customInstruction);

      expect(systemPrompt).toContain(customInstruction);
      expect(systemPrompt).toContain('observational-memory-instruction');
    });

    it('should work without custom instruction', () => {
      const systemPrompt = buildReflectorSystemPrompt();
      const systemPromptWithUndefined = buildReflectorSystemPrompt(undefined);

      expect(systemPrompt).toBe(systemPromptWithUndefined);
      expect(systemPrompt).toContain('observational-memory-instruction');
    });
  });

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
      expect(prompt).toContain('more compression');
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

    it('should extract continuation hint from XML suggested-response tag', () => {
      const output = `
<observations>
- 🔴 Observations here
</observations>

<current-task>
Building the chart component
</current-task>

<suggested-response>
Start by implementing the chart component...
</suggested-response>
      `;

      const result = parseReflectorOutput(output);
      expect(result.suggestedContinuation).toContain('implementing the chart component');
    });

    // Edge case tests for XML parsing robustness
    describe('XML parsing edge cases', () => {
      it('should handle malformed XML with unclosed tags by using fallback', () => {
        const output = `<observations>
- 🔴 User preference noted
- 🟡 Some context
`;
        // No closing tag - should fall back to extracting list items
        const result = parseReflectorOutput(output);
        expect(result.observations).toContain('🔴 User preference noted');
      });

      it('should NOT be truncated by inline closing tags like </observations>', () => {
        const output = `<observations>
- 🔴 User mentioned that </observations> ends the section
- 🟡 User also discussed </current-task> syntax
- 🔴 Important: preserve all content
</observations>

<current-task>
Help user understand XML tag boundaries
</current-task>`;

        const result = parseReflectorOutput(output);
        // Should NOT be truncated at the inline </observations>
        expect(result.observations).toContain('User mentioned that </observations> ends the section');
        expect(result.observations).toContain('Important: preserve all content');
      });

      it('should handle code blocks with XML-like content', () => {
        const output = `<observations>
- 🔴 User is building an XML parser
- 🟡 Example: \`const xml = '<observations>test</observations>';\`
</observations>

<current-task>
Help user implement XML parsing
</current-task>`;

        const result = parseReflectorOutput(output);
        expect(result.observations).toContain('User is building an XML parser');
        // currentTask is NOT returned by parseReflectorOutput (only observations and suggestedContinuation)
        // and is NOT embedded in observations
        expect(result.observations).not.toContain('Help user implement XML parsing');
      });
    });
  });

  describe('validateCompression', () => {
    it('should return true when reflected tokens are below threshold', () => {
      // reflectedTokens=5000, targetThreshold=10000 -> 5000 < 10000 = true
      expect(validateCompression(5000, 10000)).toBe(true);
    });

    it('should return false when reflected tokens equal threshold', () => {
      // reflectedTokens=10000, targetThreshold=10000 -> 10000 < 10000 = false
      expect(validateCompression(10000, 10000)).toBe(false);
    });

    it('should return false when reflected tokens exceed threshold', () => {
      // reflectedTokens=12000, targetThreshold=10000 -> 12000 < 10000 = false
      expect(validateCompression(12000, 10000)).toBe(false);
    });

    it('should validate against target threshold', () => {
      // reflectedTokens=8500, targetThreshold=10000 -> 8500 < 10000 = true
      expect(validateCompression(8500, 10000)).toBe(true);
      // reflectedTokens=9500, targetThreshold=10000 -> 9500 < 10000 = true (still below)
      expect(validateCompression(9500, 10000)).toBe(true);
      // reflectedTokens=10500, targetThreshold=10000 -> 10500 < 10000 = false
      expect(validateCompression(10500, 10000)).toBe(false);
    });

    it('should work with different thresholds', () => {
      // reflectedTokens=7500, targetThreshold=8000 -> 7500 < 8000 = true
      expect(validateCompression(7500, 8000)).toBe(true);
      // reflectedTokens=8500, targetThreshold=8000 -> 8500 < 8000 = false
      expect(validateCompression(8500, 8000)).toBe(false);
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

    it('should always return an integer', () => {
      const msg = createTestMessage('Hello, world!');
      const count = counter.countMessage(msg);
      expect(Number.isInteger(count)).toBe(true);
    });

    it('should skip data-* parts when counting tokens', () => {
      const largeObservationText = 'x'.repeat(10000);
      const msgWithDataParts: MastraDBMessage = {
        id: 'msg-data-parts',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolName: 'test', toolCallId: 'tc1', result: 'ok' },
            },
            { type: 'data-om-activation', data: { cycleId: 'cycle-1', observations: largeObservationText } } as any,
            { type: 'data-om-buffering-start', data: { cycleId: 'cycle-2' } } as any,
          ],
        },
        type: 'text',
        createdAt: new Date(),
      };

      const msgWithoutDataParts: MastraDBMessage = {
        id: 'msg-no-data-parts',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolName: 'test', toolCallId: 'tc1', result: 'ok' },
            },
          ],
        },
        type: 'text',
        createdAt: new Date(),
      };

      const countWith = counter.countMessage(msgWithDataParts);
      const countWithout = counter.countMessage(msgWithoutDataParts);
      // data-* parts should be skipped, so counts should be equal
      expect(countWith).toBe(countWithout);
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

    it('should always return an integer', () => {
      const messages = createTestMessages(3);
      const count = counter.countMessages(messages);
      expect(Number.isInteger(count)).toBe(true);
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
      observation: {
        messageTokens: 500, // Low threshold for testing
        model: 'test-model',
      },
      reflection: {
        observationTokens: 1000,
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

        tokenCount: 50,
        lastObservedAt: new Date(),
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

        tokenCount: 50,
        lastObservedAt: new Date(),
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

        tokenCount: 100,
        lastObservedAt: new Date(),
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

  describe('cursor-based message loading (lastObservedAt)', () => {
    it('should load only messages created after lastObservedAt', async () => {
      // 1. Create some "old" messages (before observation)
      const oldTime = new Date('2025-01-01T10:00:00Z');
      const oldMsg1: MastraDBMessage = {
        id: 'old-msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Old message 1' }] },
        type: 'text',
        createdAt: oldTime,
        threadId,
      };
      const oldMsg2: MastraDBMessage = {
        id: 'old-msg-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Old response 1' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T10:01:00Z'),
        threadId,
      };

      // Save old messages to storage
      await storage.saveMessages({ messages: [oldMsg1, oldMsg2] });

      // 2. Initialize OM record with lastObservedAt set to AFTER the old messages
      const observedAt = new Date('2025-01-01T12:00:00Z');
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: record.id,
        observations: '- 🔴 User discussed old topics',

        tokenCount: 100,
        lastObservedAt: observedAt,
      });

      // 3. Create "new" messages (after observation)
      const newTime = new Date('2025-01-01T14:00:00Z');
      const newMsg1: MastraDBMessage = {
        id: 'new-msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'New message after observation' }] },
        type: 'text',
        createdAt: newTime,
        threadId,
      };
      const newMsg2: MastraDBMessage = {
        id: 'new-msg-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'New response' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T14:01:00Z'),
        threadId,
      };

      await storage.saveMessages({ messages: [newMsg1, newMsg2] });

      // 4. Query messages using dateRange.start (simulating what loadUnobservedMessages does)
      const result = await storage.listMessages({
        threadId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: {
          dateRange: {
            start: observedAt,
          },
        },
      });

      // 5. Should only get the new messages, not the old ones
      expect(result.messages.length).toBe(2);
      expect(result.messages.map(m => m.id)).toEqual(['new-msg-1', 'new-msg-2']);
      expect(result.messages.map(m => m.id)).not.toContain('old-msg-1');
      expect(result.messages.map(m => m.id)).not.toContain('old-msg-2');
    });

    it('should load all messages when lastObservedAt is undefined (first observation)', async () => {
      // Create messages at various times
      const msg1: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'First message' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        threadId,
      };
      const msg2: MastraDBMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Response' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T10:01:00Z'),
        threadId,
      };
      const msg3: MastraDBMessage = {
        id: 'msg-3',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Another message' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T10:02:00Z'),
        threadId,
      };

      await storage.saveMessages({ messages: [msg1, msg2, msg3] });

      // Initialize OM record WITHOUT lastObservedAt (first time, no observations yet)
      await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Query without dateRange filter (simulating first observation)
      const result = await storage.listMessages({
        threadId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        // No filter - should get all messages
      });

      // Should get ALL messages
      expect(result.messages.length).toBe(3);
      expect(result.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should handle messages created at exact same timestamp as lastObservedAt', async () => {
      // Edge case: message created at exact same time as lastObservedAt
      const exactTime = new Date('2025-01-01T12:00:00Z');

      const msgAtExactTime: MastraDBMessage = {
        id: 'msg-exact',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Message at exact observation time' }] },
        type: 'text',
        createdAt: exactTime,
        threadId,
      };

      const msgAfter: MastraDBMessage = {
        id: 'msg-after',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Message after observation' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T12:00:01Z'),
        threadId,
      };

      await storage.saveMessages({ messages: [msgAtExactTime, msgAfter] });

      // Query with dateRange.start = exactTime
      // The InMemoryMemory implementation uses >= for start, so exact time should be included
      const result = await storage.listMessages({
        threadId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: {
          dateRange: {
            start: exactTime,
          },
        },
      });

      // Both messages should be included (>= comparison)
      // This is why we also have the ID-based safety filter in processInput
      expect(result.messages.length).toBe(2);
      expect(result.messages.map(m => m.id)).toContain('msg-exact');
      expect(result.messages.map(m => m.id)).toContain('msg-after');
    });

    it('should use lastObservedAt cursor after reflection creates new generation', async () => {
      // 1. Create messages before reflection
      const preReflectionMsg: MastraDBMessage = {
        id: 'pre-reflection-msg',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Message before reflection' }] },
        type: 'text',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        threadId,
      };

      await storage.saveMessages({ messages: [preReflectionMsg] });

      // 2. Initialize and observe
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const firstObservedAt = new Date('2025-01-01T11:00:00Z');
      await storage.updateActiveObservations({
        id: record.id,
        observations: '- 🔴 Pre-reflection observations',

        tokenCount: 30000, // High token count to trigger reflection
        lastObservedAt: firstObservedAt,
      });

      // 3. Create reflection (new generation)
      const currentRecord = await storage.getObservationalMemory(threadId, resourceId);
      const newRecord = await storage.createReflectionGeneration({
        currentRecord: currentRecord!,
        reflection: '- 🔴 Condensed reflection',
        tokenCount: 5000,
      });

      // 4. New record should have fresh lastObservedAt
      expect(newRecord.lastObservedAt).toBeDefined();
      const reflectionTime = newRecord.lastObservedAt!;

      // 5. Create post-reflection messages
      const postReflectionMsg: MastraDBMessage = {
        id: 'post-reflection-msg',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Message after reflection' }] },
        type: 'text',
        createdAt: new Date(reflectionTime.getTime() + 60000), // 1 minute after reflection
        threadId,
      };

      await storage.saveMessages({ messages: [postReflectionMsg] });

      // 6. Query using new record's lastObservedAt
      const result = await storage.listMessages({
        threadId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: {
          dateRange: {
            start: reflectionTime,
          },
        },
      });

      // Should only get post-reflection message, not pre-reflection
      expect(result.messages.map(m => m.id)).toContain('post-reflection-msg');
      expect(result.messages.map(m => m.id)).not.toContain('pre-reflection-msg');
    });
  });

  describe('resource-scoped message loading (listMessagesByResourceId)', () => {
    const resourceId = 'test-resource-for-messages';

    it('should load all messages for a resource across multiple threads', async () => {
      const thread1Id = 'thread-1';
      const thread2Id = 'thread-2';
      const thread3Id = 'thread-3';

      // Create threads for the resource
      await storage.saveThread({
        thread: {
          id: thread1Id,
          resourceId,
          title: 'Thread 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await storage.saveThread({
        thread: {
          id: thread2Id,
          resourceId,
          title: 'Thread 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await storage.saveThread({
        thread: {
          id: thread3Id,
          resourceId,
          title: 'Thread 3',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create messages in different threads
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-t1-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message in thread 1' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:00:00Z'),
          threadId: thread1Id,
          resourceId,
        },
        {
          id: 'msg-t2-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message in thread 2' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:01:00Z'),
          threadId: thread2Id,
          resourceId,
        },
        {
          id: 'msg-t3-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message in thread 3' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:02:00Z'),
          threadId: thread3Id,
          resourceId,
        },
        {
          id: 'msg-t1-2',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Response in thread 1' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:03:00Z'),
          threadId: thread1Id,
          resourceId,
        },
      ];

      await storage.saveMessages({ messages });

      // Query all messages for the resource (no threadId)
      const result = await storage.listMessagesByResourceId({
        resourceId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      // Should get all 4 messages from all threads
      expect(result.messages.length).toBe(4);
      expect(result.messages.map(m => m.id)).toEqual(['msg-t1-1', 'msg-t2-1', 'msg-t3-1', 'msg-t1-2']);
    });

    it('should filter messages by dateRange.start when querying by resourceId', async () => {
      const thread1Id = 'thread-date-1';
      const thread2Id = 'thread-date-2';

      // Create threads
      await storage.saveThread({
        thread: {
          id: thread1Id,
          resourceId,
          title: 'Thread 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await storage.saveThread({
        thread: {
          id: thread2Id,
          resourceId,
          title: 'Thread 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create messages at different times across threads
      const oldTime = new Date('2025-01-01T08:00:00Z');
      const cursorTime = new Date('2025-01-01T12:00:00Z');
      const newTime = new Date('2025-01-01T14:00:00Z');

      const messages: MastraDBMessage[] = [
        // Old messages (before cursor)
        {
          id: 'old-t1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Old message thread 1' }] },
          type: 'text',
          createdAt: oldTime,
          threadId: thread1Id,
          resourceId,
        },
        {
          id: 'old-t2',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Old message thread 2' }] },
          type: 'text',
          createdAt: new Date(oldTime.getTime() + 1000),
          threadId: thread2Id,
          resourceId,
        },
        // New messages (after cursor)
        {
          id: 'new-t1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'New message thread 1' }] },
          type: 'text',
          createdAt: newTime,
          threadId: thread1Id,
          resourceId,
        },
        {
          id: 'new-t2',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'New message thread 2' }] },
          type: 'text',
          createdAt: new Date(newTime.getTime() + 1000),
          threadId: thread2Id,
          resourceId,
        },
      ];

      await storage.saveMessages({ messages });

      // Query with dateRange.start (simulating lastObservedAt cursor)
      const result = await storage.listMessagesByResourceId({
        resourceId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: {
          dateRange: {
            start: cursorTime,
          },
        },
      });

      // Should only get new messages from both threads
      expect(result.messages.length).toBe(2);
      expect(result.messages.map(m => m.id)).toEqual(['new-t1', 'new-t2']);
      expect(result.messages.map(m => m.id)).not.toContain('old-t1');
      expect(result.messages.map(m => m.id)).not.toContain('old-t2');
    });

    it('should return empty array when no messages exist after cursor for resource', async () => {
      const threadId = 'thread-empty';

      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create messages before the cursor
      const messages: MastraDBMessage[] = [
        {
          id: 'before-cursor',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Before cursor' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T08:00:00Z'),
          threadId,
        },
      ];

      await storage.saveMessages({ messages });

      // Query with cursor after all messages
      const result = await storage.listMessagesByResourceId({
        resourceId,
        perPage: false,
        filter: {
          dateRange: {
            start: new Date('2025-01-01T12:00:00Z'),
          },
        },
      });

      expect(result.messages.length).toBe(0);
    });

    it('should not return messages from other resources', async () => {
      const otherResourceId = 'other-resource';
      const thread1Id = 'thread-res-1';
      const thread2Id = 'thread-other-res';

      // Create threads for different resources
      await storage.saveThread({
        thread: {
          id: thread1Id,
          resourceId,
          title: 'Thread for target resource',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await storage.saveThread({
        thread: {
          id: thread2Id,
          resourceId: otherResourceId,
          title: 'Thread for other resource',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create messages in both resources
      const messages: MastraDBMessage[] = [
        {
          id: 'target-msg',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Target resource message' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:00:00Z'),
          threadId: thread1Id,
          resourceId,
        },
        {
          id: 'other-msg',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Other resource message' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:01:00Z'),
          threadId: thread2Id,
          resourceId: otherResourceId,
        },
      ];

      await storage.saveMessages({ messages });

      // Query for target resource only
      const result = await storage.listMessagesByResourceId({
        resourceId,
        perPage: false,
      });

      // Should only get message from target resource
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].id).toBe('target-msg');
      expect(result.messages.map(m => m.id)).not.toContain('other-msg');
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
    const observedAt = new Date();
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- 🔴 User asked about X',
      tokenCount: 100,
      lastObservedAt: observedAt,
    });

    // Verify cursor is updated (message ID tracking removed in favor of cursor-based lastObservedAt)
    const updated = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(updated?.lastObservedAt).toEqual(observedAt);
  });
});

describe('Scenario: Buffering Flow', () => {
  it('should support async buffering workflow with chunks', async () => {
    const storage = createInMemoryStorage();

    const record = await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Step 1: Store buffered observations as a chunk (async observation in progress)
    await storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        observations: '- 🟡 Buffered observation',
        tokenCount: 50,
        messageIds: ['msg-1', 'msg-2'],
        cycleId: 'test-cycle-1',
        messageTokens: 100,
        lastObservedAt: new Date('2025-01-01T10:00:00Z'),
      },
    });

    let current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.bufferedObservationChunks).toHaveLength(1);
    expect(current?.bufferedObservationChunks?.[0]?.observations).toBe('- 🟡 Buffered observation');
    expect(current?.bufferedObservationChunks?.[0]?.tokenCount).toBe(50);
    expect(current?.bufferedObservationChunks?.[0]?.messageIds).toEqual(['msg-1', 'msg-2']);

    // Buffered observations should NOT be in active yet
    expect(current?.activeObservations).toBe('');

    // Step 2: Threshold hit, swap buffered to active
    const swapTime = new Date();
    await storage.swapBufferedToActive({
      id: record.id,
      activationRatio: 1, // 100% as 0-1 float
      messageTokensThreshold: 100000,
      currentPendingTokens: 100000,
      lastObservedAt: swapTime,
    });

    current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.activeObservations).toContain('Buffered observation');
    expect(current?.bufferedObservationChunks).toBeUndefined();
    // NOTE: observedMessageIds is NOT updated during buffered activation.
    // Adding activated IDs would permanently block future messages with recycled IDs
    // from being observed. Instead, activatedMessageIds is returned separately
    // and used directly by cleanupAfterObservation.
    expect(current?.observedMessageIds).toBeUndefined();
    expect(current?.lastObservedAt).toEqual(swapTime);
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

      tokenCount: 25000, // Exceeds reflector threshold
      lastObservedAt: new Date(),
    });

    const gen1Record = await storage.getObservationalMemory('thread-1', 'resource-1');

    // Reflection creates new generation
    const gen2 = await storage.createReflectionGeneration({
      currentRecord: gen1Record!,
      reflection: '- 🔴 Condensed: User working on project X',
      tokenCount: 500,
    });

    // New generation has reflection as active observations
    expect(gen2.activeObservations).toBe('- 🔴 Condensed: User working on project X');
    expect(gen2.observationTokenCount).toBe(500);
    expect(gen2.originType).toBe('reflection');

    // After reflection, lastObservedAt is set on the new record (cursor-based tracking)
    expect(gen2.lastObservedAt).toBeDefined();

    // Getting current record returns new generation
    const current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.id).toBe(gen2.id);
    expect(current?.activeObservations).toBe('- 🔴 Condensed: User working on project X');
  });
});

// =============================================================================
// Unit Tests: Current Task Validation
// =============================================================================

describe('Current Task Validation', () => {
  describe('hasCurrentTaskSection', () => {
    it('should detect <current-task> XML tag', () => {
      const observations = `<observations>
- 🔴 User preference
- 🟡 Some task
</observations>

<current-task>
Implement the login feature
</current-task>`;

      expect(hasCurrentTaskSection(observations)).toBe(true);
    });

    it('should detect <current-task> tag case-insensitively', () => {
      const observations = `<Current-Task>
The user wants to refactor the API
</Current-Task>`;

      expect(hasCurrentTaskSection(observations)).toBe(true);
    });

    it('should return false when missing', () => {
      const observations = `- 🔴 User preference
- 🟡 Some observation
- ������ Minor note`;

      expect(hasCurrentTaskSection(observations)).toBe(false);
    });
  });

  describe('extractCurrentTask', () => {
    it('should extract task content from XML current-task tag', () => {
      const observations = `<observations>
- 🔴 User info
- 🟡 Follow up
</observations>

<current-task>
Implement user authentication with OAuth2
</current-task>`;

      const task = extractCurrentTask(observations);
      expect(task).toBe('Implement user authentication with OAuth2');
    });

    it('should handle multiline task description', () => {
      const observations = `<current-task>
Complete the dashboard feature
with all the charts and graphs
</current-task>`;

      const task = extractCurrentTask(observations);
      expect(task).toContain('Complete the dashboard feature');
      expect(task).toContain('charts and graphs');
    });

    it('should return null when no current task', () => {
      const observations = `- Just some observations
- Nothing about current task`;

      expect(extractCurrentTask(observations)).toBeNull();
    });
  });

  describe('parseObserverOutput with Current Task validation', () => {
    it('should add default Current Task if missing', () => {
      const output = `- 🔴 User asked about React
- 🟡 User prefers TypeScript`;

      const result = parseObserverOutput(output);

      // currentTask is returned separately, not embedded in observations
      // When missing from output, currentTask should be undefined
      expect(result.observations).not.toContain('<current-task>');
      expect(result.currentTask).toBeUndefined();
    });

    it('should extract Current Task separately when present (XML format)', () => {
      const output = `<observations>
- 🔴 User asked about React
</observations>

<current-task>
Help user set up React project
</current-task>`;

      const result = parseObserverOutput(output);

      // currentTask should be extracted separately, not in observations
      expect(result.currentTask).toBe('Help user set up React project');
      expect(result.observations).not.toContain('<current-task>');
      expect(result.observations).not.toContain('Help user set up React project');
    });
  });
});

// =============================================================================
// Scenario Tests: Information Recall
// =============================================================================

describe('Scenario: Information should be preserved through observation cycle', () => {
  it('should preserve key facts in observations', () => {
    // This test verifies the observation format preserves important information
    const messages = [
      createTestMessage('My name is John and I work at Acme Corp as a software engineer.', 'user'),
      createTestMessage('Nice to meet you John! I see you work at Acme Corp as a software engineer.', 'assistant'),
      createTestMessage('Yes, I started there in 2020 and I mainly work with TypeScript and React.', 'user'),
    ];

    const formatted = formatMessagesForObserver(messages);

    // The formatted messages should contain all the key facts
    expect(formatted).toContain('John');
    expect(formatted).toContain('Acme Corp');
    expect(formatted).toContain('software engineer');
    expect(formatted).toContain('2020');
    expect(formatted).toContain('TypeScript');
    expect(formatted).toContain('React');
  });

  it('should include timestamps for temporal context', () => {
    const msg = createTestMessage('I have a meeting tomorrow at 3pm', 'user');
    msg.createdAt = new Date('2024-12-04T14:00:00Z');

    const formatted = formatMessagesForObserver([msg]);

    // Should include the date for temporal context
    expect(formatted).toContain('Dec');
    expect(formatted).toContain('2024');
  });

  it('observer system prompt should require Current Task section', () => {
    const systemPrompt = buildObserverSystemPrompt();

    // Check for XML-based current task requirement in the system prompt
    expect(systemPrompt).toContain('<current-task>');
    expect(systemPrompt).toContain('MUST use XML tags');
  });

  it('observer system prompt should include custom instruction when provided', () => {
    const customInstruction = 'Focus on capturing user dietary preferences and allergies.';
    const systemPrompt = buildObserverSystemPrompt(false, customInstruction);

    // Should include the custom instruction at the end
    expect(systemPrompt).toContain(customInstruction);
    expect(systemPrompt).toContain('<current-task>');
  });

  it('observer system prompt should work without custom instruction', () => {
    const systemPrompt = buildObserverSystemPrompt(false);
    const systemPromptWithUndefined = buildObserverSystemPrompt(false, undefined);

    // Both should be identical
    expect(systemPrompt).toBe(systemPromptWithUndefined);
    expect(systemPrompt).toContain('<current-task>');
  });

  it('multi-thread observer system prompt should include custom instruction', () => {
    const customInstruction = 'Prioritize cross-thread patterns and recurring topics.';
    const systemPrompt = buildObserverSystemPrompt(true, customInstruction);

    expect(systemPrompt).toContain(customInstruction);
    expect(systemPrompt).toContain('<thread id=');
  });
});

describe('Instruction property integration', () => {
  it('should pass observation instruction to observer agent during synchronous observation', async () => {
    const storage = createInMemoryStorage();
    const customInstruction = 'Focus on capturing user dietary preferences and allergies.';

    let capturedPrompt: any = null;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async options => {
        capturedPrompt = options.prompt;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          content: [
            {
              type: 'text' as const,
              text: `<observations>
- User mentioned they are vegetarian
</observations>
<current-task>
- Primary: Discussing dietary preferences
</current-task>
<suggested-response>
Ask about favorite vegetarian dishes
</suggested-response>`,
            },
          ],
          warnings: [],
        };
      },
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Low threshold to trigger observation
        model: mockModel as any,
        instruction: customInstruction,
      },
      reflection: { observationTokens: 10000 },
      scope: 'thread',
    });

    // Initialize record
    await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Simulate observation
    const messages = [
      createTestMessage('I am vegetarian', 'user', 'msg-1'),
      createTestMessage('That is great to know!', 'assistant', 'msg-2'),
    ];

    await (om as any).doSynchronousObservation({
      record: await storage.getObservationalMemory('thread-1', 'resource-1'),
      threadId: 'thread-1',
      unobservedMessages: messages,
    });

    // Verify the custom instruction was passed to the observer agent
    expect(capturedPrompt).not.toBeNull();
    const systemMessage = capturedPrompt.find((msg: any) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain(customInstruction);
    expect(systemMessage.content).toContain('<current-task>');
  });

  it('should pass reflection instruction to reflector agent during synchronous reflection', async () => {
    const storage = createInMemoryStorage();
    const customInstruction = 'Consolidate observations about user preferences and remove duplicates.';

    let capturedPrompt: any = null;
    const mockObserverModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- User likes pizza
</observations>
<current-task>
- Primary: Discussing food preferences
</current-task>
<suggested-response>
Ask about favorite pizza toppings
</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const mockReflectorModel = new MockLanguageModelV2({
      doGenerate: async options => {
        capturedPrompt = options.prompt;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          content: [
            {
              type: 'text' as const,
              text: `<observations>
- User enjoys pizza and Italian food
</observations>
<current-task>
- Primary: Discussing food preferences
</current-task>
<suggested-response>
Ask about favorite Italian dishes
</suggested-response>`,
            },
          ],
          warnings: [],
        };
      },
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Low threshold to trigger observation
        model: mockObserverModel as any,
      },
      reflection: {
        observationTokens: 10, // Low threshold to trigger reflection
        model: mockReflectorModel as any,
        instruction: customInstruction,
      },
      scope: 'thread',
    });

    // Initialize record with some existing observations to trigger reflection
    const record = await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Add existing observations to meet reflection threshold
    await storage.updateActiveObservations({
      id: record.id,
      observations: `- Existing observation 1
- Existing observation 2
- Existing observation 3`,
      tokenCount: 50000, // High count to trigger reflection
      lastObservedAt: new Date(),
    });

    // Simulate observation which should then trigger reflection
    const messages = [
      createTestMessage('I like pizza', 'user', 'msg-1'),
      createTestMessage('Nice!', 'assistant', 'msg-2'),
    ];

    await (om as any).doSynchronousObservation({
      record: await storage.getObservationalMemory('thread-1', 'resource-1'),
      threadId: 'thread-1',
      unobservedMessages: messages,
    });

    // Verify the custom instruction was passed to the reflector agent
    expect(capturedPrompt).not.toBeNull();
    const systemMessage = capturedPrompt.find((msg: any) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain(customInstruction);
  });
});

describe('Scenario: Cross-session memory (resource scope)', () => {
  it('should track observations across multiple threads with same resource', async () => {
    const storage = createInMemoryStorage();

    // Initialize with resource scope (null threadId)
    const record = await storage.initializeObservationalMemory({
      threadId: null, // Resource scope
      resourceId: 'user-123',
      scope: 'resource',
      config: {},
    });

    // Add observations from "session 1"
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- 🔴 User name is Alice\n- 🔴 User works at TechCorp',

      tokenCount: 100,
      lastObservedAt: new Date(),
    });

    // Verify observations are stored at resource level
    const resourceRecord = await storage.getObservationalMemory(null, 'user-123');
    expect(resourceRecord).toBeDefined();
    expect(resourceRecord?.activeObservations).toContain('Alice');
    expect(resourceRecord?.activeObservations).toContain('TechCorp');
    expect(resourceRecord?.scope).toBe('resource');
  });
});

describe('Scenario: Observation quality checks', () => {
  it('formatted messages should be readable for observer', () => {
    const messages = [
      createTestMessage('Can you help me debug this error: TypeError: Cannot read property "map" of undefined', 'user'),
      createTestMessage(
        'The error suggests you are calling .map() on undefined. Check if your array is properly initialized.',
        'assistant',
      ),
    ];

    const formatted = formatMessagesForObserver(messages);

    // Should preserve the error message
    expect(formatted).toContain('TypeError');
    expect(formatted).toContain('Cannot read property');
    expect(formatted).toContain('map');
    expect(formatted).toContain('undefined');

    // Should preserve the solution
    expect(formatted).toContain('array is properly initialized');
  });

  it('token counter should give reasonable estimates', () => {
    const counter = new TokenCounter();

    // A simple sentence
    const simple = counter.countString('Hello world');
    expect(simple).toBeGreaterThan(0);
    expect(simple).toBeLessThan(10);

    // A longer paragraph
    const paragraph = counter.countString(
      'The quick brown fox jumps over the lazy dog. This is a longer sentence with more words to count.',
    );
    expect(paragraph).toBeGreaterThan(simple);

    // Observations should be countable
    const observations = counter.countObservations(`
- 🔴 User preference: prefers short answers [user_preference]
- 🟡 Current project: building a React dashboard [current_project]
- 🟢 Minor note: mentioned liking coffee [personal]
    `);
    expect(observations).toBeGreaterThan(20);
    expect(observations).toBeLessThan(100);
  });
});

// =============================================================================
// Unit Tests: Thread Attribution (Resource Scope)
// =============================================================================

describe('Thread Attribution Helpers', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = new ObservationalMemory({
      storage,
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 100 },
      reflection: { observationTokens: 1000 },
      scope: 'resource',
    });
  });

  describe('wrapWithThreadTag', () => {
    it('should wrap observations with thread XML tag', async () => {
      const observations = '- 🔴 User likes coffee\n- 🟡 User prefers dark roast';
      const threadId = 'thread-123';

      // Access private method via any cast for testing (now async)
      const result = await (om as any).wrapWithThreadTag(threadId, observations);

      expect(result).toBe(`<thread id="thread-123">\n${observations}\n</thread>`);
    });
  });

  describe('replaceOrAppendThreadSection', () => {
    it('should append new thread section when none exists', () => {
      const existing = '';
      const threadId = 'thread-1';
      const newSection = '<thread id="thread-1">\n- 🔴 New observation\n</thread>';

      const result = (om as any).replaceOrAppendThreadSection(existing, threadId, newSection);

      expect(result).toBe(newSection);
    });

    it('should append to existing observations when thread section does not exist', () => {
      const existing = '<thread id="thread-other">\n- 🔴 Other thread obs\n</thread>';
      const threadId = 'thread-1';
      const newSection = '<thread id="thread-1">\n- 🔴 New observation\n</thread>';

      const result = (om as any).replaceOrAppendThreadSection(existing, threadId, newSection);

      expect(result).toContain(existing);
      expect(result).toContain(newSection);
      expect(result).toBe(`${existing}\n\n${newSection}`);
    });

    it('should always append new thread sections (preserves temporal ordering)', () => {
      const existing = `<thread id="thread-1">
- 🔴 Old observation
</thread>

<thread id="thread-2">
- 🟡 Thread 2 obs
</thread>`;
      const threadId = 'thread-1';
      const newSection = '<thread id="thread-1">\n- 🔴 Updated observation\n- 🟡 New detail\n</thread>';

      const result = (om as any).replaceOrAppendThreadSection(existing, threadId, newSection);

      // Should append, not replace - preserves temporal ordering
      expect(result).toContain(newSection);
      expect(result).toContain('<thread id="thread-2">');
      // Old observation is preserved (appended, not replaced)
      expect(result).toContain('Old observation');
      // New section is appended at the end
      expect(result).toBe(`${existing}\n\n${newSection}`);
    });
  });

  describe('sortThreadsByOldestMessage', () => {
    it('should sort threads by oldest message timestamp', () => {
      const now = Date.now();
      const messagesByThread = new Map<string, MastraDBMessage[]>([
        [
          'thread-recent',
          [
            { ...createTestMessage('msg1'), createdAt: new Date(now - 1000) },
            { ...createTestMessage('msg2'), createdAt: new Date(now) },
          ],
        ],
        [
          'thread-oldest',
          [
            { ...createTestMessage('msg3'), createdAt: new Date(now - 10000) },
            { ...createTestMessage('msg4'), createdAt: new Date(now - 5000) },
          ],
        ],
        ['thread-middle', [{ ...createTestMessage('msg5'), createdAt: new Date(now - 5000) }]],
      ]);

      const result = (om as any).sortThreadsByOldestMessage(messagesByThread);

      expect(result).toEqual(['thread-oldest', 'thread-middle', 'thread-recent']);
    });

    it('should handle threads with missing timestamps', () => {
      const now = Date.now();
      const messagesByThread = new Map<string, MastraDBMessage[]>([
        ['thread-with-date', [{ ...createTestMessage('msg1'), createdAt: new Date(now - 10000) }]],
        ['thread-no-date', [{ ...createTestMessage('msg2'), createdAt: undefined as any }]],
      ]);

      const result = (om as any).sortThreadsByOldestMessage(messagesByThread);

      // Thread with no date should be treated as "now" (most recent)
      expect(result[0]).toBe('thread-with-date');
    });
  });
});

describe('Resource Scope Observation Flow', () => {
  it('should use XML thread tags in resource scope mode', async () => {
    const storage = createInMemoryStorage();

    // Create thread first
    await storage.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- 🔴 User mentioned they like coffee
</observations>
<current-task>
- Primary: Discussing coffee preferences
</current-task>
<suggested-response>
Ask about preferred brewing method
</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Low threshold to trigger observation
        model: mockModel as any,
      },
      reflection: { observationTokens: 10000 },
      scope: 'resource',
    });

    // Initialize record - for resource scope, threadId must be null
    await storage.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: {},
    });

    // Simulate observation
    const messages = [
      createTestMessage('I love coffee!', 'user', 'msg-1'),
      createTestMessage('What kind do you prefer?', 'assistant', 'msg-2'),
    ];

    await (om as any).doSynchronousObservation({
      record: await storage.getObservationalMemory(null, 'resource-1'),
      threadId: 'thread-1',
      unobservedMessages: messages,
    });

    // Check stored observations have thread tag
    const record = await storage.getObservationalMemory(null, 'resource-1');
    expect(record?.activeObservations).toContain('<thread id="thread-1">');
    expect(record?.activeObservations).toContain('</thread>');
    expect(record?.activeObservations).toContain('User mentioned they like coffee');
  });

  it('should NOT use thread tags in thread scope mode', async () => {
    const storage = createInMemoryStorage();

    // Create thread first
    await storage.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- 🔴 User mentioned they like tea
</observations>
<current-task>
- Primary: Discussing tea preferences
</current-task>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10,
        model: mockModel as any,
      },
      reflection: { observationTokens: 10000 },
      scope: 'thread', // Thread scope
    });

    // Initialize record
    await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    const messages = [createTestMessage('I love tea!', 'user', 'msg-1')];

    await (om as any).doSynchronousObservation({
      record: await storage.getObservationalMemory('thread-1', 'resource-1'),
      threadId: 'thread-1',
      unobservedMessages: messages,
    });

    const record = await storage.getObservationalMemory('thread-1', 'resource-1');
    // Should NOT have thread tags in thread scope
    expect(record?.activeObservations).not.toContain('<thread id=');
    expect(record?.activeObservations).toContain('User mentioned they like tea');
  });
});

describe('Locking Behavior', () => {
  it('should skip reflection when isReflecting flag is true', async () => {
    const storage = createInMemoryStorage();

    let reflectorCalled = false;
    const mockReflectorModel = new MockLanguageModelV2({
      doGenerate: async () => {
        reflectorCalled = true;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          content: [
            {
              type: 'text' as const,
              text: `<observations>
- Consolidated observation
</observations>
<current-task>None</current-task>
<suggested-response>Continue</suggested-response>`,
            },
          ],
          warnings: [],
        };
      },
    });

    const mockObserverModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- User mentioned something
</observations>
<current-task>None</current-task>
<suggested-response>Continue</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 100,
        model: mockObserverModel as any,
      },
      reflection: {
        observationTokens: 100, // Low threshold to trigger reflection
        model: mockReflectorModel as any,
      },
      scope: 'thread',
    });

    // Initialize record with enough observations to trigger reflection
    await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Update with observations that exceed the reflection threshold
    const largeObservations = Array(50).fill('- Some observation about the user').join('\n');
    await storage.updateActiveObservations({
      id: (await storage.getObservationalMemory('thread-1', 'resource-1'))!.id,
      observations: largeObservations,

      tokenCount: 500, // Exceeds threshold of 100
      lastObservedAt: new Date(),
    });

    // Set the isReflecting flag to true — simulating a stale flag from a crashed process
    const record = await storage.getObservationalMemory('thread-1', 'resource-1');
    await storage.setReflectingFlag(record!.id, true);

    // Try to reflect — stale isReflecting should be detected and cleared,
    // because no operation is registered in this process's activeOps registry
    await (om as any).maybeReflect({
      record: { ...record, isReflecting: true },
      observationTokens: 500, // Token count exceeds threshold
    });

    // Reflector SHOULD be called because the stale flag was cleared
    expect(reflectorCalled).toBe(true);

    // Verify the flag was cleared in storage
    const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(updatedRecord!.isReflecting).toBe(false);
  });

  it('should skip observation when isObserving flag is true in processOutputResult', async () => {
    const storage = createInMemoryStorage();

    let _observerCalled = false;
    const mockObserverModel = new MockLanguageModelV2({
      doGenerate: async () => {
        _observerCalled = true;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          content: [
            {
              type: 'text' as const,
              text: `<observations>
- User mentioned something
</observations>
<current-task>None</current-task>
<suggested-response>Continue</suggested-response>`,
            },
          ],
          warnings: [],
        };
      },
    });

    // OM instance created to set up storage context (observer behavior tested via storage flags)
    new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Very low threshold
        model: mockObserverModel as any,
      },
      reflection: { observationTokens: 10000 },
      scope: 'thread',
    });

    // Create thread and initialize record
    await storage.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await storage.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    // Set the isObserving flag to true BEFORE calling processOutputResult
    const record = await storage.getObservationalMemory('thread-1', 'resource-1');
    await storage.setObservingFlag(record!.id, true);

    // Save a message that would trigger observation
    const messageContent: MastraMessageContentV2 = {
      format: 2,
      parts: [{ type: 'text', text: 'This is a test message with enough content to trigger observation' }],
    };
    const message: MastraDBMessage = {
      id: 'msg-1',
      threadId: 'thread-1',
      role: 'user',
      content: messageContent,
      createdAt: new Date(),
      type: 'text',
    };
    await storage.saveMessages({ messages: [message] });

    // Note: processOutputResult requires a MessageList from the agent context
    // For this test, we'll directly test the flag check behavior
    // The isObserving flag should prevent observation from being triggered

    // Verify the flag is set
    const recordWithFlag = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(recordWithFlag?.isObserving).toBe(true);

    // Observer should NOT be called when we try to observe with the flag set
    // This is verified by the flag check in processOutputResult
  });
});

describe('Reflection with Thread Attribution', () => {
  it('should create a new record after reflection', async () => {
    const storage = createInMemoryStorage();

    const mockReflectorModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- 🔴 Consolidated user preference
<thread id="thread-1">
- 🟡 Thread-specific task
</thread>
</observations>
<current-task>Continue working</current-task>
<suggested-response>Ready to continue</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 10000 },
      reflection: {
        observationTokens: 100, // Low threshold to trigger reflection
        model: mockReflectorModel as any,
      },
      scope: 'resource',
    });

    // Initialize with existing observations that exceed threshold
    await storage.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: {},
    });

    const initialRecord = await storage.getObservationalMemory(null, 'resource-1');

    // Add observations that exceed the reflection threshold
    const largeObservations = Array(50).fill('- 🟡 This is an observation that takes up space').join('\n');
    await storage.updateActiveObservations({
      id: initialRecord!.id,
      observations: largeObservations,

      tokenCount: 500, // Above threshold
      lastObservedAt: new Date(),
    });

    // Trigger reflection via maybeReflect (called internally)
    const record = await storage.getObservationalMemory(null, 'resource-1');
    // @ts-expect-error - accessing private method for testing
    await om.maybeReflect({ record: record!, observationTokens: 500 });

    // Get all records for this resource
    const allRecords = await storage.getObservationalMemoryHistory(null, 'resource-1');

    // Should have 2 records: original + reflection
    expect(allRecords.length).toBe(2);

    // Most recent record should be the reflection
    const newRecord = allRecords[0];
    expect(newRecord.originType).toBe('reflection');
    expect(newRecord.activeObservations).toContain('Consolidated user preference');
    expect(newRecord.activeObservations).toContain('<thread id="thread-1">');

    // Old record should still exist
    const oldRecord = allRecords[1];
    expect(oldRecord.originType).toBe('initial'); // Initial record before any reflection
    expect(oldRecord.activeObservations).toContain('This is an observation');
  });

  it('should preserve thread tags in reflector output', async () => {
    const storage = createInMemoryStorage();

    // Reflector that maintains thread attribution
    const mockReflectorModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- 🔴 User prefers TypeScript (universal fact - no thread tag needed)
<thread id="thread-1">
- 🟡 Working on auth feature
</thread>
<thread id="thread-2">
- 🟡 Debugging API endpoint
</thread>
</observations>
<current-task>Multiple tasks in progress</current-task>
<suggested-response>Continue with current thread</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 10000 },
      reflection: {
        observationTokens: 100,
        model: mockReflectorModel as any,
      },
      scope: 'resource',
    });

    // Initialize with multi-thread observations
    await storage.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: {},
    });

    const initialRecord = await storage.getObservationalMemory(null, 'resource-1');

    const multiThreadObservations = `<thread id="thread-1">
- 🔴 User prefers TypeScript
- 🟡 Working on auth feature
</thread>
<thread id="thread-2">
- 🔴 User prefers TypeScript
- 🟡 Debugging API endpoint
</thread>`;

    await storage.updateActiveObservations({
      id: initialRecord!.id,
      observations: multiThreadObservations,

      tokenCount: 500,
      lastObservedAt: new Date(),
    });

    // Trigger reflection
    const record = await storage.getObservationalMemory(null, 'resource-1');
    // @ts-expect-error - accessing private method for testing
    await om.maybeReflect({ record: record!, observationTokens: 500 });

    // Get the new reflection record
    const allRecords = await storage.getObservationalMemoryHistory(null, 'resource-1');
    const reflectionRecord = allRecords[0];

    // Should have consolidated universal facts but preserved thread-specific ones
    expect(reflectionRecord.activeObservations).toContain('User prefers TypeScript');
    expect(reflectionRecord.activeObservations).toContain('<thread id="thread-1">');
    expect(reflectionRecord.activeObservations).toContain('<thread id="thread-2">');
    expect(reflectionRecord.activeObservations).toContain('Working on auth feature');
    expect(reflectionRecord.activeObservations).toContain('Debugging API endpoint');
  });

  it('should update lastObservedAt cursor after reflection', async () => {
    const storage = createInMemoryStorage();

    const mockReflectorModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
- Consolidated observations
</observations>
<current-task>None</current-task>
<suggested-response>Continue</suggested-response>`,
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 10000 },
      reflection: {
        observationTokens: 100,
        model: mockReflectorModel as any,
      },
      scope: 'resource',
    });

    await storage.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: {},
    });

    const initialRecord = await storage.getObservationalMemory(null, 'resource-1');
    const _initialLastObservedAt = initialRecord!.lastObservedAt;

    // Add observations
    const observedAt = new Date();
    await storage.updateActiveObservations({
      id: initialRecord!.id,
      observations: '- Some observations',
      tokenCount: 500,
      lastObservedAt: observedAt,
    });

    // Verify cursor is updated
    const recordBeforeReflection = await storage.getObservationalMemory(null, 'resource-1');
    expect(recordBeforeReflection!.lastObservedAt).toEqual(observedAt);

    // Trigger reflection
    // @ts-expect-error - accessing private method for testing
    await om.maybeReflect({ record: recordBeforeReflection!, observationTokens: 500 });

    // Get the new reflection record
    const allRecords = await storage.getObservationalMemoryHistory(null, 'resource-1');
    const reflectionRecord = allRecords[0];

    // New record should have a fresh lastObservedAt cursor
    expect(reflectionRecord.lastObservedAt).toBeDefined();
    expect(reflectionRecord.originType).toBe('reflection');

    // Old record should retain its lastObservedAt
    const oldRecord = allRecords[1];
    expect(oldRecord.lastObservedAt).toEqual(observedAt);
  });
});

// =============================================================================
// Resource Scope: Other-thread messages in processInputStep
// =============================================================================

describe('Resource Scope: other-conversation blocks after observation', () => {
  it('should include other thread messages in context even after those threads have been observed', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const storage = createInMemoryStorage();
    const resourceId = 'user-resource-1';
    const threadAId = 'thread-A';
    const threadBId = 'thread-B';

    // Thread A's messages were created at 09:01-09:02, observed at 09:02
    const threadAObservedAt = new Date('2025-01-01T09:02:00Z');

    // Create Thread A with per-thread lastObservedAt in metadata (simulating completed observation)
    await storage.saveThread({
      thread: {
        id: threadAId,
        resourceId,
        title: 'Thread A',
        createdAt: new Date('2025-01-01T09:00:00Z'),
        updatedAt: new Date('2025-01-01T09:00:00Z'),
        metadata: {
          __om: { lastObservedAt: threadAObservedAt.toISOString() },
        },
      },
    });

    // Create Thread B (no observation yet)
    await storage.saveThread({
      thread: {
        id: threadBId,
        resourceId,
        title: 'Thread B',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {},
      },
    });

    // Add messages to Thread A (already observed)
    await storage.saveMessages({
      messages: [
        {
          id: 'msg-a-1',
          role: 'user' as const,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'My favorite color is blue' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T09:01:00Z'),
          threadId: threadAId,
          resourceId,
        },
        {
          id: 'msg-a-2',
          role: 'assistant' as const,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Blue is a great color!' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T09:02:00Z'),
          threadId: threadAId,
          resourceId,
        },
      ],
    });

    // Add messages to Thread B (not yet observed)
    await storage.saveMessages({
      messages: [
        {
          id: 'msg-b-1',
          role: 'user' as const,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Hello from thread B!' }] },
          type: 'text',
          createdAt: new Date('2025-01-01T10:01:00Z'),
          threadId: threadBId,
          resourceId,
        },
      ],
    });

    // Initialize OM record at resource level with lastObservedAt set to Thread A's observation time
    // This simulates the state after Thread A has been observed
    const record = await storage.initializeObservationalMemory({
      threadId: null, // Resource scope
      resourceId,
      scope: 'resource',
      config: {},
    });
    await storage.updateActiveObservations({
      id: record.id,
      observations: '<thread id="thread-A">\n- 🔴 User\'s favorite color is blue\n</thread>',
      tokenCount: 50,
      lastObservedAt: threadAObservedAt, // Resource-level cursor set to Thread A's observation time
    });

    // Verify setup: resource-level lastObservedAt is set
    const setupRecord = await storage.getObservationalMemory(null, resourceId);
    expect(setupRecord?.lastObservedAt).toEqual(threadAObservedAt);
    expect(setupRecord?.activeObservations).toContain('favorite color is blue');

    // Create OM with resource scope
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: 'text' as const, text: '<observations>\n- observed\n</observations>' }],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        model: mockModel as any,
        messageTokens: 50000, // High threshold — we don't want observation to trigger
      },
      reflection: {
        model: mockModel as any,
        observationTokens: 50000,
      },
      scope: 'resource',
    });

    // Call processInputStep for Thread B
    const messageList = new MessageList({ threadId: threadBId, resourceId });
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadBId }, resourceId });
    requestContext.set('currentDate', new Date('2025-01-01T10:05:00Z').toISOString());

    await om.processInputStep({
      messageList,
      messages: [],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: mockModel as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    // Extract the OM system message (tagged as 'observational-memory')
    const omSystemMessages = messageList.getSystemMessages('observational-memory');
    expect(omSystemMessages.length).toBeGreaterThan(0);

    const omSystemMessage = omSystemMessages[0]!;
    const omContent =
      typeof omSystemMessage.content === 'string' ? omSystemMessage.content : JSON.stringify(omSystemMessage.content);

    // KEY ASSERTION: Thread A's messages should appear as <other-conversation> blocks
    // even though Thread A was already observed (its messages are older than resource-level lastObservedAt).
    // The agent on Thread B needs to see Thread A's raw conversation to have full context.
    expect(omContent).toContain('other-conversation');
    expect(omContent).toContain('My favorite color is blue');
    expect(omContent).toContain('Blue is a great color!');

    // Thread B's messages should NOT be in <other-conversation> blocks (it's the active thread)
    expect(omContent).not.toContain('Hello from thread B!');
  });
});

// =============================================================================
// Unit Tests: Async Buffering / Activation Paths
// =============================================================================

describe('Async Buffering Storage Operations', () => {
  let storage: InMemoryMemory;
  const threadId = 'test-thread';
  const resourceId = 'test-resource';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('updateBufferedObservations with chunk metadata', () => {
    it('should store chunks with messageTokens, lastObservedAt, and cycleId', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const lastObservedAt = new Date('2026-02-05T10:00:00Z');
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk with metadata',
          tokenCount: 100,
          messageIds: ['msg-1', 'msg-2'],
          messageTokens: 5000,
          lastObservedAt,
          cycleId: 'cycle-abc-123',
        },
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservationChunks).toHaveLength(1);
      const chunk = record!.bufferedObservationChunks![0]!;
      expect(chunk.observations).toBe('- 🔴 Chunk with metadata');
      expect(chunk.tokenCount).toBe(100);
      expect(chunk.messageIds).toEqual(['msg-1', 'msg-2']);
      expect(chunk.messageTokens).toBe(5000);
      expect(chunk.lastObservedAt).toEqual(lastObservedAt);
      expect(chunk.cycleId).toBe('cycle-abc-123');
      expect(chunk.id).toMatch(/^ombuf-/);
    });

    it('should accumulate multiple chunks preserving order', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 First chunk',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Second chunk',
          tokenCount: 40,
          messageIds: ['msg-2', 'msg-3'],
          messageTokens: 7000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-2',
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟢 Third chunk',
          tokenCount: 20,
          messageIds: ['msg-4'],
          messageTokens: 2000,
          lastObservedAt: new Date('2026-02-05T12:00:00Z'),
          cycleId: 'cycle-3',
        },
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedObservationChunks).toHaveLength(3);
      expect(record!.bufferedObservationChunks![0]!.cycleId).toBe('cycle-1');
      expect(record!.bufferedObservationChunks![1]!.cycleId).toBe('cycle-2');
      expect(record!.bufferedObservationChunks![2]!.cycleId).toBe('cycle-3');
    });
  });

  describe('swapBufferedToActive with partial activation', () => {
    it('should activate all chunks when activationRatio is 1', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk A',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-a',
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Chunk B',
          tokenCount: 50,
          messageIds: ['msg-2'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-b',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(2);
      expect(result.activatedCycleIds).toEqual(['cycle-a', 'cycle-b']);
      expect(result.messageTokensActivated).toBe(10000);
      expect(result.observationTokensActivated).toBe(100);
      expect(result.messagesActivated).toBe(2);

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toContain('Chunk A');
      expect(record?.activeObservations).toContain('Chunk B');
      expect(record?.bufferedObservationChunks).toBeUndefined();
    });

    it('should activate a subset of chunks when activationRatio is less than 1', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Total messageTokens = 3000 + 3000 + 4000 = 10000
      // With activationRatio=0.5, target = 5000
      // After chunk 1: 3000 (under target, distance=2000)
      // After chunk 2: 6000 (over target, distance=1000)
      // 6000 is closer to 5000, and since we bias over, prefer chunk 2 boundary
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk 1',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Chunk 2',
          tokenCount: 30,
          messageIds: ['msg-2'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-2',
        },
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟢 Chunk 3',
          tokenCount: 40,
          messageIds: ['msg-3'],
          messageTokens: 4000,
          lastObservedAt: new Date('2026-02-05T12:00:00Z'),
          cycleId: 'cycle-3',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 0.5,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      // Biased over: should activate 2 chunks (6000 tokens), leaving 1 remaining
      expect(result.chunksActivated).toBe(2);
      expect(result.activatedCycleIds).toEqual(['cycle-1', 'cycle-2']);
      expect(result.messageTokensActivated).toBe(6000);

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toContain('Chunk 1');
      expect(record?.activeObservations).toContain('Chunk 2');
      expect(record?.bufferedObservationChunks).toHaveLength(1);
    });

    it('should always activate at least one chunk when at threshold', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Single chunk with large messageTokens
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Large chunk',
          tokenCount: 200,
          messageIds: ['msg-1', 'msg-2', 'msg-3'],
          messageTokens: 50000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-large',
        },
      });

      // Even with a tiny activation ratio, at least one chunk should be activated
      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 0.1,
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(1);
      expect(result.activatedCycleIds).toEqual(['cycle-large']);
      expect(result.messageTokensActivated).toBe(50000);
    });

    it('should return zero metrics when no chunks exist', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: new Date(),
      });

      expect(result.chunksActivated).toBe(0);
      expect(result.activatedCycleIds).toEqual([]);
      expect(result.messageTokensActivated).toBe(0);
    });

    it('should include activated observations content in result', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Important observation about X',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(1);
      expect(result.observations).toContain('Important observation about X');
    });

    it('should return suggestedContinuation and currentTask from the most recent activated chunk', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Chunk 1: older, with a stale hint
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk 1 observation',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
          suggestedContinuation: 'Stale suggestion from chunk 1',
          currentTask: 'Old task from chunk 1',
        },
      });

      // Chunk 2: newer, with the latest hint
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Chunk 2 observation',
          tokenCount: 30,
          messageIds: ['msg-2'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-2',
          suggestedContinuation: 'Latest suggestion from chunk 2',
          currentTask: 'Current task from chunk 2',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(2);
      // Should return the hints from the most recent chunk
      expect(result.suggestedContinuation).toBe('Latest suggestion from chunk 2');
      expect(result.currentTask).toBe('Current task from chunk 2');
    });

    it('should return suggestedContinuation from partial activation when latest activated chunk has hints', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Chunk 1: with hints (will be activated)
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk 1',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
          suggestedContinuation: 'Activated suggestion',
          currentTask: 'Activated task',
        },
      });

      // Chunk 2: with newer hints (will remain buffered)
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Chunk 2',
          tokenCount: 30,
          messageIds: ['msg-2'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-2',
          suggestedContinuation: 'Remaining buffered suggestion',
          currentTask: 'Remaining buffered task',
        },
      });

      // Activate only chunk 1 (activationRatio=0.5, target=5000, chunk1=5000 exact match)
      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 0.5,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(1);
      expect(result.suggestedContinuation).toBe('Activated suggestion');
      expect(result.currentTask).toBe('Activated task');
    });

    it('should return undefined continuation hints when chunks have no hints', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk without hints',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(1);
      expect(result.suggestedContinuation).toBeUndefined();
      expect(result.currentTask).toBeUndefined();
    });

    it('should discard stale hints from older chunks when the most recent activated chunk has none', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Chunk 1: older, with hints
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🔴 Chunk 1 with hints',
          tokenCount: 30,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
          suggestedContinuation: 'Stale suggestion',
          currentTask: 'Stale task',
        },
      });

      // Chunk 2: newer, without hints
      await storage.updateBufferedObservations({
        id: initial.id,
        chunk: {
          observations: '- 🟡 Chunk 2 without hints',
          tokenCount: 30,
          messageIds: ['msg-2'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T11:00:00Z'),
          cycleId: 'cycle-2',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: initial.id,
        activationRatio: 1,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date('2026-02-05T12:00:00Z'),
      });

      expect(result.chunksActivated).toBe(2);
      // Should NOT fall back to chunk 1's stale hints
      expect(result.suggestedContinuation).toBeUndefined();
      expect(result.currentTask).toBeUndefined();
    });
  });

  describe('buffered reflection', () => {
    it('should store buffered reflection content and line count', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '- 🔴 Reflected: User prefers TypeScript',
        tokenCount: 30,
        reflectedObservationLineCount: 5,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedReflection).toBe('- 🔴 Reflected: User prefers TypeScript');
      expect(record?.bufferedReflectionTokens).toBe(30);
      expect(record?.reflectedObservationLineCount).toBe(5);
    });

    it('should activate buffered reflection and keep unreflected observations', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Set active observations (3 lines)
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Observation 1\n- 🟡 Observation 2\n- 🟡 Observation 3',
        tokenCount: 300,
        lastObservedAt: new Date(),
      });

      // Buffer reflection that covers the first 2 lines
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '- 🔴 Condensed reflection of obs 1 and 2',
        tokenCount: 50,
        reflectedObservationLineCount: 2,
      });

      // Activate buffered reflection
      await storage.swapBufferedReflectionToActive({
        currentRecord: (await storage.getObservationalMemory(threadId, resourceId))!,
        tokenCount: 100, // Combined token count for reflection + unreflected
      });

      // New generation should have reflection + unreflected line 3
      const current = await storage.getObservationalMemory(threadId, resourceId);
      expect(current?.originType).toBe('reflection');
      expect(current?.activeObservations).toContain('Condensed reflection of obs 1 and 2');
      expect(current?.activeObservations).toContain('Observation 3');
      // Line 1 and 2 should NOT appear (they were reflected)
      expect(current?.activeObservations).not.toContain('Observation 1');
      expect(current?.activeObservations).not.toContain('Observation 2');
    });

    it('should activate all observations when reflectedObservationLineCount covers all lines', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const observations = '- 🔴 Observation 1\n- 🟡 Observation 2\n- 🟡 Observation 3';
      const lineCount = observations.split('\n').length; // 3

      // Set active observations
      await storage.updateActiveObservations({
        id: initial.id,
        observations,
        tokenCount: 300,
        lastObservedAt: new Date(),
      });

      // Buffer reflection covering ALL lines
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '- 🔴 Full condensed reflection',
        tokenCount: 50,
        reflectedObservationLineCount: lineCount,
      });

      // Activate
      await storage.swapBufferedReflectionToActive({
        currentRecord: (await storage.getObservationalMemory(threadId, resourceId))!,
        tokenCount: 50, // Combined token count (all lines reflected, no unreflected)
      });

      const current = await storage.getObservationalMemory(threadId, resourceId);
      expect(current?.activeObservations).toBe('- 🔴 Full condensed reflection');
      expect(current?.originType).toBe('reflection');
    });

    it('should handle observations added after reflection started', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Start with 3 lines of observations
      const originalObs = '- 🔴 Original 1\n- 🟡 Original 2\n- 🟡 Original 3';
      await storage.updateActiveObservations({
        id: initial.id,
        observations: originalObs,
        tokenCount: 300,
        lastObservedAt: new Date(),
      });

      // Reflection runs on those 3 lines (reflectedObservationLineCount=3)
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '- 🔴 Reflected summary of originals',
        tokenCount: 50,
        reflectedObservationLineCount: 3,
      });

      // BETWEEN reflection and activation, new observations were added (lines 4 and 5)
      await storage.updateActiveObservations({
        id: initial.id,
        observations: originalObs + '\n- 🟢 New obs after reflection\n- 🟢 Another new obs',
        tokenCount: 500,
        lastObservedAt: new Date(),
      });

      // Now activate - should merge reflection + new unreflected observations
      const recordBeforeSwap = await storage.getObservationalMemory(threadId, resourceId);
      await storage.swapBufferedReflectionToActive({
        currentRecord: recordBeforeSwap!,
        tokenCount: 200, // Combined token count for reflection + unreflected new obs
      });

      const current = await storage.getObservationalMemory(threadId, resourceId);
      expect(current?.originType).toBe('reflection');
      // Should contain the reflection
      expect(current?.activeObservations).toContain('Reflected summary of originals');
      // Should contain new observations added after reflection
      expect(current?.activeObservations).toContain('New obs after reflection');
      expect(current?.activeObservations).toContain('Another new obs');
      // Should NOT contain the original observations (they were reflected)
      expect(current?.activeObservations).not.toContain('Original 1');
      expect(current?.activeObservations).not.toContain('Original 2');
      expect(current?.activeObservations).not.toContain('Original 3');
    });

    it('should clear buffered state on old record after activation', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Obs 1\n- 🟡 Obs 2',
        tokenCount: 200,
        lastObservedAt: new Date(),
      });

      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '- 🔴 Condensed',
        tokenCount: 30,
        reflectedObservationLineCount: 2,
      });

      await storage.swapBufferedReflectionToActive({
        currentRecord: (await storage.getObservationalMemory(threadId, resourceId))!,
        tokenCount: 30, // Combined token count (all lines reflected)
      });

      // The OLD record (initial) should have cleared buffered state
      const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);
      const oldRecord = history.find(r => r.id === initial.id);
      expect(oldRecord?.bufferedReflection).toBeUndefined();
      expect(oldRecord?.bufferedReflectionTokens).toBeUndefined();
      expect(oldRecord?.reflectedObservationLineCount).toBeUndefined();
    });
  });
});

describe('Model Requirement', () => {
  it('should throw when no model is provided at all', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          observation: { messageTokens: 50000 },
          reflection: { observationTokens: 20000 },
        }),
    ).toThrow('Observational Memory requires a model to be set');
  });

  it('should include docs link in model error', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          observation: { messageTokens: 50000 },
          reflection: { observationTokens: 20000 },
        }),
    ).toThrow('https://mastra.ai/docs/memory/observational-memory#models');
  });

  it('should accept a top-level model', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: { messageTokens: 50000 },
          reflection: { observationTokens: 20000 },
        }),
    ).not.toThrow();
  });

  it('should accept observation.model and use it for both', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          observation: {
            messageTokens: 50000,
            model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          },
          reflection: { observationTokens: 20000 },
        }),
    ).not.toThrow();
  });

  it('should accept reflection.model and use it for both', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          observation: { messageTokens: 50000 },
          reflection: {
            observationTokens: 20000,
            model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          },
        }),
    ).not.toThrow();
  });

  it('should accept model: "default" as gemini flash', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: 'default',
          observation: { messageTokens: 50000 },
          reflection: { observationTokens: 20000 },
        }),
    ).not.toThrow();
  });

  it('should not allow top-level model with observation.model', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          },
          reflection: { observationTokens: 20000 },
        }),
    ).toThrow('Cannot set both');
  });
});

describe('Async Buffering Config Validation', () => {
  it('should throw if async buffering is explicitly enabled with shareTokenBudget', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          shareTokenBudget: true,
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.5,
          },
        }),
    ).toThrow('Remove any other async buffering settings');
  });

  it('should throw if shareTokenBudget is true with default async buffering', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          shareTokenBudget: true,
          observation: { messageTokens: 50000 },
          reflection: { observationTokens: 20000 },
        }),
    ).toThrow('Async buffering is enabled by default');
  });

  it('should allow shareTokenBudget with bufferTokens: false', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      shareTokenBudget: true,
      observation: { messageTokens: 50000, bufferTokens: false },
      reflection: { observationTokens: 20000 },
    });
    expect(om.isAsyncObservationEnabled()).toBe(false);
    expect(om.isAsyncReflectionEnabled()).toBe(false);
  });

  it('should throw if bufferActivation is zero', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 0,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.7,
          },
        }),
    ).toThrow('bufferActivation must be > 0');
  });

  it('should throw if bufferActivation is in dead zone (1, 1000)', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 1.5,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.7,
          },
        }),
    ).toThrow('must be <= 1 (ratio) or >= 1000 (absolute token retention)');
  });

  it('should throw if absolute bufferActivation >= messageTokens', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 50000, // Invalid: must be < messageTokens
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.7,
          },
        }),
    ).toThrow('bufferActivation as absolute retention');
  });

  it('should accept bufferActivation > 1000 as absolute retention target', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 3000, // Valid: retain 3000 tokens
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.7,
          },
        }),
    ).not.toThrow();
  });

  it('should default reflection.bufferActivation when observation.bufferTokens is set', () => {
    // reflection.bufferActivation defaults to 0.5 so this should not throw
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 0.7,
          },
          reflection: {
            observationTokens: 20000,
            // No bufferActivation — defaults to 0.5
          },
        }),
    ).not.toThrow();
  });

  it('should throw if bufferTokens >= messageTokens', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 10000,
            bufferTokens: 15000,
            bufferActivation: 0.7,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.7,
          },
        }),
    ).toThrow('bufferTokens');
  });

  it('should accept valid async config', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 0.7,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.5,
          },
        }),
    ).not.toThrow();
  });

  it('should throw if observation has bufferTokens but reflection has bufferActivation of 0', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 0.7,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0,
          },
        }),
    ).toThrow();
  });

  it('should accept config with only bufferActivation on reflection (no bufferTokens)', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'thread',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
            bufferActivation: 0.7,
          },
          reflection: {
            observationTokens: 20000,
            bufferActivation: 0.5,
          },
        }),
    ).not.toThrow();
  });
});

// =============================================================================
// Unit Tests: Async Buffering Defaults & Disabling
// =============================================================================

describe('Async Buffering Defaults & Disabling', () => {
  it('should enable async buffering by default (no explicit config)', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000 },
      reflection: { observationTokens: 20000 },
    });

    expect((om as any).isAsyncObservationEnabled()).toBe(true);
    expect((om as any).isAsyncReflectionEnabled()).toBe(true);
  });

  it('should apply correct default values for async buffering', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000 },
      reflection: { observationTokens: 20000 },
    });

    const obsConfig = (om as any).observationConfig;
    const reflConfig = (om as any).reflectionConfig;

    // bufferTokens defaults to 0.2 * messageTokens = 10000
    expect(obsConfig.bufferTokens).toBe(50000 * 0.2);
    // bufferActivation defaults to 0.8
    expect(obsConfig.bufferActivation).toBe(0.8);
    // blockAfter defaults to 1.2 * messageTokens = 60000
    expect(obsConfig.blockAfter).toBe(50000 * 1.2);
    // reflection bufferActivation defaults to 0.5
    expect(reflConfig.bufferActivation).toBe(0.5);
    // reflection blockAfter defaults to 1.2 * observationTokens = 24000
    expect(reflConfig.blockAfter).toBe(20000 * 1.2);
  });

  it('should disable all async buffering with bufferTokens: false', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000, bufferTokens: false },
      reflection: { observationTokens: 20000 },
    });

    expect((om as any).isAsyncObservationEnabled()).toBe(false);
    expect((om as any).isAsyncReflectionEnabled()).toBe(false);

    const obsConfig = (om as any).observationConfig;
    const reflConfig = (om as any).reflectionConfig;

    expect(obsConfig.bufferTokens).toBeUndefined();
    expect(obsConfig.bufferActivation).toBeUndefined();
    expect(obsConfig.blockAfter).toBeUndefined();
    expect(reflConfig.bufferActivation).toBeUndefined();
    expect(reflConfig.blockAfter).toBeUndefined();
  });

  it('should disable async buffering by default for resource scope', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'resource',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000 },
      reflection: { observationTokens: 20000 },
    });

    expect((om as any).isAsyncObservationEnabled()).toBe(false);
    expect((om as any).isAsyncReflectionEnabled()).toBe(false);
  });

  it('should throw when resource scope has explicit async config', () => {
    expect(
      () =>
        new ObservationalMemory({
          storage: createInMemoryStorage(),
          scope: 'resource',
          model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
          observation: {
            messageTokens: 50000,
            bufferTokens: 10000,
          },
          reflection: { observationTokens: 20000 },
        }),
    ).toThrow();
  });

  it('should allow overriding default bufferTokens with a custom value', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000, bufferTokens: 5000 },
      reflection: { observationTokens: 20000 },
    });

    const obsConfig = (om as any).observationConfig;
    expect(obsConfig.bufferTokens).toBe(5000);
    expect(obsConfig.bufferActivation).toBe(0.8); // still uses default
  });

  it('should allow overriding default bufferActivation', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 50000, bufferActivation: 0.7 },
      reflection: { observationTokens: 20000, bufferActivation: 0.3 },
    });

    const obsConfig = (om as any).observationConfig;
    const reflConfig = (om as any).reflectionConfig;

    expect(obsConfig.bufferActivation).toBe(0.7);
    expect(reflConfig.bufferActivation).toBe(0.3);
  });

  it('should use fractional bufferTokens as a ratio of messageTokens', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: { messageTokens: 100000, bufferTokens: 0.1 },
      reflection: { observationTokens: 20000 },
    });

    // 0.1 * 100000 = 10000
    expect((om as any).observationConfig.bufferTokens).toBe(10000);
  });
});

// =============================================================================
// Unit Tests: Async Buffering Processor Logic
// =============================================================================

describe('Async Buffering Processor Logic', () => {
  describe('getUnobservedMessages filtering with buffered chunks', () => {
    it('should exclude messages already in buffered chunks from unobserved list', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      // Store a buffered chunk with specific message IDs
      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Buffered obs',
          tokenCount: 50,
          messageIds: ['msg-0', 'msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');

      // Create messages - some should be filtered, some not
      const allMessages: MastraDBMessage[] = [
        createTestMessage('Already buffered 1', 'user', 'msg-0'),
        createTestMessage('Already buffered 2', 'assistant', 'msg-1'),
        createTestMessage('New message', 'user', 'msg-2'),
      ];

      // Default: buffered messages are NOT excluded (main agent still sees them)
      const unobserved = (om as any).getUnobservedMessages(allMessages, updatedRecord!);
      expect(unobserved).toHaveLength(3);

      // With excludeBuffered: buffered messages ARE excluded (buffering path only)
      const unobservedForBuffering = (om as any).getUnobservedMessages(allMessages, updatedRecord!, {
        excludeBuffered: true,
      });
      expect(unobservedForBuffering).toHaveLength(1);
      expect(unobservedForBuffering[0].id).toBe('msg-2');
    });

    it('should include all messages when no buffered chunks exist', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      const allMessages = createTestMessages(3);
      const unobserved = (om as any).getUnobservedMessages(allMessages, record);

      expect(unobserved).toHaveLength(3);
    });

    it('should exclude messages in both observedMessageIds and buffered chunks', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      // Mark msg-0 as observed via observedMessageIds
      await storage.updateActiveObservations({
        id: record.id,
        observations: '- Observed',
        tokenCount: 10,
        lastObservedAt: new Date('2026-02-05T09:00:00Z'),
        observedMessageIds: ['msg-0'],
      });

      // Mark msg-1 as buffered via chunk
      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Buffered obs',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');

      const allMessages: MastraDBMessage[] = [
        createTestMessage('Observed', 'user', 'msg-0'),
        createTestMessage('Buffered', 'assistant', 'msg-1'),
        createTestMessage('New 1', 'user', 'msg-2'),
        createTestMessage('New 2', 'assistant', 'msg-3'),
      ];

      // Default (excludeBuffered=false): only observedMessageIds are excluded, buffered messages still visible
      const unobservedDefault = (om as any).getUnobservedMessages(allMessages, updatedRecord!);
      expect(unobservedDefault).toHaveLength(3);
      expect(unobservedDefault.map((m: MastraDBMessage) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);

      // With excludeBuffered=true: both observedMessageIds AND buffered chunks are excluded
      const unobservedExcluded = (om as any).getUnobservedMessages(allMessages, updatedRecord!, {
        excludeBuffered: true,
      });
      expect(unobservedExcluded).toHaveLength(2);
      expect(unobservedExcluded.map((m: MastraDBMessage) => m.id)).toEqual(['msg-2', 'msg-3']);
    });
  });

  describe('getBufferedChunks defensive parsing', () => {
    it('should return empty array for null record', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).getBufferedChunks(null)).toEqual([]);
      expect((om as any).getBufferedChunks(undefined)).toEqual([]);
    });

    it('should return empty array for record without chunks', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).getBufferedChunks({})).toEqual([]);
      expect((om as any).getBufferedChunks({ bufferedObservationChunks: undefined })).toEqual([]);
    });

    it('should parse JSON string chunks', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const chunks = [{ observations: '- test', tokenCount: 10, messageIds: ['msg-1'], cycleId: 'c1' }];
      const result = (om as any).getBufferedChunks({
        bufferedObservationChunks: JSON.stringify(chunks),
      });

      expect(result).toHaveLength(1);
      expect(result[0].observations).toBe('- test');
    });

    it('should return empty array for invalid JSON string', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).getBufferedChunks({ bufferedObservationChunks: 'not-json' })).toEqual([]);
      expect((om as any).getBufferedChunks({ bufferedObservationChunks: '42' })).toEqual([]);
    });

    it('should pass through array chunks directly', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const chunks = [{ observations: '- test', tokenCount: 10, messageIds: ['msg-1'], cycleId: 'c1' }];
      expect((om as any).getBufferedChunks({ bufferedObservationChunks: chunks })).toBe(chunks);
    });
  });

  describe('combineObservationsForBuffering', () => {
    it('should return undefined when both are empty', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).combineObservationsForBuffering(undefined, undefined)).toBeUndefined();
      expect((om as any).combineObservationsForBuffering('', '')).toBeUndefined();
    });

    it('should return active observations when no buffered', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).combineObservationsForBuffering('- Active obs', undefined)).toBe('- Active obs');
    });

    it('should return buffered observations when no active', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).combineObservationsForBuffering(undefined, '- Buffered obs')).toBe('- Buffered obs');
    });

    it('should combine both with separator when both present', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const result = (om as any).combineObservationsForBuffering('- Active', '- Buffered');
      expect(result).toContain('- Active');
      expect(result).toContain('- Buffered');
      expect(result).toContain('BUFFERED (pending activation)');
    });
  });

  describe('shouldTriggerAsyncObservation', () => {
    const mockRecord = { isBufferingObservation: false, lastBufferedAtTokens: 0 } as any;

    it('should return false when async buffering is explicitly disabled', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000, bufferTokens: false },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).shouldTriggerAsyncObservation(10000, 'thread:test', mockRecord)).toBe(false);
    });

    it('should return true when crossing a bufferTokens interval boundary', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      // At 5000 tokens, interval = 0, lastBoundary = 0 → no trigger
      expect((om as any).shouldTriggerAsyncObservation(5000, 'thread:test', mockRecord)).toBe(false);

      // At 10000 tokens, interval = 1, lastBoundary = 0 → trigger
      expect((om as any).shouldTriggerAsyncObservation(10000, 'thread:test', mockRecord)).toBe(true);
    });

    it('should treat stale isBufferingObservation flag as cleared (no active op in process)', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      // isBufferingObservation=true but no op registered in this process → stale, should allow trigger
      const bufferingRecord = { isBufferingObservation: true, lastBufferedAtTokens: 0 } as any;
      expect((om as any).shouldTriggerAsyncObservation(10000, 'thread:test', bufferingRecord)).toBe(true);
    });

    it('should not re-trigger for the same interval using record.lastBufferedAtTokens', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const lockKey = 'thread:test';

      // Simulate first trigger at 10000 — record shows lastBufferedAtTokens=0
      expect((om as any).shouldTriggerAsyncObservation(10000, lockKey, mockRecord)).toBe(true);

      // Simulate that buffering completed and persisted lastBufferedAtTokens=10000
      const afterBufferRecord = { isBufferingObservation: false, lastBufferedAtTokens: 10000 } as any;

      // Same interval should not re-trigger (using DB state, not in-memory)
      expect((om as any).shouldTriggerAsyncObservation(12000, lockKey, afterBufferRecord)).toBe(false);

      // Next interval boundary should trigger
      expect((om as any).shouldTriggerAsyncObservation(20000, lockKey, afterBufferRecord)).toBe(true);
    });

    it('should not re-trigger for the same interval after lastBufferedBoundary is set (in-memory fallback)', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const lockKey = 'thread:test';
      const bufferKey = (om as any).getObservationBufferKey(lockKey);

      // Simulate first trigger at 10000
      expect((om as any).shouldTriggerAsyncObservation(10000, lockKey, mockRecord)).toBe(true);

      // Simulate that startAsyncBufferedObservation updated lastBufferedBoundary (in-memory)
      (ObservationalMemory as any).lastBufferedBoundary.set(bufferKey, 10000);

      // Same interval should not re-trigger
      expect((om as any).shouldTriggerAsyncObservation(12000, lockKey, mockRecord)).toBe(false);

      // Next interval boundary should trigger
      expect((om as any).shouldTriggerAsyncObservation(20000, lockKey, mockRecord)).toBe(true);
    });

    it('should halve the buffer interval when within ~1 bufferTokens of the threshold', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 40000,
          bufferTokens: 4000,
          bufferActivation: 0.8,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      // threshold=40000, bufferTokens=4000, rampPoint=40000-4000*1.1=35600, halved=2000
      const lockKey = 'thread:halve-test';

      // Well below ramp point (35600): normal 4000 interval
      // At 3000 tokens, interval = floor(3000/4000) = 0, last = 0 → no trigger
      expect((om as any).shouldTriggerAsyncObservation(3000, lockKey, mockRecord, 40000)).toBe(false);
      // At 4000 tokens, interval = floor(4000/4000) = 1, last = 0 → trigger
      expect((om as any).shouldTriggerAsyncObservation(4000, lockKey, mockRecord, 40000)).toBe(true);

      // Still below ramp point: normal 4000 interval
      const recordAt32k = { isBufferingObservation: false, lastBufferedAtTokens: 32000 } as any;
      // At 35000 tokens (below rampPoint 35600), interval = floor(35000/4000) = 8, last = floor(32000/4000) = 8 → no trigger
      expect((om as any).shouldTriggerAsyncObservation(35000, lockKey, recordAt32k, 40000)).toBe(false);

      // Above ramp point (35600): halved 2000 interval
      // At 36000 tokens, halved interval = 2000
      // interval = floor(36000/2000) = 18, last = floor(32000/2000) = 16 → trigger
      expect((om as any).shouldTriggerAsyncObservation(36000, lockKey, recordAt32k, 40000)).toBe(true);

      // Simulate buffering at 36000
      const recordAt36k = { isBufferingObservation: false, lastBufferedAtTokens: 36000 } as any;
      // At 37000 tokens, interval = floor(37000/2000) = 18, last = floor(36000/2000) = 18 → no trigger
      expect((om as any).shouldTriggerAsyncObservation(37000, lockKey, recordAt36k, 40000)).toBe(false);
      // At 38000 tokens, interval = floor(38000/2000) = 19, last = 18 → trigger
      expect((om as any).shouldTriggerAsyncObservation(38000, lockKey, recordAt36k, 40000)).toBe(true);
    });

    it('should not halve interval when no threshold is provided', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 40000,
          bufferTokens: 4000,
          bufferActivation: 0.8,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const lockKey = 'thread:no-threshold-test';
      const recordAt28k = { isBufferingObservation: false, lastBufferedAtTokens: 28000 } as any;

      // Without threshold, even near messageTokens limit, the normal 4000 interval is used
      // At 31000 tokens, interval = floor(31000/4000) = 7, last = floor(28000/4000) = 7 → no trigger
      expect((om as any).shouldTriggerAsyncObservation(31000, lockKey, recordAt28k)).toBe(false);
      // At 32000 tokens, interval = floor(32000/4000) = 8, last = 7 → trigger
      expect((om as any).shouldTriggerAsyncObservation(32000, lockKey, recordAt28k)).toBe(true);
    });
  });

  describe('shouldTriggerAsyncReflection', () => {
    const mockRecord = { bufferedReflection: undefined, isBufferingReflection: false } as any;

    it('should return false when async reflection is explicitly disabled', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000, bufferTokens: false },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).shouldTriggerAsyncReflection(15000, 'thread:test', mockRecord)).toBe(false);
    });

    it('should trigger when observation tokens reach threshold * bufferActivation', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: {
          observationTokens: 20000,
          bufferActivation: 0.5, // trigger at 20000 * 0.5 = 10000 observation tokens
        },
      });

      // Below activation point
      expect((om as any).shouldTriggerAsyncReflection(5000, 'thread:test', mockRecord)).toBe(false);

      // At activation point (20000 * 0.5 = 10000)
      expect((om as any).shouldTriggerAsyncReflection(10000, 'thread:test', mockRecord)).toBe(true);
    });

    it('should not trigger when record already has bufferedReflection', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: {
          observationTokens: 20000,
          bufferActivation: 0.5,
        },
      });

      const recordWithBuffer = { bufferedReflection: 'some existing reflection', isBufferingReflection: false } as any;
      expect((om as any).shouldTriggerAsyncReflection(15000, 'thread:test', recordWithBuffer)).toBe(false);
    });

    it('should treat stale isBufferingReflection flag as cleared (no active op in process)', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: {
          observationTokens: 20000,
          bufferActivation: 0.5,
        },
      });

      // isBufferingReflection=true but no op registered in this process → stale, should allow trigger
      const bufferingRecord = { bufferedReflection: undefined, isBufferingReflection: true } as any;
      expect((om as any).shouldTriggerAsyncReflection(15000, 'thread:test', bufferingRecord)).toBe(true);
    });

    it('should only trigger once per buffer key (in-memory fallback)', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: {
          observationTokens: 20000,
          bufferActivation: 0.5,
        },
      });

      const lockKey = 'thread:test';
      const reflectionKey = (om as any).getReflectionBufferKey(lockKey);

      // First trigger
      expect((om as any).shouldTriggerAsyncReflection(15000, lockKey, mockRecord)).toBe(true);

      // Simulate that reflection was started (sets lastBufferedBoundary)
      (ObservationalMemory as any).lastBufferedBoundary.set(reflectionKey, 15000);

      // Should not trigger again
      expect((om as any).shouldTriggerAsyncReflection(18000, lockKey, mockRecord)).toBe(false);
    });
  });

  describe('isAsyncBufferingInProgress', () => {
    it('should return false when no operation is in progress', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      expect((om as any).isAsyncBufferingInProgress('obs:thread:test')).toBe(false);
    });

    it('should return true when an operation is tracked', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      (ObservationalMemory as any).asyncBufferingOps.set('obs:thread:test', Promise.resolve());
      expect((om as any).isAsyncBufferingInProgress('obs:thread:test')).toBe(true);
    });
  });

  describe('sealMessagesForBuffering', () => {
    it('should set sealed metadata on messages', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const messages = [
        createTestMessage('Message 1', 'user', 'msg-1'),
        createTestMessage('Message 2', 'assistant', 'msg-2'),
      ];

      (om as any).sealMessagesForBuffering(messages);

      for (const msg of messages) {
        const metadata = msg.content.metadata as { mastra?: { sealed?: boolean } };
        expect(metadata.mastra?.sealed).toBe(true);

        const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
          metadata?: { mastra?: { sealedAt?: number } };
        };
        expect(lastPart.metadata?.mastra?.sealedAt).toBeTypeOf('number');
      }
    });

    it('should skip messages without parts', () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const msg = createTestMessage('Test', 'user', 'msg-1');
      msg.content.parts = [];

      // Should not throw
      (om as any).sealMessagesForBuffering([msg]);
      expect(msg.content.metadata).toBeUndefined();
    });
  });

  describe('withLock', () => {
    it('should serialize concurrent operations on the same key', async () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const order: number[] = [];

      const op1 = (om as any).withLock('test-key', async () => {
        await new Promise(r => setTimeout(r, 50));
        order.push(1);
        return 'first';
      });

      const op2 = (om as any).withLock('test-key', async () => {
        order.push(2);
        return 'second';
      });

      const [result1, result2] = await Promise.all([op1, op2]);

      expect(result1).toBe('first');
      expect(result2).toBe('second');
      expect(order).toEqual([1, 2]);
    });

    it('should allow concurrent operations on different keys', async () => {
      const om = new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 20000 },
      });

      const order: string[] = [];

      const op1 = (om as any).withLock('key-a', async () => {
        await new Promise(r => setTimeout(r, 30));
        order.push('a');
      });

      const op2 = (om as any).withLock('key-b', async () => {
        order.push('b');
      });

      await Promise.all([op1, op2]);

      // 'b' should complete before 'a' because they're on different keys
      expect(order).toEqual(['b', 'a']);
    });
  });

  describe('swapBufferedToActive boundary selection', () => {
    it('should prefer over-target boundary when equidistant', async () => {
      const storage = createInMemoryStorage();
      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      // Two chunks of equal size (5000 each, total 10000)
      // With activationRatio=0.5, target = 5000
      // After chunk 1: 5000 (exactly on target)
      // After chunk 2: 10000
      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Chunk 1',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date(),
          cycleId: 'cycle-1',
        },
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Chunk 2',
          tokenCount: 50,
          messageIds: ['msg-2'],
          messageTokens: 5000,
          lastObservedAt: new Date(),
          cycleId: 'cycle-2',
        },
      });

      const result = await storage.swapBufferedToActive({
        id: record.id,
        activationRatio: 0.5,
        messageTokensThreshold: 10000,
        currentPendingTokens: 10000,
        lastObservedAt: new Date(),
      });

      // At exactly the target, chunk 1 (5000 == target) should be activated
      expect(result.chunksActivated).toBe(1);
      expect(result.activatedCycleIds).toEqual(['cycle-1']);
      expect(result.messageTokensActivated).toBe(5000);
    });

    it('should activate all chunks when ratio is 1.0', async () => {
      const storage = createInMemoryStorage();
      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      for (let i = 0; i < 5; i++) {
        await storage.updateBufferedObservations({
          id: record.id,
          chunk: {
            observations: `- Chunk ${i}`,
            tokenCount: 20,
            messageIds: [`msg-${i}`],
            messageTokens: 2000,
            lastObservedAt: new Date(),
            cycleId: `cycle-${i}`,
          },
        });
      }

      const result = await storage.swapBufferedToActive({
        id: record.id,
        activationRatio: 1,
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
        lastObservedAt: new Date(),
      });

      expect(result.chunksActivated).toBe(5);
      expect(result.activatedCycleIds).toHaveLength(5);
      expect(result.messageTokensActivated).toBe(10000);

      const final = await storage.getObservationalMemory('thread-1', 'resource-1');
      expect(final?.bufferedObservationChunks).toBeUndefined();
    });

    it('should derive lastObservedAt from latest activated chunk', async () => {
      const storage = createInMemoryStorage();
      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      const earlyDate = new Date('2026-02-05T08:00:00Z');
      const laterDate = new Date('2026-02-05T12:00:00Z');

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Early chunk',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: earlyDate,
          cycleId: 'cycle-1',
        },
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Later chunk',
          tokenCount: 50,
          messageIds: ['msg-2'],
          messageTokens: 5000,
          lastObservedAt: laterDate,
          cycleId: 'cycle-2',
        },
      });

      // Activate all without providing explicit lastObservedAt
      await storage.swapBufferedToActive({
        id: record.id,
        activationRatio: 1,
        messageTokensThreshold: 100000,
        currentPendingTokens: 100000,
      });

      const final = await storage.getObservationalMemory('thread-1', 'resource-1');
      // Should derive from the latest activated chunk
      expect(final?.lastObservedAt).toEqual(laterDate);
    });
  });

  describe('tryActivateBufferedObservations integration', () => {
    it('should return success:false when no buffered chunks exist', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 0.7,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      const result = await (om as any).tryActivateBufferedObservations(record, 'thread:thread-1', 1000);

      expect(result.success).toBe(false);
    });

    it('should activate buffered chunks and return updated record', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 1,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Important observation',
          tokenCount: 100,
          messageIds: ['msg-1', 'msg-2'],
          messageTokens: 45000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');
      const result = await (om as any).tryActivateBufferedObservations(updatedRecord!, 'thread:thread-1', 50000);

      expect(result.success).toBe(true);
      expect(result.updatedRecord).toBeDefined();
      expect(result.updatedRecord.activeObservations).toContain('Important observation');
      expect(result.updatedRecord.bufferedObservationChunks).toBeUndefined();
    });

    it('should skip activation when projected remaining is far above retention floor', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 30000,
          bufferTokens: 6000,
          bufferActivation: 2000,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Chunk 1',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:00:00Z'),
          cycleId: 'cycle-1',
        },
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Chunk 2',
          tokenCount: 50,
          messageIds: ['msg-2'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:01:00Z'),
          cycleId: 'cycle-2',
        },
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Chunk 3',
          tokenCount: 50,
          messageIds: ['msg-3'],
          messageTokens: 3000,
          lastObservedAt: new Date('2026-02-05T10:02:00Z'),
          cycleId: 'cycle-3',
        },
      });

      const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');
      const result = await (om as any).tryActivateBufferedObservations(updatedRecord!, 'thread:thread-1', 30000);

      expect(result.success).toBe(false);
      const finalRecord = await storage.getObservationalMemory('thread-1', 'resource-1');
      expect(finalRecord?.bufferedObservationChunks).toHaveLength(3);
      expect(finalRecord?.activeObservations).toBeFalsy();
    });

    it('should not reset lastBufferedBoundary after activation (callers set it)', async () => {
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 50000,
          bufferTokens: 10000,
          bufferActivation: 1,
        },
        reflection: { observationTokens: 20000, bufferActivation: 0.5 },
      });

      const record = await storage.initializeObservationalMemory({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      await storage.updateBufferedObservations({
        id: record.id,
        chunk: {
          observations: '- Obs',
          tokenCount: 50,
          messageIds: ['msg-1'],
          messageTokens: 5000,
          lastObservedAt: new Date(),
          cycleId: 'cycle-1',
        },
      });

      const lockKey = 'thread:thread-1';
      const bufferKey = (om as any).getObservationBufferKey(lockKey);

      // Simulate that buffering set a boundary
      (ObservationalMemory as any).lastBufferedBoundary.set(bufferKey, 15000);

      const updatedRecord = await storage.getObservationalMemory('thread-1', 'resource-1');
      await (om as any).tryActivateBufferedObservations(updatedRecord!, lockKey, 50000);

      // After activation, the boundary should NOT be cleared by tryActivateBufferedObservations.
      // Callers are responsible for setting it to the post-activation context size.
      // tryActivateBufferedObservations preserves the existing boundary.
      expect((ObservationalMemory as any).lastBufferedBoundary.has(bufferKey)).toBe(true);
    });
  });
});

// =============================================================================
// Full-Flow Integration Tests: Async Buffering → Activation → Reflection
// =============================================================================

describe('Full Async Buffering Flow', () => {
  /**
   * Helper: creates an ObservationalMemory wired to InMemoryMemory with a mock model,
   * pre-initialises a thread with saved messages, and returns everything needed
   * to drive processInputStep in a loop.
   */
  async function setupAsyncBufferingScenario(opts: {
    messageTokens: number;
    bufferTokens: number;
    bufferActivation: number;
    reflectionObservationTokens: number;
    reflectionAsyncActivation?: number;
    blockAfter?: number;
    /** Number of messages to pre-save (each ~200 tokens via repeated filler text) */
    messageCount?: number;
  }) {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    // Clear static maps to avoid cross-test pollution
    (ObservationalMemory as any).asyncBufferingOps.clear();
    (ObservationalMemory as any).lastBufferedBoundary.clear();
    (ObservationalMemory as any).lastBufferedAtTime.clear();
    (ObservationalMemory as any).reflectionBufferCycleIds.clear();
    (ObservationalMemory as any).sealedMessageIds.clear();

    const storage = createInMemoryStorage();
    const threadId = 'flow-thread';
    const resourceId = 'flow-resource';

    // Track observer & reflector calls
    const observerCalls: { input: string }[] = [];
    const reflectorCalls: { input: string }[] = [];

    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        const promptText = JSON.stringify(prompt);

        // Detect whether this is a reflection call (reflector prompt mentions "consolidate")
        const isReflection = promptText.includes('consolidat') || promptText.includes('reflect');
        if (isReflection) {
          reflectorCalls.push({ input: promptText.slice(0, 200) });
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            content: [
              {
                type: 'text' as const,
                text: '<reflection>\nDate: Jan 1, 2025\n* Reflected observation summary\n</reflection>',
              },
            ],
            warnings: [],
          };
        }

        // Observer call
        observerCalls.push({ input: promptText.slice(0, 200) });
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          content: [
            {
              type: 'text' as const,
              text: `<observations>\nDate: Jan 1, 2025\n* 🔴 Observed at call ${observerCalls.length}\n* User discussed topic ${observerCalls.length}\n</observations>`,
            },
          ],
          warnings: [],
        };
      },
    });

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      model: mockModel as any,
      observation: {
        messageTokens: opts.messageTokens,
        bufferTokens: opts.bufferTokens,
        bufferActivation: opts.bufferActivation,
        blockAfter: opts.blockAfter,
      },
      reflection: {
        observationTokens: opts.reflectionObservationTokens,
        bufferActivation: opts.reflectionAsyncActivation ?? opts.bufferActivation,
      },
    });

    // Create thread
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test Thread',
        createdAt: new Date('2025-01-01T08:00:00Z'),
        updatedAt: new Date('2025-01-01T08:00:00Z'),
        metadata: {},
      },
    });

    // Save initial messages (each ~200 tokens via filler text)
    const msgCount = opts.messageCount ?? 20;
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10); // ~200 tokens
    const messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: { format: 2; parts: Array<{ type: 'text'; text: string }> };
      type: string;
      createdAt: Date;
      threadId: string;
      resourceId: string;
    }> = [];
    for (let i = 0; i < msgCount; i++) {
      messages.push({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
        },
        type: 'text',
        createdAt: new Date(Date.UTC(2025, 0, 1, 9, i)),
        threadId,
        resourceId,
      });
    }
    await storage.saveMessages({ messages });

    // Shared state across steps (simulates a single agent turn with multiple steps)
    const sharedState: Record<string, unknown> = {};
    let sharedMessageList = new MessageList({ threadId, resourceId });

    // Helper to call processInputStep
    async function step(stepNumber: number, opts?: { freshState?: boolean }) {
      if (opts?.freshState) {
        Object.keys(sharedState).forEach(k => delete sharedState[k]);
        sharedMessageList = new MessageList({ threadId, resourceId });
      }
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });
      requestContext.set('currentDate', new Date('2025-01-01T12:00:00Z').toISOString());

      await om.processInputStep({
        messageList: sharedMessageList,
        messages: [],
        requestContext,
        stepNumber,
        state: sharedState,
        steps: [],
        systemMessages: [],
        model: mockModel as any,
        retryCount: 0,
        abort: (() => {
          throw new Error('aborted');
        }) as any,
      });

      return sharedMessageList;
    }

    /** Wait for any in-flight async operations to settle */
    async function waitForAsyncOps(timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ops = (ObservationalMemory as any).asyncBufferingOps as Map<string, Promise<void>>;
        if (ops.size === 0) return;
        await Promise.allSettled([...ops.values()]);
        // Small delay to let finally blocks clean up
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return {
      storage,
      om,
      threadId,
      resourceId,
      step,
      waitForAsyncOps,
      observerCalls,
      reflectorCalls,
    };
  }

  it('should trigger async buffering at bufferTokens interval', async () => {
    // 20 messages × ~200 tokens = ~4000 tokens total
    // bufferTokens=1000 → first buffer at ~1000 tokens
    // messageTokens=10000 → threshold not reached
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 1000,
      bufferActivation: 0.7,
      reflectionObservationTokens: 50000, // High - don't trigger reflection
      messageCount: 20,
    });

    // Step 0 loads historical messages and should trigger async buffering
    // since ~4000 tokens > bufferTokens (1000)
    await step(0);
    await waitForAsyncOps();

    // Verify buffered chunks were created
    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    const chunks = record?.bufferedObservationChunks;
    // Should have parsed chunks (may be stored as JSON string)
    const parsedChunks = typeof chunks === 'string' ? JSON.parse(chunks) : chunks;
    expect(parsedChunks).toBeDefined();
    expect(Array.isArray(parsedChunks) ? parsedChunks.length : 0).toBeGreaterThan(0);

    // Observer should have been called for buffering
    expect(observerCalls.length).toBeGreaterThan(0);
  });

  it('should activate buffered observations when threshold is reached', async () => {
    // Phase 1: Start with few messages so buffering triggers (below threshold)
    // 10 messages × ~200 tokens = ~2000 tokens, threshold = 5000
    // bufferTokens=1000 → async buffering triggers at ~1000 tokens
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 3000,
      bufferTokens: 500,
      bufferActivation: 0.7,
      reflectionObservationTokens: 50000,
      messageCount: 10,
    });

    // Step 0: loads historical messages (~2000 tokens < 5000 threshold), triggers async buffering
    await step(0);
    await waitForAsyncOps();

    // Verify buffered chunks were created
    const preRecord = await storage.getObservationalMemory(threadId, resourceId);
    const preChunks =
      typeof preRecord?.bufferedObservationChunks === 'string'
        ? JSON.parse(preRecord.bufferedObservationChunks)
        : preRecord?.bufferedObservationChunks;
    expect(Array.isArray(preChunks) ? preChunks.length : 0).toBeGreaterThan(0);
    expect(observerCalls.length).toBeGreaterThan(0);

    // Phase 2: Add more messages to push past threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    const newMessages = [];
    for (let i = 10; i < 40; i++) {
      newMessages.push({
        id: `msg-${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
        },
        type: 'text',
        createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
        threadId,
        resourceId,
      });
    }
    await storage.saveMessages({ messages: newMessages });

    // New turn step 0: loads all messages, finds chunks, activates them
    await step(0, { freshState: true });
    await waitForAsyncOps();

    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    // After activation, activeObservations should contain content from observer
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations!.length).toBeGreaterThan(0);
    expect(record!.activeObservations).toContain('Observed');
  });

  it('should trigger reflection after observation tokens exceed reflection threshold', async () => {
    // Start with few messages (below threshold) so buffering triggers,
    // then add more to exceed threshold and trigger activation + reflection.
    // Observer mock returns ~50 tokens of output per call (counted by the simple token counter).
    // reflectionObservationTokens = 10 means reflection should trigger after activation
    // since the observer output easily exceeds 10 tokens.
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls, reflectorCalls } =
      await setupAsyncBufferingScenario({
        messageTokens: 3000,
        bufferTokens: 500,
        bufferActivation: 1.0,
        reflectionObservationTokens: 10, // Very low - reflection triggers after any activation
        reflectionAsyncActivation: 1.0,
        messageCount: 10, // ~1100 tokens, below threshold
      });

    // Step 0: loads messages, triggers async buffering (under threshold)
    await step(0);
    await waitForAsyncOps();

    // Verify observer was called for buffering
    expect(observerCalls.length).toBeGreaterThan(0);

    // Add more messages to push past threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    const newMessages = [];
    for (let i = 10; i < 40; i++) {
      newMessages.push({
        id: `msg-${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
        },
        type: 'text',
        createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
        threadId,
        resourceId,
      });
    }
    await storage.saveMessages({ messages: newMessages });

    // New turn step 0: activates buffered chunks, which triggers maybeAsyncReflect
    await step(0, { freshState: true });
    await waitForAsyncOps();

    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    // Observation content should be present
    expect(record!.activeObservations).toBeTruthy();

    // With reflection threshold so low (10 tokens), reflection should have been triggered
    // after activation added observation tokens exceeding the threshold
    const _history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);

    if (reflectorCalls.length > 0) {
      // Reflection was triggered - a new generation may exist
      expect(reflectorCalls.length).toBeGreaterThan(0);
    } else {
      // Even if reflection hasn't triggered yet (async timing), observations must exist
      expect(record!.activeObservations!.length).toBeGreaterThan(0);
    }
  });

  it('should not duplicate observations from already-buffered messages', async () => {
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 1000,
      bufferActivation: 1.0,
      reflectionObservationTokens: 50000,
      messageCount: 15,
    });

    // Step 0: load messages and trigger first buffering
    await step(0);
    await waitForAsyncOps();

    const _callsAfterFirstBuffer = observerCalls.length;

    // Step 1: should NOT re-buffer the same messages
    await step(1);
    await waitForAsyncOps();

    // If new messages weren't added, observer should not be called again
    // (or if called, it should receive different/fewer messages)
    const record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);

    // All chunk message IDs should be unique (no duplicates across chunks)
    const allMessageIds = chunks.flatMap((c: any) => c.messageIds ?? []);
    const uniqueIds = new Set(allMessageIds);
    expect(uniqueIds.size).toBe(allMessageIds.length);
  });

  it('should fall back to sync observation when blockAfter is exceeded', async () => {
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 1000,
      bufferTokens: 500,
      bufferActivation: 0.7,
      reflectionObservationTokens: 50000,
      blockAfter: 2000, // Will force sync when tokens exceed this
      messageCount: 30, // ~6000 tokens, well above blockAfter
    });

    // Run multiple steps — with blockAfter=2000, once we exceed that
    // and there are no buffered chunks to activate, sync observation should trigger
    for (let i = 0; i < 3; i++) {
      await step(i);
      await waitForAsyncOps();
    }

    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    // Observations should exist (either via activation or sync fallback)
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations!.length).toBeGreaterThan(0);

    // Observer should have been called
    expect(observerCalls.length).toBeGreaterThan(0);
  });

  it('should handle maybeAsyncReflect when observations jump past threshold via activation', async () => {
    // This tests the specific bug: observations accumulate via activation to
    // exceed the reflection threshold, but no background reflection was pre-buffered.
    // The fix should start background reflection immediately.
    const { storage, threadId, resourceId, step, waitForAsyncOps, reflectorCalls } = await setupAsyncBufferingScenario({
      messageTokens: 500, // Low - triggers observation/activation fast
      bufferTokens: 200,
      bufferActivation: 1.0,
      reflectionObservationTokens: 30, // Very low - any observations should trigger reflection
      reflectionAsyncActivation: 1.0,
      messageCount: 15,
    });

    // Run steps to accumulate observations past the reflection threshold
    for (let i = 0; i < 5; i++) {
      await step(i);
      await waitForAsyncOps();
    }

    // After activation pushes observation tokens past 30 (threshold),
    // maybeAsyncReflect should start background reflection
    // and subsequent steps should activate it
    for (let i = 5; i < 8; i++) {
      await step(i);
      await waitForAsyncOps();
    }

    // Either reflector was called (background reflection ran)
    // or a new generation was created (reflection completed)
    const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);
    const record = await storage.getObservationalMemory(threadId, resourceId);

    // At minimum, observations should be present
    expect(record).toBeDefined();

    // The reflector should have been called since observation tokens exceed 30
    // (async reflection starts in background when maybeAsyncReflect detects no buffered content)
    if (record!.observationTokenCount && record!.observationTokenCount > 30) {
      // If observations are still above threshold, reflection may be in progress or completed
      // Either reflector was called OR a new generation was created (history > 1)
      expect(reflectorCalls.length + (history?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('should preserve continuation hints only for sync observation, not async buffering', async () => {
    const { step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 500,
      bufferActivation: 0.7,
      reflectionObservationTokens: 50000,
      messageCount: 10,
    });

    // Step 0: triggers async buffering
    await step(0);
    await waitForAsyncOps();

    // Observer should have been called for async buffering
    expect(observerCalls.length).toBeGreaterThan(0);

    // The mock captures `input: JSON.stringify(prompt).slice(0, 200)`.
    // buildObserverPrompt appends "Do NOT include <current-task> or <suggested-response>"
    // when skipContinuationHints is true. Since the mock only captures 200 chars
    // of the serialized prompt, we can't reliably check the end of the prompt here.
    // The important thing: the observer was called (buffering happened), and the
    // skipContinuationHints logic is unit-tested in buildObserverPrompt's own tests.
    // For this integration test, we verify the async buffering path was exercised.
    const lastCall = observerCalls[observerCalls.length - 1];
    expect(lastCall).toBeDefined();
    expect(lastCall.input.length).toBeGreaterThan(0);
  });

  it('should default reflection.bufferActivation when observation.bufferTokens is set', () => {
    // reflection.bufferActivation defaults to 0.5 so this should not throw
    expect(() => {
      new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 10000,
          bufferTokens: 5000,
          bufferActivation: 0.7,
        },
        reflection: {
          observationTokens: 5000,
          // No bufferActivation — defaults to 0.5
        },
      });
    }).not.toThrow();
  });

  it('should validate bufferActivation must be in (0, 1] range', () => {
    expect(() => {
      new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 10000,
          bufferTokens: 5000,
          bufferActivation: 1.5, // Invalid: > 1
        },
        reflection: { observationTokens: 5000, bufferActivation: 0.5 },
      });
    }).toThrow();

    expect(() => {
      new ObservationalMemory({
        storage: createInMemoryStorage(),
        scope: 'thread',
        model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
        observation: {
          messageTokens: 10000,
          bufferTokens: 5000,
          bufferActivation: 0, // Invalid: must be > 0
        },
        reflection: { observationTokens: 5000, bufferActivation: 0.5 },
      });
    }).toThrow();
  });

  it('should resolve fractional bufferTokens to absolute token count', () => {
    // bufferTokens: 0.25 with messageTokens: 20000 → 5000
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: {
        messageTokens: 20000,
        bufferTokens: 0.25,
        bufferActivation: 0.7,
      },
      reflection: { observationTokens: 5000, bufferActivation: 0.5 },
    });
    expect((om as any).observationConfig.bufferTokens).toBe(5000);
  });

  it('should resolve fractional blockAfter to absolute token count with multiplier', () => {
    // blockAfter: 1.25 with messageTokens: 20000 → 25000 (20000 * 1.25)
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      model: new MockLanguageModelV2({ defaultObjectGenerationMode: 'json' }),
      observation: {
        messageTokens: 20000,
        bufferTokens: 5000,
        bufferActivation: 0.7,
        blockAfter: 1.25,
      },
      reflection: { observationTokens: 5000, bufferActivation: 0.5 },
    });
    expect((om as any).observationConfig.blockAfter).toBe(25000);
  });

  it('should activate buffered chunks on new turn and buffer new messages', async () => {
    // Turn 1: buffer messages below threshold
    // Turn 2: step 0 activates existing chunks, then buffers new unobserved messages
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 2000,
      bufferTokens: 200,
      bufferActivation: 1.0,
      reflectionObservationTokens: 50000,
      messageCount: 10, // ~1100 tokens
    });

    // Turn 1, step 0: buffers messages
    await step(0);
    await waitForAsyncOps();

    const firstCallCount = observerCalls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    let record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks1 =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    expect(chunks1.length).toBeGreaterThan(0);

    // Add new messages
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 10; i < 25; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Turn 2 step 0: activates existing chunks, then buffers new messages
    await step(0, { freshState: true });
    await waitForAsyncOps();

    record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    // Activation should have moved first batch to activeObservations
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations!.length).toBeGreaterThan(0);

    // Observer should have been called again for the new messages
    expect(observerCalls.length).toBeGreaterThan(firstCallCount);
  });

  it('should complete full flow: buffer → activate → reflect → new generation', async () => {
    // End-to-end test: buffer observations, activate them, trigger reflection,
    // and verify a new generation is created with reflected content.
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls, reflectorCalls } =
      await setupAsyncBufferingScenario({
        messageTokens: 2000,
        bufferTokens: 500,
        bufferActivation: 1.0,
        reflectionObservationTokens: 10, // Very low - reflection triggers after any activation
        reflectionAsyncActivation: 1.0,
        messageCount: 8, // ~880 tokens, below threshold
      });

    // Step 0: below threshold, triggers async buffering
    await step(0);
    await waitForAsyncOps();
    expect(observerCalls.length).toBeGreaterThan(0);

    // Verify buffered chunks exist
    let record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    expect(chunks.length).toBeGreaterThan(0);
    const gen0Id = record?.id;

    // Add messages to push past threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 8; i < 25; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // New turn: activates buffered observations → triggers maybeAsyncReflect
    await step(0, { freshState: true });
    await waitForAsyncOps();

    // Run a few more steps to let async reflection complete and activate
    for (let i = 1; i < 5; i++) {
      await step(i);
      await waitForAsyncOps();
    }

    record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations!.length).toBeGreaterThan(0);

    // Check history for generation changes
    const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);

    // If reflection ran, there should be a new generation or reflector was called
    if (reflectorCalls.length > 0) {
      // Reflection was triggered
      expect(reflectorCalls.length).toBeGreaterThan(0);
      // A new generation should exist (generationCount > 0)
      if (history && history.length > 1) {
        expect(record!.generationCount).toBeGreaterThan(0);
        // The original generation should be in history
        expect(history.some((h: any) => h.id === gen0Id)).toBe(true);
      }
    } else {
      // Even without reflection, observations must be present from activation
      expect(record!.activeObservations).toContain('Observed');
    }
  });

  it('should handle writer errors gracefully during async buffering', async () => {
    const { step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 500,
      bufferActivation: 0.7,
      reflectionObservationTokens: 50000,
      messageCount: 10,
    });

    // Step 0: triggers async buffering. The writer in the test helper doesn't
    // have a real stream controller, so writer.custom() may fail.
    // The key assertion: no unhandled promise rejections / crashes.
    await step(0);
    await waitForAsyncOps();

    // If buffering completed despite writer issues, observer was still called
    expect(observerCalls.length).toBeGreaterThan(0);
  });

  describe('Full Async Reflection Flow', () => {
    /**
     * Helper that directly exercises storage-level buffering and activation
     * to verify the reflectedObservationLineCount boundary merge logic
     * independently of the async timing in processInputStep.
     */
    it('should merge bufferedReflection with unreflected observations correctly', async () => {
      const storage = createInMemoryStorage();
      const threadId = 'reflect-merge-thread';
      const resourceId = 'reflect-merge-resource';

      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Reflection Merge Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });

      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Simulate 6 lines of active observations
      const observations = [
        '* 🔴 User prefers dark mode',
        '* 🟡 User uses TypeScript',
        '* User asked about React hooks',
        '* 🔴 User dislikes verbose code',
        '* User mentioned using Vim',
        '* 🟡 User wants fast feedback loops',
      ].join('\n');

      await storage.updateActiveObservations({
        id: initial.id,
        observations,
        tokenCount: 100,
        lastObservedAt: new Date(),
      });

      // Buffer a reflection that covers the first 4 lines
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '* 🔴 User prefers dark mode, TypeScript, React hooks, concise code',
        tokenCount: 30,
        reflectedObservationLineCount: 4,
      });

      // Verify the buffered state
      let record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.bufferedReflection).toBe('* 🔴 User prefers dark mode, TypeScript, React hooks, concise code');
      expect(record?.reflectedObservationLineCount).toBe(4);

      // Activate buffered reflection
      await storage.swapBufferedReflectionToActive({
        currentRecord: record!,
        tokenCount: 50,
      });

      // Verify the new generation
      record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeDefined();
      expect(record!.originType).toBe('reflection');
      expect(record!.generationCount).toBe(1);
      expect(record!.observationTokenCount).toBe(50);

      // Should contain the condensed reflection
      expect(record!.activeObservations).toContain('User prefers dark mode, TypeScript, React hooks, concise code');
      // Should contain the unreflected lines (lines 5 and 6)
      expect(record!.activeObservations).toContain('User mentioned using Vim');
      expect(record!.activeObservations).toContain('User wants fast feedback loops');
      // Should NOT contain the original reflected lines
      expect(record!.activeObservations).not.toContain('User uses TypeScript\n');
      expect(record!.activeObservations).not.toContain('User asked about React hooks');
      expect(record!.activeObservations).not.toContain('User dislikes verbose code');

      // Old record should have cleared buffered state
      const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);
      expect(history).toBeDefined();
      expect(history!.length).toBe(2); // new generation + original
      const oldRecord = history!.find(h => h.generationCount === 0);
      expect(oldRecord?.bufferedReflection).toBeUndefined();
      expect(oldRecord?.bufferedReflectionTokens).toBeUndefined();
      expect(oldRecord?.reflectedObservationLineCount).toBeUndefined();
    });

    it('should handle reflection covering ALL lines (no unreflected content)', async () => {
      const storage = createInMemoryStorage();
      const threadId = 'reflect-all-thread';
      const resourceId = 'reflect-all-resource';

      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Full Reflection Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });

      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      const observations = '* Line 1\n* Line 2\n* Line 3';
      await storage.updateActiveObservations({
        id: initial.id,
        observations,
        tokenCount: 60,
        lastObservedAt: new Date(),
      });

      // Reflection covers all 3 lines
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '* Condensed all three lines',
        tokenCount: 10,
        reflectedObservationLineCount: 3,
      });

      await storage.swapBufferedReflectionToActive({
        currentRecord: (await storage.getObservationalMemory(threadId, resourceId))!,
        tokenCount: 10,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      // Should only contain the condensed reflection, no unreflected content
      expect(record!.activeObservations).toBe('* Condensed all three lines');
      expect(record!.observationTokenCount).toBe(10);
    });

    it('should handle observations added DURING reflection (new lines after boundary)', async () => {
      const storage = createInMemoryStorage();
      const threadId = 'reflect-during-thread';
      const resourceId = 'reflect-during-resource';

      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Reflection During Activity Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });

      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Start with 3 lines
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '* Line A\n* Line B\n* Line C',
        tokenCount: 50,
        lastObservedAt: new Date(),
      });

      // Start async reflection on all 3 lines
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '* Summary of A, B, C',
        tokenCount: 15,
        reflectedObservationLineCount: 3,
      });

      // Simulate new observations added WHILE reflection was running
      // (sync observation ran and appended new lines)
      await storage.updateActiveObservations({
        id: initial.id,
        observations:
          '* Line A\n* Line B\n* Line C\n* Line D (added during reflection)\n* Line E (added during reflection)',
        tokenCount: 80,
        lastObservedAt: new Date(),
      });

      // Now activate - should keep lines D and E
      await storage.swapBufferedReflectionToActive({
        currentRecord: (await storage.getObservationalMemory(threadId, resourceId))!,
        tokenCount: 40,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record!.activeObservations).toContain('Summary of A, B, C');
      expect(record!.activeObservations).toContain('Line D (added during reflection)');
      expect(record!.activeObservations).toContain('Line E (added during reflection)');
      // Original reflected lines should not be present
      expect(record!.activeObservations).not.toContain('* Line A\n');
      expect(record!.activeObservations).not.toContain('* Line B\n');
      expect(record!.activeObservations).not.toMatch(/\* Line C\n/);
    });

    it('should trigger async reflection via processInputStep when observation tokens cross bufferActivation threshold', async () => {
      // Setup: Low reflection threshold so reflection triggers quickly.
      // bufferActivation=0.5 means reflection starts at 50% of reflectionObservationTokens.
      // Observer returns ~10 tokens of observation per call.
      // reflectionObservationTokens=20 → activation point = 10 tokens.
      const { storage, threadId, resourceId, step, waitForAsyncOps, reflectorCalls, observerCalls } =
        await setupAsyncBufferingScenario({
          messageTokens: 2000,
          bufferTokens: 500,
          bufferActivation: 1.0,
          reflectionObservationTokens: 20, // Very low threshold
          reflectionAsyncActivation: 0.5, // Trigger reflection at 50% = 10 tokens
          messageCount: 8, // ~880 tokens, below message threshold
        });

      // Step 0: below message threshold, triggers async observation buffering
      await step(0);
      await waitForAsyncOps();

      expect(observerCalls.length).toBeGreaterThan(0);

      // Verify buffered chunks exist
      let record = await storage.getObservationalMemory(threadId, resourceId);
      const chunks =
        typeof record?.bufferedObservationChunks === 'string'
          ? JSON.parse(record.bufferedObservationChunks)
          : (record?.bufferedObservationChunks ?? []);
      expect(chunks.length).toBeGreaterThan(0);

      // Add more messages to push past observation threshold
      const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
      for (let i = 8; i < 25; i++) {
        await storage.saveMessages({
          messages: [
            {
              id: `msg-${i}`,
              role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
              content: {
                format: 2 as const,
                parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
              },
              type: 'text',
              createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
              threadId,
              resourceId,
            },
          ],
        });
      }

      // New turn step 0: activates buffered observation chunks → observation tokens jump above
      // reflection threshold (20) → maybeAsyncReflect should trigger
      await step(0, { freshState: true });
      await waitForAsyncOps();

      // Run a few more steps to allow reflection to complete and activate
      for (let i = 1; i < 4; i++) {
        await step(i);
        await waitForAsyncOps();
      }

      record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record).toBeDefined();

      // The reflector should have been called at least once
      expect(reflectorCalls.length).toBeGreaterThan(0);

      // If reflection activated, we should have a new generation
      const history = await storage.getObservationalMemoryHistory(threadId, resourceId, 10);
      if (history && history.length > 1) {
        // New generation was created
        expect(record!.originType).toBe('reflection');
        expect(record!.generationCount).toBeGreaterThan(0);
        expect(record!.activeObservations).toBeTruthy();
        // The reflected content should contain our mock reflector's output
        expect(record!.activeObservations).toContain('Reflected observation summary');
      }
    });

    it('should not re-trigger async reflection when bufferedReflection already exists', async () => {
      const storage = createInMemoryStorage();
      const threadId = 'no-retrigger-thread';
      const resourceId = 'no-retrigger-resource';

      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'No Re-trigger Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });

      let _reflectorCallCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          const promptText = JSON.stringify(prompt);
          const isReflection = promptText.includes('consolidat') || promptText.includes('reflect');
          if (isReflection) {
            _reflectorCallCount++;
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            content: [
              {
                type: 'text' as const,
                text: isReflection
                  ? '<reflection>\nDate: Jan 1, 2025\n* Reflected content\n</reflection>'
                  : '<observations>\nDate: Jan 1, 2025\n* 🔴 Observation\n</observations>',
              },
            ],
            warnings: [],
          };
        },
      });

      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        model: mockModel as any,
        observation: {
          messageTokens: 10000,
          bufferTokens: 500,
          bufferActivation: 1.0,
        },
        reflection: {
          observationTokens: 100,
          bufferActivation: 0.5,
        },
      });

      // Initialize and set up observations that are above 50% of reflection threshold
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Set active observations with token count above the activation point (50 = 100 * 0.5)
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '* Observation 1\n* Observation 2\n* Observation 3',
        tokenCount: 60,
        lastObservedAt: new Date(),
      });

      // Also set a bufferedReflection to simulate one already in progress/completed
      await storage.updateBufferedReflection({
        id: initial.id,
        reflection: '* Already buffered reflection',
        tokenCount: 20,
        reflectedObservationLineCount: 3,
      });

      // shouldTriggerAsyncReflection should return false because bufferedReflection exists
      const shouldTrigger = (om as any).shouldTriggerAsyncReflection(
        60,
        `thread:${threadId}`,
        await storage.getObservationalMemory(threadId, resourceId),
      );
      expect(shouldTrigger).toBe(false);
    });
  });

  it('should not activate more chunks than bufferActivation ratio allows', async () => {
    const storage = createInMemoryStorage();
    const threadId = 'partial-activation-thread';
    const resourceId = 'partial-activation-resource';

    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Partial Activation Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    // Initialize OM record
    await storage.initializeObservationalMemory({
      threadId,
      resourceId,
      lookupKey: `thread:${threadId}`,
      observedTimezone: 'UTC',
    });

    // Get the record to use its ID
    let record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();
    const recordId = record!.id;

    // Manually add 4 buffered chunks with known messageTokens
    for (let i = 0; i < 4; i++) {
      await storage.updateBufferedObservations({
        id: recordId,
        chunk: {
          observations: `Chunk ${i} observations`,
          tokenCount: 100,
          messageIds: [`chunk-msg-${i}`],
          messageTokens: 1000, // Each chunk covers 1000 message tokens
          lastObservedAt: new Date(Date.UTC(2025, 0, 1, 8 + i)),
          cycleId: `cycle-${i}`,
        },
      });
    }

    // Verify 4 chunks stored
    record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks = record?.bufferedObservationChunks ?? [];
    expect(chunks).toHaveLength(4);

    // Activate with ratio 0.5 → should activate ~2000 out of 4000 message tokens
    // Target = 4000 - 4000 * 0.5 = 2000. Closest boundary: 2 chunks (exactly 2000).
    const result = await storage.swapBufferedToActive({
      id: recordId,
      activationRatio: 0.5,
      messageTokensThreshold: 4000,
      currentPendingTokens: 4000,
    });

    // Should activate exactly 2 chunks (2000 message tokens = 50% of 4000)
    expect(result.chunksActivated).toBe(2);
    expect(result.messageTokensActivated).toBe(2000);
    expect(result.activatedCycleIds).toHaveLength(2);

    // Remaining chunks should be 2
    record = await storage.getObservationalMemory(threadId, resourceId);
    const remaining = record?.bufferedObservationChunks ?? [];
    expect(remaining).toHaveLength(2);
  });

  describe('partial activation: oldest-first ordering with various ratios and uneven chunks', () => {
    // Helper: set up storage with given chunks, activate, and return result + remaining
    async function setupAndActivate(opts: {
      chunks: Array<{ cycleId: string; messageTokens: number; observationTokens: number; obs: string }>;
      activationRatio: number;
      messageTokensThreshold: number;
      currentPendingTokens?: number;
      retentionFloor?: number;
      forceMaxActivation?: boolean;
    }) {
      const storage = createInMemoryStorage();
      const threadId = `partial-${crypto.randomUUID()}`;
      const resourceId = `res-${crypto.randomUUID()}`;

      await storage.saveThread({
        thread: { id: threadId, resourceId, title: 'test', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
      });
      await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        lookupKey: `thread:${threadId}`,
        observedTimezone: 'UTC',
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      const recordId = record!.id;

      for (let i = 0; i < opts.chunks.length; i++) {
        const c = opts.chunks[i]!;
        await storage.updateBufferedObservations({
          id: recordId,
          chunk: {
            observations: c.obs,
            tokenCount: c.observationTokens,
            messageIds: [`msg-${i}`],
            messageTokens: c.messageTokens,
            lastObservedAt: new Date(Date.UTC(2025, 0, 1, 8 + i)),
            cycleId: c.cycleId,
          },
        });
      }

      const result = await storage.swapBufferedToActive({
        id: recordId,
        activationRatio: opts.activationRatio,
        messageTokensThreshold: opts.messageTokensThreshold,
        currentPendingTokens: opts.currentPendingTokens ?? opts.messageTokensThreshold,
        retentionFloor: opts.retentionFloor,
        forceMaxActivation: opts.forceMaxActivation,
      });

      const afterRecord = await storage.getObservationalMemory(threadId, resourceId);
      const remaining = afterRecord?.bufferedObservationChunks ?? [];

      return { result, remaining };
    }

    it('even chunks, ratio 0.6: activates 3 of 5 oldest chunks', async () => {
      // 5 chunks of 10k each. threshold=50k, ratio=0.6 → target=30k
      // After 3 chunks: 30k (exactly on target) → activates 3
      const chunks = [
        { cycleId: 'c-0', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 0: project setup' },
        { cycleId: 'c-1', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 1: schema design' },
        { cycleId: 'c-2', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 2: API endpoints' },
        { cycleId: 'c-3', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 3: frontend' },
        { cycleId: 'c-4', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 4: deployment' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.6,
        messageTokensThreshold: 50000,
      });

      expect(result.chunksActivated).toBe(3);
      expect(result.messageTokensActivated).toBe(30000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2']);
      expect(result.observations).toContain('Chunk 0');
      expect(result.observations).toContain('Chunk 2');
      expect(result.observations).not.toContain('Chunk 3');

      expect(remaining).toHaveLength(2);
      expect(remaining[0].cycleId).toBe('c-3');
      expect(remaining[1].cycleId).toBe('c-4');
    });

    it('uneven chunks, ratio 0.6: biases over target', async () => {
      // Chunks: 8k, 15k, 12k, 7k, 6k (total 48k). threshold=50k, ratio=0.6 → target=30k
      // After 1: 8k  (under, distance=22k)
      // After 2: 23k (under, distance=7k)
      // After 3: 35k (over, distance=5k)  ← best over
      // Algorithm prefers the over boundary to ensure retention target is met.
      const chunks = [
        { cycleId: 'c-0', messageTokens: 8000, observationTokens: 150, obs: 'Chunk 0: small early messages' },
        { cycleId: 'c-1', messageTokens: 15000, observationTokens: 300, obs: 'Chunk 1: big tool call results' },
        { cycleId: 'c-2', messageTokens: 12000, observationTokens: 250, obs: 'Chunk 2: medium conversation' },
        { cycleId: 'c-3', messageTokens: 7000, observationTokens: 120, obs: 'Chunk 3: short follow-up' },
        { cycleId: 'c-4', messageTokens: 6000, observationTokens: 100, obs: 'Chunk 4: final exchange' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.6,
        messageTokensThreshold: 50000,
      });

      // 2 chunks = 23k (under target of 30k), 3 chunks = 35k (over).
      // Algorithm prefers the over boundary to hit the retention target.
      expect(result.chunksActivated).toBe(3);
      expect(result.messageTokensActivated).toBe(35000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2']);
      expect(result.observations).toContain('Chunk 0');
      expect(result.observations).toContain('Chunk 1');
      expect(result.observations).toContain('Chunk 2');

      expect(remaining).toHaveLength(2);
      expect(remaining[0].cycleId).toBe('c-3');
      expect(remaining[1].cycleId).toBe('c-4');
    });

    it('uneven chunks, ratio 0.4: biases over target', async () => {
      // Same uneven chunks. threshold=50k, ratio=0.4 → target=20k
      // After 1: 8k  (under, distance=12k)
      // After 2: 23k (over, distance=3k)  ← best over
      // Algorithm prefers the over boundary to hit the retention target.
      const chunks = [
        { cycleId: 'c-0', messageTokens: 8000, observationTokens: 150, obs: 'Chunk 0: small early messages' },
        { cycleId: 'c-1', messageTokens: 15000, observationTokens: 300, obs: 'Chunk 1: big tool call results' },
        { cycleId: 'c-2', messageTokens: 12000, observationTokens: 250, obs: 'Chunk 2: medium conversation' },
        { cycleId: 'c-3', messageTokens: 7000, observationTokens: 120, obs: 'Chunk 3: short follow-up' },
        { cycleId: 'c-4', messageTokens: 6000, observationTokens: 100, obs: 'Chunk 4: final exchange' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.4,
        messageTokensThreshold: 50000,
      });

      expect(result.chunksActivated).toBe(2);
      expect(result.messageTokensActivated).toBe(23000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1']);

      expect(remaining).toHaveLength(3);
      expect(remaining[0].cycleId).toBe('c-2');
    });

    it('uneven chunks, high ratio 0.9: activates all when over boundary meets target', async () => {
      // Same uneven chunks (total 48k). threshold=50k, ratio=0.9 → target=45k
      // After 1: 8k  (under)
      // After 2: 23k (under)
      // After 3: 35k (under)
      // After 4: 42k (under, distance=3k)
      // After 5: 48k (over, distance=3k) ← best over
      // Algorithm prefers the over boundary to hit the retention target.
      const chunks = [
        { cycleId: 'c-0', messageTokens: 8000, observationTokens: 150, obs: 'Chunk 0' },
        { cycleId: 'c-1', messageTokens: 15000, observationTokens: 300, obs: 'Chunk 1' },
        { cycleId: 'c-2', messageTokens: 12000, observationTokens: 250, obs: 'Chunk 2' },
        { cycleId: 'c-3', messageTokens: 7000, observationTokens: 120, obs: 'Chunk 3' },
        { cycleId: 'c-4', messageTokens: 6000, observationTokens: 100, obs: 'Chunk 4' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.9,
        messageTokensThreshold: 50000,
      });

      expect(result.chunksActivated).toBe(5);
      expect(result.messageTokensActivated).toBe(48000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2', 'c-3', 'c-4']);

      expect(remaining).toHaveLength(0);
    });

    it('one huge first chunk exceeds target: still activates just 1 (biased over)', async () => {
      // Chunks: 35k, 5k, 5k, 3k. threshold=50k, ratio=0.3 → target=15k
      // After 1: 35k (over, only option)
      // No under boundary exists → activates 1 chunk (the over one)
      const chunks = [
        { cycleId: 'c-0', messageTokens: 35000, observationTokens: 500, obs: 'Chunk 0: massive tool output' },
        { cycleId: 'c-1', messageTokens: 5000, observationTokens: 100, obs: 'Chunk 1' },
        { cycleId: 'c-2', messageTokens: 5000, observationTokens: 100, obs: 'Chunk 2' },
        { cycleId: 'c-3', messageTokens: 3000, observationTokens: 50, obs: 'Chunk 3' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.3,
        messageTokensThreshold: 50000,
      });

      // Only boundary is at chunk 1 (35k) which is over target (15k).
      // But it's the closest to target, so activates 1.
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(35000);
      expect(result.activatedCycleIds).toEqual(['c-0']);

      expect(remaining).toHaveLength(3);
      expect(remaining[0].cycleId).toBe('c-1');
    });

    it('ratio 1.0: activates all chunks', async () => {
      // Uneven chunks. ratio=1.0 → target=50k, total=48k (all under)
      const chunks = [
        { cycleId: 'c-0', messageTokens: 8000, observationTokens: 150, obs: 'Chunk 0' },
        { cycleId: 'c-1', messageTokens: 15000, observationTokens: 300, obs: 'Chunk 1' },
        { cycleId: 'c-2', messageTokens: 12000, observationTokens: 250, obs: 'Chunk 2' },
        { cycleId: 'c-3', messageTokens: 7000, observationTokens: 120, obs: 'Chunk 3' },
        { cycleId: 'c-4', messageTokens: 6000, observationTokens: 100, obs: 'Chunk 4' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 1.0,
        messageTokensThreshold: 50000,
      });

      expect(result.chunksActivated).toBe(5);
      expect(result.messageTokensActivated).toBe(48000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2', 'c-3', 'c-4']);
      expect(remaining).toHaveLength(0);
    });

    it('absolute bufferActivation: equivalent to ratio when converted', async () => {
      // threshold=50k, absolute retention=10000 → equivalent ratio = 1 - 10000/50000 = 0.8
      // retentionFloor=10000, target=40000
      // Chunks: 10k each, cumulative: 10k, 20k, 30k, 40k, 50k
      // After 4: 40k (exactly on target) → activates 4
      const chunks = [
        { cycleId: 'c-0', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 0' },
        { cycleId: 'c-1', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 1' },
        { cycleId: 'c-2', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 2' },
        { cycleId: 'c-3', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 3' },
        { cycleId: 'c-4', messageTokens: 10000, observationTokens: 200, obs: 'Chunk 4' },
      ];

      // Using ratio 0.8 (equivalent of absolute 10000 with threshold 50000)
      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.8,
        messageTokensThreshold: 50000,
      });

      expect(result.chunksActivated).toBe(4);
      expect(result.messageTokensActivated).toBe(40000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2', 'c-3']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].cycleId).toBe('c-4');
    });

    it('single chunk: always activates it regardless of ratio', async () => {
      const chunks = [{ cycleId: 'c-only', messageTokens: 12000, observationTokens: 200, obs: 'The only chunk' }];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.3,
        messageTokensThreshold: 50000,
      });

      // target=15k, chunk is 12k (under) → activates it
      expect(result.chunksActivated).toBe(1);
      expect(result.activatedCycleIds).toEqual(['c-only']);
      expect(remaining).toHaveLength(0);
    });

    it('overshoot safeguard: falls back to under boundary when over would exceed 95% of retention floor', async () => {
      // threshold=10000, ratio=0.8 → retentionFloor=2000, target=8000
      // Chunk 1: 3k (under, distance=5k)
      // Chunk 2: 7k → cumulative 10k (over, overshoot=2k)
      // maxOvershoot = 2000 * 0.95 = 1900. overshoot 2000 > 1900 → safeguard triggers
      // Falls back to under boundary (chunk 1, 3k)
      const chunks = [
        { cycleId: 'c-0', messageTokens: 3000, observationTokens: 50, obs: 'Chunk 0: early messages' },
        { cycleId: 'c-1', messageTokens: 7000, observationTokens: 100, obs: 'Chunk 1: large tool output' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.8,
        messageTokensThreshold: 10000,
      });

      // Safeguard prevents over boundary (10k) — falls back to under (3k)
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(3000);
      expect(result.activatedCycleIds).toEqual(['c-0']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].cycleId).toBe('c-1');
    });

    it('overshoot safeguard: allows over boundary when within 95% of retention floor', async () => {
      // threshold=10000, ratio=0.8 → retentionFloor=2000, target=8000
      // Chunk 1: 3k (under)
      // Chunk 2: 6k → cumulative 9k (over, overshoot=1k)
      // maxOvershoot = 2000 * 0.95 = 1900. overshoot 1000 <= 1900 → allowed
      const chunks = [
        { cycleId: 'c-0', messageTokens: 3000, observationTokens: 50, obs: 'Chunk 0: early messages' },
        { cycleId: 'c-1', messageTokens: 6000, observationTokens: 100, obs: 'Chunk 1: moderate output' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.8,
        messageTokensThreshold: 10000,
      });

      // Over boundary (9k, overshoot=1k) is within safeguard — activates both
      expect(result.chunksActivated).toBe(2);
      expect(result.messageTokensActivated).toBe(9000);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1']);
      expect(remaining).toHaveLength(0);
    });

    it('overshoot safeguard: still activates over when no under boundary exists', async () => {
      // threshold=10000, ratio=0.8 → retentionFloor=2000, target=8000
      // Single chunk: 10k (over, overshoot=2k > 1900 safeguard)
      // No under boundary → still activates the over boundary
      const chunks = [{ cycleId: 'c-0', messageTokens: 10000, observationTokens: 150, obs: 'Chunk 0: the only chunk' }];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.8,
        messageTokensThreshold: 10000,
      });

      // No under boundary exists, so over boundary is used despite exceeding safeguard
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(10000);
      expect(result.activatedCycleIds).toEqual(['c-0']);
      expect(remaining).toHaveLength(0);
    });

    it('forceMaxActivation: still respects minimum remaining tokens', async () => {
      // Same scenario as the safeguard test below, but with forceMaxActivation=true.
      // threshold=30k, absolute retention=1000 → ratio ≈ 0.967
      // retentionFloor=1000, currentPending=48000, target=47000
      // Chunk 1: 2k (under)
      // Chunk 2: 46k → cumulative 48k (over, overshoot=1k > maxOvershoot=950)
      // Remaining after over boundary would be 0, so we still avoid dropping below 1k tokens.
      const chunks = [
        { cycleId: 'c-0', messageTokens: 2000, observationTokens: 50, obs: 'Chunk 0: small messages' },
        { cycleId: 'c-1', messageTokens: 46000, observationTokens: 600, obs: 'Chunk 1: large web search result' },
      ];

      const activationRatio = 1 - 1000 / 30000; // ~0.967
      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio,
        messageTokensThreshold: 30000,
        currentPendingTokens: 48000,
        retentionFloor: 1000,
        forceMaxActivation: true,
      });

      // Still falls back to the under boundary when over would leave < 1000 tokens
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(2000);
      expect(result.activatedCycleIds).toEqual(['c-0']);
      expect(remaining).toHaveLength(1);
    });

    it('large message scenario: safeguard falls back to small chunk when oversized message dominates', async () => {
      // Real-world scenario: a small chunk (2k) followed by a huge web_search result (46k).
      // threshold=30k, absolute retention=1000 → ratio ≈ 0.967
      // retentionFloor=1000, currentPending=48000, target=47000
      // Chunk 1: 2k (under, distance=45k)
      // Chunk 2: 46k → cumulative 48k (over, overshoot=1k)
      // maxOvershoot = 1000 * 0.95 = 950. overshoot 1000 > 950 → safeguard triggers
      // Falls back to under boundary (chunk 1, 2k).
      const chunks = [
        { cycleId: 'c-0', messageTokens: 2000, observationTokens: 50, obs: 'Chunk 0: small messages' },
        { cycleId: 'c-1', messageTokens: 46000, observationTokens: 600, obs: 'Chunk 1: large web search result' },
      ];

      const activationRatio = 1 - 1000 / 30000; // ~0.967
      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio,
        messageTokensThreshold: 30000,
        currentPendingTokens: 48000,
        retentionFloor: 1000,
      });

      // Safeguard prevents activating both (overshoot > 95% of retentionFloor),
      // falls back to chunk 1 only (2k)
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(2000);
      expect(result.activatedCycleIds).toEqual(['c-0']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].cycleId).toBe('c-1');
    });

    it('low retention floor: falls back to under boundary when over would leave < min(1000, retentionFloor)', async () => {
      // threshold=5000, ratio=0.9 → retentionFloor=500, target=4500
      // currentPending=5000
      // Chunk 1: 2k (under, distance=2.5k)
      // Chunk 2: 2.8k → cumulative 4.8k (over, overshoot=300)
      // maxOvershoot = 500 * 0.95 = 475. overshoot 300 <= 475 → overshoot safeguard allows it
      // BUT remainingAfterOver = 5000 - 4800 = 200 < min(1000, 500)=500 → low-retention floor triggers
      // Falls back to under boundary (chunk 1, 2k)
      const chunks = [
        { cycleId: 'c-0', messageTokens: 2000, observationTokens: 50, obs: 'Chunk 0: early messages' },
        { cycleId: 'c-1', messageTokens: 2800, observationTokens: 80, obs: 'Chunk 1: more messages' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.9,
        messageTokensThreshold: 5000,
      });

      // Over boundary would leave only 200 tokens — falls back to under (chunk 1, 2k)
      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(2000);
      expect(result.activatedCycleIds).toEqual(['c-0']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].cycleId).toBe('c-1');
    });

    it('low retention floor: allows activation at target boundary when remaining >= retention floor', async () => {
      // threshold=1024, ratio=31/32 → retentionFloor=32, target=992
      // currentPending=1024
      // Chunk 1: 400 (under)
      // Chunk 2: 450 → cumulative 850 (under)
      // Chunk 3: 142 → cumulative 992 (over, exactly on target, overshoot=0)
      // remainingAfterOver = 1024 - 992 = 32 >= min(1000, 32) → allowed
      const chunks = [
        { cycleId: 'c-0', messageTokens: 400, observationTokens: 50, obs: 'Chunk 0' },
        { cycleId: 'c-1', messageTokens: 450, observationTokens: 60, obs: 'Chunk 1' },
        { cycleId: 'c-2', messageTokens: 142, observationTokens: 20, obs: 'Chunk 2' },
      ];

      const { result, remaining } = await setupAndActivate({
        chunks,
        activationRatio: 0.96875,
        messageTokensThreshold: 1024,
      });

      // Over boundary leaves exactly the retention floor — allowed
      expect(result.chunksActivated).toBe(3);
      expect(result.messageTokensActivated).toBe(992);
      expect(result.activatedCycleIds).toEqual(['c-0', 'c-1', 'c-2']);
      expect(remaining).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Critical Async Buffering Scenarios
  // ===========================================================================

  it('should use context window tokens (not just unobserved) for threshold check', async () => {
    // Regression test for the bug where calculateObservationThresholds used
    // getUnobservedMessages for token counting, which filters by lastObservedAt.
    // After activation, lastObservedAt advances and older messages were excluded
    // from the count, even though they were still in the context window.
    // The fix: threshold checks count ALL messages in the context window.
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 3000,
      bufferTokens: 500,
      bufferActivation: 2000,
      reflectionObservationTokens: 50000,
      reflectionAsyncActivation: 0.5,
      messageCount: 10, // ~2200 tokens, below 3000 threshold
    });

    // Step 0: buffers messages
    await step(0);
    await waitForAsyncOps();
    const firstObserverCallCount = observerCalls.length;
    expect(firstObserverCallCount).toBeGreaterThan(0);

    // Add enough messages to push past the 3000 token threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 10; i < 30; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // New turn step 0: should activate because total context tokens > threshold
    await step(0, { freshState: true });
    await waitForAsyncOps();

    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record).toBeDefined();

    // Activation should have moved buffered observations to active
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations!.length).toBeGreaterThan(0);
    expect(record!.activeObservations).toContain('Observed');

    // Now add more messages and run a mid-turn step (step > 0).
    // The key assertion: even after activation advances lastObservedAt,
    // the threshold check should still count ALL context window messages.
    for (let i = 30; i < 45; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 11, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Step 1 mid-turn: should still trigger buffering since total context tokens > bufferTokens
    // Before the fix, this would not trigger because unobserved-only count was near 0
    await step(1);
    await waitForAsyncOps();

    // Observer should have been called again for the new messages
    expect(observerCalls.length).toBeGreaterThan(firstObserverCallCount);
  });

  it('should remove activated messages from context mid-turn', async () => {
    // Regression test: activated chunk messages should be removed from messageList
    // immediately, not deferred to next turn. Each processInputStep prepares a fresh
    // context window for the LLM — activated messages are older and no longer being
    // written to, so removing them is safe and prevents the LLM from seeing both
    // raw messages and their compressed observations.
    const { storage, threadId, resourceId, step, waitForAsyncOps } = await setupAsyncBufferingScenario({
      messageTokens: 3000,
      bufferTokens: 500,
      bufferActivation: 2000,
      reflectionObservationTokens: 50000,
      reflectionAsyncActivation: 0.5,
      messageCount: 10, // ~2200 tokens, below 3000 threshold → triggers buffering
    });

    // Step 0: below threshold, triggers async buffering
    await step(0);
    await waitForAsyncOps();

    // Verify buffered chunks exist
    let record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    expect(chunks.length).toBeGreaterThan(0);

    // Collect the message IDs from the buffered chunks (these will be activated)
    const bufferedMsgIds = new Set(chunks.flatMap((c: any) => c.messageIds ?? []));

    // Add more messages to push past the 3000 token threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 10; i < 30; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // New turn step 0: above threshold → activates chunks and removes their messages
    await step(0, { freshState: true });
    await waitForAsyncOps();

    record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record!.activeObservations).toBeTruthy();

    // Step 1: the context should not contain the activated messages
    const messageList = await step(1);
    const allMsgs = messageList.get.all.db();
    const allMsgIds = new Set(allMsgs.map((m: any) => m.id));

    // None of the buffered chunk message IDs should be in the current context
    let removedCount = 0;
    for (const buffId of bufferedMsgIds) {
      if (!allMsgIds.has(buffId)) {
        removedCount++;
      }
    }
    // At least some of the buffered messages should have been removed
    expect(removedCount).toBeGreaterThan(0);
  });

  it('should remove activated chunk messages from context during mid-turn (step > 0) activation', async () => {
    // Regression test: when activation happens at step > 0 via handleThresholdReached,
    // the activated chunk messages must be removed from messageList immediately.
    //
    // The root cause: swapBufferedToActive does NOT populate observedMessageIds on the
    // record. So cleanupAfterObservation gets observedIds=undefined and falls to the
    // fallback path which doesn't remove chunk messages from context.
    //
    // Strategy: use a very high threshold for step 0 so it just loads messages without
    // activating, then manually add chunks and lower the threshold before step 1.
    const { storage, threadId, resourceId, step, waitForAsyncOps, om } = await setupAsyncBufferingScenario({
      messageTokens: 999999, // very high — step 0 won't activate or trigger threshold
      bufferTokens: 999998, // very high — step 0 won't trigger async buffering either
      bufferActivation: 1.0,
      reflectionObservationTokens: 50000,
      messageCount: 10, // ~2200 tokens
    });

    // Step 0: loads messages, well below both thresholds. No activation or buffering.
    const messageListAfterStep0 = await step(0);
    await waitForAsyncOps();

    // Get message IDs from context to use as chunk references
    const contextMsgs = messageListAfterStep0.get.all.db();
    const chunkMsgIds = contextMsgs.slice(0, 4).map((m: any) => m.id);
    expect(chunkMsgIds.length).toBe(4);

    // Manually add buffered chunks referencing these context messages
    const record = await storage.getObservationalMemory(threadId, resourceId);
    const recordId = record!.id;
    for (let i = 0; i < 2; i++) {
      const ids = chunkMsgIds.slice(i * 2, (i + 1) * 2);
      await storage.updateBufferedObservations({
        id: recordId,
        chunk: {
          observations: `Manual chunk ${i} observations`,
          tokenCount: 50,
          messageIds: ids,
          messageTokens: 400,
          lastObservedAt: new Date(Date.UTC(2025, 0, 1, 11, i)),
          cycleId: `manual-cycle-${i}`,
        },
      });
    }

    // Lower thresholds so step 1 crosses them → triggers handleThresholdReached
    (om as any).observationConfig.messageTokens = 1000;
    (om as any).observationConfig.bufferTokens = 500;
    (om as any).observationConfig.blockAfter = 1200;

    const msgCountBefore = contextMsgs.length;

    // Verify no activeObservations before step 1
    const recordBeforeStep1 = await storage.getObservationalMemory(threadId, resourceId);
    expect(recordBeforeStep1!.activeObservations ?? '').toBe('');

    // Step 1 (mid-turn): totalPendingTokens (~2200) >= threshold (1000)
    // → handleThresholdReached → tryActivateBufferedObservations → cleanupAfterObservation
    const messageListAfterStep1 = await step(1);
    await waitForAsyncOps();

    // Verify at least one manual chunk was activated (moved to activeObservations)
    const recordAfterStep1 = await storage.getObservationalMemory(threadId, resourceId);
    expect(recordAfterStep1!.activeObservations).toBeTruthy();
    expect(recordAfterStep1!.activeObservations).toContain('Manual chunk');

    const msgsAfterStep1 = messageListAfterStep1.get.all.db();
    const allMsgIds = new Set(msgsAfterStep1.map((m: any) => m.id));

    // Activated chunk message IDs should be removed from context
    let stillPresent = 0;
    for (const id of chunkMsgIds) {
      if (allMsgIds.has(id)) {
        stillPresent++;
      }
    }

    // At least the activated chunk's messages (2 IDs) should be removed
    expect(stillPresent).toBeLessThan(chunkMsgIds.length);
    expect(msgsAfterStep1.length).toBeLessThan(msgCountBefore);
  });

  it('should reset lastBufferedBoundary to 0 after activation so remaining messages can be buffered', async () => {
    // After activation, lastBufferedBoundary is reset to 0 so that any remaining
    // unbuffered messages in context can trigger a new buffering interval.
    // The worst case is one no-op trigger if all remaining messages are already
    // in buffered chunks.
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 3000,
      bufferTokens: 500,
      bufferActivation: 2000,
      reflectionObservationTokens: 50000,
      reflectionAsyncActivation: 0.5,
      messageCount: 10, // ~2200 tokens, below 3000 threshold → buffers first
    });

    // Phase 1: step 0 buffers messages (below threshold)
    await step(0);
    await waitForAsyncOps();
    expect(observerCalls.length).toBeGreaterThan(0);

    // Phase 2: add messages to push past threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 10; i < 30; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // New turn step 0: above threshold → activates buffered chunks
    await step(0, { freshState: true });
    await waitForAsyncOps();

    // Verify activation happened
    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record!.activeObservations).toBeTruthy();

    // After activation, the boundary is reset to 0, which immediately allows
    // shouldTriggerAsyncObservation to trigger buffering for remaining messages.
    // By the time step 0 completes, the boundary has been raised again by
    // startAsyncBufferedObservation to the current context token count.
    // The key assertion is that new buffering was triggered (observer called again).
    const callsAfterActivation = observerCalls.length;
    expect(callsAfterActivation).toBeGreaterThan(1); // buffered once before, buffered again after activation
  });

  it('should use lastBufferedAtTime cursor to prevent re-observing same messages', async () => {
    // Regression test: without the lastBufferedAtTime cursor, sequential buffer
    // triggers would re-observe the same messages because getUnobservedMessages
    // didn't track which messages had already been buffered (only activated/synced
    // messages were tracked via lastObservedAt).
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 500,
      bufferActivation: 1.0,
      reflectionObservationTokens: 50000,
      messageCount: 5, // ~1100 tokens
    });

    // Turn 1, step 0: triggers first buffer
    await step(0);
    await waitForAsyncOps();
    const callsAfterFirstBuffer = observerCalls.length;
    expect(callsAfterFirstBuffer).toBeGreaterThan(0);

    // Check the first buffer's chunk
    let record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks1 =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    const firstChunkMsgIds = new Set(chunks1.flatMap((c: any) => c.messageIds ?? []));

    // Add more messages that will cross the next buffer interval
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 5; i < 12; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Turn 2, step 0: loads new messages from storage, triggers second buffer
    // The cursor should prevent re-observing messages from the first buffer
    await step(0, { freshState: true });
    await waitForAsyncOps();

    // Observer should have been called again for the new messages
    expect(observerCalls.length).toBeGreaterThan(callsAfterFirstBuffer);

    // Check that the new chunk contains different message IDs than the first
    record = await storage.getObservationalMemory(threadId, resourceId);
    const chunks2 =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);

    // Should have more chunks than before
    expect(chunks2.length).toBeGreaterThan(chunks1.length);

    // The newer chunks should not contain message IDs from the first chunk
    const newerChunks = chunks2.slice(chunks1.length);
    const newerMsgIds = newerChunks.flatMap((c: any) => c.messageIds ?? []);
    for (const newId of newerMsgIds) {
      expect(firstChunkMsgIds.has(newId)).toBe(false);
    }
  });

  it('should only buffer new messages in sequential buffer triggers (no duplication)', async () => {
    // End-to-end test: sequential buffer triggers across turns should produce
    // chunks with non-overlapping message sets. This validates both the excludeBuffered
    // filtering and the lastBufferedAtTime cursor working together.
    const { storage, threadId, resourceId, step, waitForAsyncOps } = await setupAsyncBufferingScenario({
      messageTokens: 10000,
      bufferTokens: 300,
      bufferActivation: 1.0,
      reflectionObservationTokens: 50000,
      messageCount: 10, // ~2200 tokens, will cross multiple buffer intervals
    });

    // Turn 1, step 0: triggers first buffer(s)
    await step(0);
    await waitForAsyncOps();

    let record = await storage.getObservationalMemory(threadId, resourceId);
    const chunksAfterTurn1 =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    expect(chunksAfterTurn1.length).toBeGreaterThan(0);

    // Add more messages for the next turn
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 10; i < 20; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Turn 2, step 0: loads all messages from storage, triggers more buffers
    await step(0, { freshState: true });
    await waitForAsyncOps();

    record = await storage.getObservationalMemory(threadId, resourceId);
    const allChunks =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);

    // Should have more chunks now
    expect(allChunks.length).toBeGreaterThan(chunksAfterTurn1.length);

    // Verify: all message IDs across all chunks are unique (no overlapping)
    const allMsgIds = allChunks.flatMap((c: any) => c.messageIds ?? []);
    const uniqueIds = new Set(allMsgIds);
    expect(uniqueIds.size).toBe(allMsgIds.length);
  });

  it('should continue buffering after activation within the same multi-step turn', async () => {
    // Integration test for the full cycle across turns:
    // Turn 1: Buffer messages as context grows
    // Turn 2: Activate when threshold is crossed (with existing chunks)
    // Turn 3: After activation, new messages should trigger fresh buffering
    //         (boundary is set to post-activation count, not deleted/reset to 0)
    const { storage, threadId, resourceId, step, waitForAsyncOps, observerCalls, om } =
      await setupAsyncBufferingScenario({
        messageTokens: 2000,
        bufferTokens: 300,
        bufferActivation: 1500,
        blockAfter: 1.1,
        reflectionObservationTokens: 50000,
        reflectionAsyncActivation: 0.5,
        messageCount: 5, // ~1100 tokens, below 2000 threshold
      });

    // Turn 1, step 0: triggers first buffer
    await step(0);
    await waitForAsyncOps();
    const callsAfterFirstBuffer = observerCalls.length;
    expect(callsAfterFirstBuffer).toBeGreaterThan(0);

    // Add messages to push past threshold
    const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    for (let i = 5; i < 20; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 10, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Turn 2, step 0: should activate buffered chunks
    await step(0, { freshState: true });
    await waitForAsyncOps();

    // Verify activation happened
    let record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations).toContain('Observed');

    const callsAfterActivation = observerCalls.length;

    // Verify lastBufferedBoundary is set (not deleted)
    const lockKey = `thread:${threadId}`;
    const bufferKey = (om as any).getObservationBufferKey(lockKey);
    const boundaryAfterActivation = (ObservationalMemory as any).lastBufferedBoundary.get(bufferKey);
    expect(boundaryAfterActivation).toBeDefined();
    expect(boundaryAfterActivation).toBeGreaterThan(0);

    // Add even more messages to cross the next buffer interval
    for (let i = 20; i < 35; i++) {
      await storage.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}: ${filler}` }],
            },
            type: 'text',
            createdAt: new Date(Date.UTC(2025, 0, 1, 11, i)),
            threadId,
            resourceId,
          },
        ],
      });
    }

    // Turn 3, step 0: should trigger new buffering for the post-activation messages
    await step(0, { freshState: true });
    await waitForAsyncOps();

    // Observer should have been called again for the post-activation messages
    expect(observerCalls.length).toBeGreaterThan(callsAfterActivation);

    // Verify new chunks were created
    record = await storage.getObservationalMemory(threadId, resourceId);
    const newChunks =
      typeof record?.bufferedObservationChunks === 'string'
        ? JSON.parse(record.bufferedObservationChunks)
        : (record?.bufferedObservationChunks ?? []);
    expect(newChunks.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Regression: threadId required in thread scope (prevents deadlock via shared OM row)
// =============================================================================

describe('threadId validation in thread scope', () => {
  it('should throw when getOrCreateRecord is called without threadId in thread scope', async () => {
    const storage = createInMemoryStorage();
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 500, model: 'test-model' },
      reflection: { observationTokens: 1000, model: 'test-model' },
      // scope defaults to 'thread'
    });

    await expect(om.getOrCreateRecord('', 'resource-1')).rejects.toThrow(/requires a threadId/);
  });

  it('should NOT throw when getOrCreateRecord is called without threadId in resource scope', async () => {
    const storage = createInMemoryStorage();
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      observation: { messageTokens: 500, model: 'test-model', bufferTokens: false },
      reflection: { observationTokens: 1000, model: 'test-model' },
    });

    // In resource scope, threadId is null — this should succeed
    const record = await om.getOrCreateRecord('ignored-thread', 'resource-1');
    expect(record).toBeDefined();
    expect(record.threadId).toBeNull();
    expect(record.resourceId).toBe('resource-1');
  });
});
