import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
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
          observer: { observationThreshold: 10000, model: 'test-model' },
          reflector: { reflectionThreshold: 20000, model: 'test-model' },
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

    it('should set lastObservedAt when swapping buffered to active', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Initially, lastObservedAt should be undefined
      expect(initial.metadata.lastObservedAt).toBeUndefined();

      // Add buffered observations
      await storage.updateBufferedObservations({
        id: initial.id,
        observations: '- 🟡 Buffered observation',
        messageIds: ['msg-1'],
      });

      const beforeSwap = new Date();
      await storage.swapBufferedToActive(initial.id);
      const afterSwap = new Date();

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.metadata.lastObservedAt).toBeDefined();
      // lastObservedAt should be set to approximately now
      expect(record!.metadata.lastObservedAt!.getTime()).toBeGreaterThanOrEqual(beforeSwap.getTime());
      expect(record!.metadata.lastObservedAt!.getTime()).toBeLessThanOrEqual(afterSwap.getTime());
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

    it('should set lastObservedAt when provided', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Initially, lastObservedAt should be undefined
      expect(initial.metadata.lastObservedAt).toBeUndefined();

      const observedAt = new Date('2025-01-15T10:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Test observation',
        messageIds: ['msg-1'],
        tokenCount: 100,
        lastObservedAt: observedAt,
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.metadata.lastObservedAt).toEqual(observedAt);
    });

    it('should preserve lastObservedAt if not provided in update', async () => {
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
        messageIds: ['msg-1'],
        tokenCount: 100,
        lastObservedAt: firstObservedAt,
      });

      // Second update without lastObservedAt - should preserve the previous value
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Second observation',
        messageIds: ['msg-2'],
        tokenCount: 150,
        // Note: no lastObservedAt provided
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.metadata.lastObservedAt).toEqual(firstObservedAt);
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
      // After reflection, observedMessageIds are RESET since old messages are now "baked into" the reflection.
      // The previous DB record retains its observedMessageIds as historical record.
      expect(newRecord.observedMessageIds).toEqual([]);
      // Buffered state is reset
      expect(newRecord.bufferedMessageIds).toEqual([]);
      expect(newRecord.bufferingMessageIds).toEqual([]);
    });

    it('should set lastObservedAt on new reflection generation', async () => {
      const initial = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
      });

      // Set an older lastObservedAt on the initial record
      const oldObservedAt = new Date('2025-01-01T00:00:00Z');
      await storage.updateActiveObservations({
        id: initial.id,
        observations: '- 🔴 Original observations',
        messageIds: ['msg-1'],
        tokenCount: 30000,
        lastObservedAt: oldObservedAt,
      });

      const currentRecord = await storage.getObservationalMemory(threadId, resourceId);
      expect(currentRecord?.metadata.lastObservedAt).toEqual(oldObservedAt);

      const beforeReflection = new Date();
      const newRecord = await storage.createReflectionGeneration({
        currentRecord: currentRecord!,
        reflection: '- 🔴 Condensed reflection',
        tokenCount: 5000,
      });
      const afterReflection = new Date();

      // New record should have a fresh lastObservedAt (approximately now)
      expect(newRecord.metadata.lastObservedAt).toBeDefined();
      expect(newRecord.metadata.lastObservedAt!.getTime()).toBeGreaterThanOrEqual(beforeReflection.getTime());
      expect(newRecord.metadata.lastObservedAt!.getTime()).toBeLessThanOrEqual(afterReflection.getTime());

      // Previous record should retain its original lastObservedAt
      const history = await storage.getObservationalMemoryHistory(threadId, resourceId);
      const previousRecord = history?.find(r => r.id === initial.id);
      expect(previousRecord?.metadata.lastObservedAt).toEqual(oldObservedAt);
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
      expect(result.observations).toContain('Working on implementation');
    });

    it('should handle output without continuation hint', () => {
      const output = '- 🔴 Simple observation';
      const result = parseObserverOutput(output);

      // Now adds default Current Task if missing (in XML format)
      expect(result.observations).toContain('- 🔴 Simple observation');
      expect(result.observations).toContain('<current-task>');
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
        expect(result.observations).toContain('Help user with conditional rendering');
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
        // Current task should include the inline tag mention
        expect(result.observations).toContain('Explain the <observations> tag format');
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
        expect(result.observations).toContain('Help user understand memory XML structure');
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
        expect(result.observations).toContain('Help user implement XML parsing');
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
        expect(result.observations).toContain('Help user understand XML tag boundaries');
      });

      it('should NOT be truncated by inline closing </current-task> tag', () => {
        const output = `<observations>
- 🔴 User info here
</observations>

<current-task>
User asked about </current-task> parsing and how it works
</current-task>`;

        const result = parseObserverOutput(output);
        // Should capture the full current-task content
        expect(result.observations).toContain('User asked about </current-task> parsing');
      });
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
        expect(result.observations).toContain('Help user implement XML parsing');
      });
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
        observationThreshold: 500, // Low threshold for testing
        model: 'test-model',
      },
      reflector: {
        reflectionThreshold: 1000,
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
        messageIds: ['old-msg-1', 'old-msg-2'],
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
        messageIds: ['pre-reflection-msg'],
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
      expect(newRecord.metadata.lastObservedAt).toBeDefined();
      const reflectionTime = newRecord.metadata.lastObservedAt!;

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

    // After reflection, observedMessageIds are RESET since old messages are now "baked into" the reflection.
    // The previous DB record (gen1) retains its observedMessageIds as historical record.
    expect(gen2.observedMessageIds.length).toBe(0);

    // Getting current record returns new generation
    const current = await storage.getObservationalMemory('thread-1', 'resource-1');
    expect(current?.id).toBe(gen2.id);
    expect(current?.activeObservations).toBe('- 🔴 Condensed: User working on project X');
  });
});


// =============================================================================
// Unit Tests: Current Task Validation
// =============================================================================

import { hasCurrentTaskSection, extractCurrentTask } from '../observer-agent';

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
- 🟢 Minor note`;

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

      // Should have added a default Current Task (in XML format)
      expect(result.observations).toContain('<current-task>');
    });

    it('should not modify if Current Task already present (XML format)', () => {
      const output = `<observations>
- 🔴 User asked about React
</observations>

<current-task>
Help user set up React project
</current-task>`;

      const result = parseObserverOutput(output);

      // Should not have duplicated
      const matches = result.observations.match(/current-task/gi);
      expect(matches?.length).toBe(2); // opening and closing tags
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

  it('observer prompt should require Current Task section', () => {
    const messages = [createTestMessage('Help me build a todo app', 'user')];

    const prompt = buildObserverPrompt(undefined, messages);

    expect(prompt).toContain('**Current Task:**');
    expect(prompt).toContain('MUST end your observations');
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
      messageIds: ['session1-msg1', 'session1-msg2'],
      tokenCount: 100,
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
// LongMemEval End-to-End Test
// =============================================================================

/**
 * This test uses actual data from the first LongMemEval question (e47becba)
 * to verify the observational memory system correctly preserves and retrieves
 * key facts needed to answer evaluation questions.
 *
 * LongMemEval Question e47becba:
 * - Question: "What degree did I graduate with?"
 * - Answer: "Business Administration"
 * - 54 haystack sessions, answer in session index 52 (answer_280352e9)
 * - Turn 4 (user) says: "I graduated with a degree in Business Administration..."
 *
 * The test simulates the benchmark flow:
 * 1. Load the first question from the dataset
 * 2. Process the session containing the key fact through ObservationalMemory
 * 3. Verify the observations contain "Business Administration"
 */

import firstQuestion from './fixtures/longmemeval-first-question.json';

interface LongMemEvalTurn {
  role: 'user' | 'assistant';
  content: string;
  has_answer?: boolean;
}

interface LongMemEvalQuestionData {
  question_id: string;
  question_type: string;
  question: string;
  answer: string;
  question_date: string;
  haystack_session_ids: string[];
  haystack_dates: string[];
  haystack_sessions: LongMemEvalTurn[][];
  answer_session_ids: string[];
}

describe('LongMemEval End-to-End Test (Question e47becba)', () => {
  const questionData = firstQuestion as LongMemEvalQuestionData;

  // Find the session that contains the answer
  const answerSessionId = questionData.answer_session_ids[0]; // 'answer_280352e9'
  const answerSessionIndex = questionData.haystack_session_ids.indexOf(answerSessionId);
  const answerSession = questionData.haystack_sessions[answerSessionIndex];

  it('should have loaded the correct fixture data', () => {
    expect(questionData.question_id).toBe('e47becba');
    expect(questionData.question).toBe('What degree did I graduate with?');
    expect(questionData.answer).toBe('Business Administration');
    expect(questionData.haystack_sessions.length).toBe(54);
    expect(answerSessionIndex).toBe(52);
  });

  it('should identify the turn containing the key fact', () => {
    // Find the turn with has_answer=true
    const answerTurn = answerSession.find(turn => turn.has_answer && turn.role === 'user');

    expect(answerTurn).toBeDefined();
    expect(answerTurn?.content).toContain('Business Administration');
    expect(answerTurn?.content).toContain('graduated');
  });

  describe('Message Formatting', () => {
    it('should preserve key fact when formatting the answer session for observer', () => {
      const messages = answerSession.map((turn, i) =>
        createTestMessage(turn.content, turn.role as 'user' | 'assistant', `answer-session-${i}`),
      );

      const formatted = formatMessagesForObserver(messages);

      // The key fact MUST be present
      expect(formatted).toContain('Business Administration');
      expect(formatted).toContain('graduated');
      expect(formatted).toContain('degree');
    });

    it('should build observer prompt with the key fact visible', () => {
      const messages = answerSession.map((turn, i) =>
        createTestMessage(turn.content, turn.role as 'user' | 'assistant', `answer-session-${i}`),
      );

      const prompt = buildObserverPrompt(undefined, messages);

      // Observer prompt must contain the key fact for extraction
      expect(prompt).toContain('Business Administration');
      expect(prompt).toContain('graduated');
    });
  });

  describe('Observer Output Parsing', () => {
    it('should correctly parse ideal observer output for this question', () => {
      // This is what an ideal observer output should look like for this question (XML format)
      const idealObserverOutput = `<observations>
- 🔴 **User Education:** User graduated with a degree in Business Administration [personal_fact, education]
- 🟡 **Employment:** User started a new job and is adjusting to 9-to-5 schedule [personal_fact]
- 🟡 **Task Management:** User is trying Todoist and Trello for task organization [user_preference]
- 🟡 **Organization Needs:** User needs help with paperwork, documentation, and expense tracking [task]
</observations>

<current-task>
Help user with personal expense tracking app recommendations.
</current-task>

<suggested-response>
For personal expense tracking...
</suggested-response>`;

      const result = parseObserverOutput(idealObserverOutput);

      // Must preserve the key fact
      expect(result.observations).toContain('Business Administration');
      expect(result.observations).toContain('graduated');
      expect(result.observations).toContain('degree');

      // Must have Current Task
      expect(hasCurrentTaskSection(result.observations)).toBe(true);

      // Should extract continuation hint
      expect(result.suggestedContinuation).toBeDefined();
    });

    it('should add default Current Task if observer omits it', () => {
      // Observer output missing Current Task
      const incompleteOutput = `- 🔴 **User Education:** User graduated with a degree in Business Administration [personal_fact, education]
- 🟡 **Employment:** User started a new job [personal_fact]`;

      const result = parseObserverOutput(incompleteOutput);

      // Should have added Current Task (in XML format)
      expect(result.observations).toContain('<current-task>');
      // Key fact must still be present
      expect(result.observations).toContain('Business Administration');
    });
  });

  describe('Token Optimization', () => {
    it('should preserve key fact after optimization', () => {
      const observations = `- 🔴 **User Education (May 2023):** User graduated with a degree in Business Administration [personal_fact, education]
- 🟡 **Task Management:** User prefers digital tools over physical planners [user_preference]
  - -> 🟢 Will try Todoist [user_preference]
  - -> 🟢 Will try Trello [user_preference]
- 🟡 **Employment Status:** User has a new 9-to-5 job [personal_fact, employment]
- 🟢 **Minor:** User mentioned using a physical planner before [context]

**Current Task:** Help user track personal expenses and recommend apps.`;

      const optimized = optimizeObservationsForContext(observations);

      // Key fact MUST survive optimization
      expect(optimized).toContain('Business Administration');
      expect(optimized).toContain('graduated');
      expect(optimized).toContain('degree');
    });
  });


  describe('Storage Integration', () => {
    it('should store and retrieve observations containing the key fact', async () => {
      const storage = createInMemoryStorage();

      // Initialize resource-scoped memory (like LongMemEval uses)
      const record = await storage.initializeObservationalMemory({
        threadId: null, // Resource scope
        resourceId: `resource_${questionData.question_id}`,
        scope: 'resource',
        config: {},
      });

      // Simulate observer extracting observations from the answer session
      const observationsWithKeyFact = `- 🔴 **User Education:** User graduated with a degree in Business Administration [personal_fact, education]
- 🟡 **Employment:** User started a new 9-to-5 job [personal_fact]
- 🟡 **Task Management:** User prefers digital tools, trying Todoist and Trello [user_preference]

**Current Task:** Help user with expense tracking organization`;

      await storage.updateActiveObservations({
        id: record.id,
        observations: observationsWithKeyFact,
        messageIds: answerSession.map((_, i) => `answer-session-msg-${i}`),
        tokenCount: 200,
      });

      // Retrieve and verify
      const retrieved = await storage.getObservationalMemory(null, `resource_${questionData.question_id}`);

      expect(retrieved).toBeDefined();
      expect(retrieved?.activeObservations).toContain('Business Administration');
      expect(retrieved?.activeObservations).toContain('graduated');
      expect(retrieved?.activeObservations).toContain('degree');

      // The observations should be sufficient to answer: "What degree did I graduate with?"
      // Answer: "Business Administration"
    });

    it('should preserve key fact across multiple session updates', async () => {
      const storage = createInMemoryStorage();

      const record = await storage.initializeObservationalMemory({
        threadId: null,
        resourceId: `resource_${questionData.question_id}`,
        scope: 'resource',
        config: {},
      });

      // Session 1 (before key fact): random conversation
      await storage.updateActiveObservations({
        id: record.id,
        observations: `- 🟡 **Random Topic:** User discussed weather [context]

**Current Task:** Continue conversation`,
        messageIds: ['session1-msg1'],
        tokenCount: 50,
      });

      // Session 2: Contains the key fact
      const record1 = await storage.getObservationalMemory(null, `resource_${questionData.question_id}`);
      await storage.updateActiveObservations({
        id: record.id,
        observations:
          record1?.activeObservations +
          `
- 🔴 **User Education:** User graduated with a degree in Business Administration [personal_fact, education]

**Current Task:** Help with expense tracking`,
        messageIds: ['session1-msg1', 'session2-msg1', 'session2-msg2'],
        tokenCount: 100,
      });

      // Session 3 (after key fact): more conversation
      const record2 = await storage.getObservationalMemory(null, `resource_${questionData.question_id}`);
      await storage.updateActiveObservations({
        id: record.id,
        observations:
          record2?.activeObservations +
          `
- 🟡 **Follow-up:** User is exploring Mint app for finances [task]

**Current Task:** Compare expense tracking options`,
        messageIds: ['session1-msg1', 'session2-msg1', 'session2-msg2', 'session3-msg1'],
        tokenCount: 150,
      });

      // Final verification - key fact must still be present
      const finalRecord = await storage.getObservationalMemory(null, `resource_${questionData.question_id}`);

      expect(finalRecord?.activeObservations).toContain('Business Administration');
      expect(finalRecord?.activeObservations).toContain('graduated');
      expect(finalRecord?.activeObservations).toContain('degree');

      // Can answer: "What degree did I graduate with?" -> "Business Administration"
    });
  });

  describe('Full Session Token Count', () => {
    it('should calculate reasonable token counts for the answer session', () => {
      const counter = new TokenCounter();
      const messages = answerSession.map((turn, i) =>
        createTestMessage(turn.content, turn.role as 'user' | 'assistant', `answer-session-${i}`),
      );

      const tokenCount = counter.countMessages(messages);

      // The answer session (12 turns) should be a reasonable size
      expect(tokenCount).toBeGreaterThan(500); // Not trivially small
      expect(tokenCount).toBeLessThan(10000); // Not excessively large

      // Log for debugging
      // console.log(`Answer session has ${answerSession.length} turns, ${tokenCount} tokens`);
    });
  });
});

// =============================================================================
// End-to-End Integration Test: Agent + ObservationalMemory Processor
// =============================================================================

/**
 * This test mirrors the actual LongMemEval benchmark flow from prepare.ts:
 * 1. Create storage and ObservationalMemory processor
 * 2. Create an Agent with ObservationalMemory as input/output processors
 * 3. Process ALL 54 sessions sequentially through agent.generate() with proper threadId/resourceId
 * 4. Ask the question and verify the agent can answer correctly
 *
 * This is the REALISTIC test that matches exactly how the benchmark works:
 * - 54 sessions sorted chronologically
 * - Each session gets its own threadId
 * - All sessions share the same resourceId
 * - Sessions processed sequentially (not concurrently)
 * - Key fact "Business Administration" is in session 52
 *
 * REQUIRES: GOOGLE_GENERATIVE_AI_API_KEY environment variable
 */
describe('E2E: Agent + ObservationalMemory (LongMemEval Flow)', () => {
  const questionData = firstQuestion as LongMemEvalQuestionData;
  const resourceId = `resource_${questionData.question_id}`;

  // Skip tests if no API key is available
  const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  /**
   * REALISTIC FULL BENCHMARK TEST
   *
   * This test processes ALL 54 sessions in chronological order,
   * exactly like the actual LongMemEval benchmark does in prepare.ts.
   *
   * Flow:
   * 1. Sort sessions by date (oldest first)
   * 2. Process each session through agent.generate() with unique threadId
   * 3. All sessions share the same resourceId for cross-session memory
   * 4. After all sessions, ask the question to verify recall
   */
  // TODO: Re-enable once per-resource architecture is working properly
  // This test requires cross-session memory (resourceScope: true) to work correctly
  it.skip(
    'FULL BENCHMARK: should process all 54 sessions and recall key fact',
    async () => {
      // 1. Create storage
      const storage = createInMemoryStorage();

      // 2. Create ObservationalMemory with realistic thresholds (matching benchmark config)
      // Use REAL model for Observer/Reflector - they need real LLMs to extract observations
      const om = new ObservationalMemory({
        storage,
        observer: {
          model: 'google/gemini-2.5-flash',
          // Use threshold range like the benchmark
          observationThreshold: { min: 4000, max: 6000 },
        },
        reflector: {
          model: 'google/gemini-2.5-flash',
          reflectionThreshold: { min: 12000, max: 18000 },
        },
        resourceScope: true, // Cross-session memory - critical for LongMemEval
      });

      // 3. Create mock model for main agent during ingestion
      // The main agent doesn't need to generate real responses during ingestion
      // Only the Observer/Reflector subagents need real LLMs
      const mockAgentModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Acknowledged.' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Acknowledged.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      // 4. Create Agent with mock model for ingestion, ObservationalMemory as processors
      const agent = new Agent({
        id: 'longmemeval-agent',
        name: 'LongMemEval Test Agent',
        instructions: 'You are a helpful assistant. Process and store conversation history.',
        model: mockAgentModel,
        inputProcessors: [om],
        outputProcessors: [om],
      });

      // 5. Sort sessions chronologically (oldest first) - exactly like prepare.ts
      const sessionsWithDates = questionData.haystack_sessions.map((session, index) => ({
        session,
        sessionId: questionData.haystack_session_ids[index],
        date: questionData.haystack_dates[index],
      }));

      sessionsWithDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      console.log(`\n📊 Processing ${sessionsWithDates.length} sessions chronologically...`);
      console.log(`   First session: ${sessionsWithDates[0].date}`);
      console.log(`   Last session: ${sessionsWithDates[sessionsWithDates.length - 1].date}`);

      // Find where the answer session falls in chronological order
      const answerSessionId = questionData.answer_session_ids[0];
      const answerSessionChronoIndex = sessionsWithDates.findIndex(s => s.sessionId === answerSessionId);
      console.log(`   Answer session "${answerSessionId}" is at chronological index ${answerSessionChronoIndex}`);

      // 6. Process ALL sessions sequentially (not concurrently) - exactly like prepare.ts
      // Process each message pair one at a time so Observer has multiple chances to make observations
      let processedCount = 0;
      for (const { session, sessionId, date } of sessionsWithDates) {
        // Convert session turns to messages
        const messages = session
          .filter(turn => turn.content) // Skip empty content
          .map(turn => ({
            role: turn.role as 'user' | 'assistant',
            content: turn.content,
          }));

        if (messages.length === 0) {
          processedCount++;
          continue;
        }

        // Process message pairs (user + assistant) one at a time
        // This gives Observer multiple chances to make observations
        for (let i = 0; i < messages.length; i += 2) {
          const messagePair = messages.slice(i, Math.min(i + 2, messages.length));
          await agent.generate(messagePair as any, {
            memory: {
              thread: sessionId,
              resource: resourceId,
            },
          });
        }

        processedCount++;

        // Log progress every 10 sessions
        if (processedCount % 10 === 0 || sessionId === answerSessionId) {
          const record = await storage.getObservationalMemory(null, resourceId);
          const hasKeyFact = record?.activeObservations?.includes('Business Administration') ?? false;
          console.log(
            `   [${processedCount}/${sessionsWithDates.length}] ${sessionId.substring(0, 12)}... ` +
              `(${date}) - observations: ${record?.observationTokenCount ?? 0} tokens` +
              (sessionId === answerSessionId ? ' ⭐ ANSWER SESSION' : '') +
              (hasKeyFact ? ' ✅ KEY FACT FOUND' : ''),
          );
        }
      }

      // 7. Check observations after processing all sessions
      const finalRecord = await storage.getObservationalMemory(null, resourceId);
      console.log(`\n📝 Final observations: ${finalRecord?.observationTokenCount ?? 0} tokens`);
      console.log(`   Observed message IDs: ${finalRecord?.observedMessageIds.length ?? 0}`);

      // The key fact should be in observations
      expect(finalRecord).toBeDefined();
      expect(finalRecord?.activeObservations).toBeDefined();
      expect(finalRecord?.activeObservations).toContain('Business Administration');

      // 8. Now ask the question - this is the actual evaluation
      // For evaluation, we need a real model to answer based on observations
      console.log(`\n❓ Asking: "${questionData.question}"`);
      console.log(`   Expected answer: "${questionData.answer}"`);

      // Create agent with real model for evaluation
      const evalAgent = new Agent({
        id: 'eval-agent',
        name: 'Eval Agent',
        instructions: 'You are a helpful assistant. Answer questions based on the conversation history.',
        model: 'google/gemini-2.5-flash',
        inputProcessors: [om],
        outputProcessors: [om],
      });

      const result = await evalAgent.generate(questionData.question, {
        memory: {
          thread: 'evaluation-thread',
          resource: resourceId,
        },
      });

      console.log(`\n💬 Agent response: ${result.text}`);

      // The agent should be able to answer correctly
      const responseContainsAnswer = result.text.toLowerCase().includes(questionData.answer.toLowerCase());
      console.log(`\n${responseContainsAnswer ? '✅ PASS' : '❌ FAIL'}: Response contains "${questionData.answer}"`);

      expect(result.text.toLowerCase()).toContain(questionData.answer.toLowerCase());
    },
    600000,
  ); // 10 minute timeout for processing all 54 sessions

  /**
   * Simpler test: Process only a few sessions including the answer session
   */
  it.skipIf(!hasApiKey)(
    'should preserve key fact when processing answer session with context',
    async () => {
      const storage = createInMemoryStorage();

      const om = new ObservationalMemory({
        storage,
        observer: {
          model: 'google/gemini-2.5-flash',
          observationThreshold: 500, // Low threshold to trigger on each session
        },
        reflector: {
          model: 'google/gemini-2.5-flash',
          reflectionThreshold: 100000, // Won't trigger
        },
        resourceScope: true,
      });

      // Use mock model for main agent during ingestion
      const mockAgentModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Acknowledged.' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Acknowledged.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockAgentModel,
        inputProcessors: [om],
        outputProcessors: [om],
      });

      // Process 5 random sessions before the answer session to build context
      const sessionsToProcess = [0, 10, 20, 30, 40].map(i => ({
        session: questionData.haystack_sessions[i],
        sessionId: questionData.haystack_session_ids[i],
      }));

      // Add the answer session
      const answerSessionIndex = questionData.haystack_session_ids.indexOf(questionData.answer_session_ids[0]);
      sessionsToProcess.push({
        session: questionData.haystack_sessions[answerSessionIndex],
        sessionId: questionData.answer_session_ids[0],
      });

      console.log(`\n📊 Processing ${sessionsToProcess.length} sessions (5 context + 1 answer)...`);

      for (const { session, sessionId } of sessionsToProcess) {
        const messages = session
          .filter(turn => turn.content)
          .map(turn => ({
            role: turn.role as 'user' | 'assistant',
            content: turn.content,
          }));

        if (messages.length > 0) {
          // Process message pairs one at a time
          for (let i = 0; i < messages.length; i += 2) {
            const messagePair = messages.slice(i, Math.min(i + 2, messages.length));
            await agent.generate(messagePair as any, {
              memory: {
                thread: sessionId,
                resource: resourceId,
              },
            });
          }
          console.log(`   Processed ${sessionId}`);
        }
      }

      // Verify observations contain the key fact
      const record = await storage.getObservationalMemory(null, resourceId);
      console.log(`\n📝 Observations: ${record?.observationTokenCount ?? 0} tokens`);

      expect(record?.activeObservations).toContain('Business Administration');

      // Ask the question with real model for evaluation
      const evalAgent = new Agent({
        id: 'eval-agent',
        name: 'Eval Agent',
        instructions: 'You are a helpful assistant. Answer questions based on conversation history.',
        model: 'google/gemini-2.5-flash',
        inputProcessors: [om],
        outputProcessors: [om],
      });

      const result = await evalAgent.generate(questionData.question, {
        memory: {
          thread: 'eval-thread',
          resource: resourceId,
        },
      });

      console.log(`\n❓ "${questionData.question}"`);
      console.log(`💬 "${result.text}"`);

      expect(result.text.toLowerCase()).toContain('business administration');
    },
    180000,
  ); // 3 minute timeout

  /**
   * Test that observations are injected into context correctly
   */
  it.skipIf(!hasApiKey)(
    'should inject observations into context on subsequent calls',
    async () => {
      const storage = createInMemoryStorage();

      // Pre-populate with observations containing the key fact
      const initialRecord = await storage.initializeObservationalMemory({
        threadId: null,
        resourceId,
        scope: 'resource',
        config: {},
      });

      await storage.updateActiveObservations({
        id: initialRecord.id,
        observations: `- 🔴 **User Education:** User graduated with a degree in Business Administration [personal_fact, education]

**Current Task:** Continue helping user.`,
        messageIds: ['pre-existing-msg-1'],
        tokenCount: 100,
      });

      const om = new ObservationalMemory({
        storage,
        observer: {
          model: 'google/gemini-2.5-flash',
          observationThreshold: 100000, // Won't trigger
        },
        reflector: {
          model: 'google/gemini-2.5-flash',
          reflectionThreshold: 100000,
        },
        resourceScope: true,
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions:
          'You are a helpful assistant. Use the observational memory provided to answer questions about the user.',
        model: 'google/gemini-2.5-flash',
        inputProcessors: [om],
        outputProcessors: [om],
      });

      // Ask the question - agent should use injected observations
      const result = await agent.generate('What degree did I graduate with?', {
        memory: {
          thread: 'new-thread',
          resource: resourceId,
        },
      });

      console.log(`\n❓ "What degree did I graduate with?"`);
      console.log(`💬 "${result.text}"`);

      expect(result.text.toLowerCase()).toContain('business administration');
    },
    60000,
  );
});
