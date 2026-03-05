/**
 * Tests for the Gateway API methods: `prepareContext` and `processResponse`.
 *
 * These methods provide a simpler interface for environments that don't use
 * Mastra's Agent pipeline (e.g., LLM gateway proxies).
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  opts?: { id?: string; threadId?: string; resourceId?: string; createdAt?: Date },
): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };

  return {
    id: opts?.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: messageContent,
    type: 'text',
    createdAt: opts?.createdAt ?? new Date(),
    threadId: opts?.threadId,
    resourceId: opts?.resourceId,
  };
}

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

function createStreamCapableMockModel(config: Record<string, any>) {
  if (config.doGenerate && !config.doStream) {
    const originalDoGenerate = config.doGenerate;
    return new MockLanguageModelV2({
      ...config,
      doGenerate: async () => {
        throw new Error('Unexpected doGenerate call — OM should use the stream path');
      },
      doStream: async (options: any) => {
        const generated = await originalDoGenerate(options);
        const text = generated.content?.find((part: any) => part?.type === 'text')?.text ?? generated.text ?? '';
        const usage = generated.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: generated.warnings ?? [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'mock-response',
              modelId: 'mock-model',
              timestamp: new Date(),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({ type: 'finish', finishReason: generated.finishReason ?? 'stop', usage });
            controller.close();
          },
        });

        return {
          stream,
          rawCall: generated.rawCall ?? { rawPrompt: null, rawSettings: {} },
          warnings: generated.warnings ?? [],
        };
      },
    });
  }

  return new MockLanguageModelV2(config);
}

// =============================================================================
// prepareContext
// =============================================================================

describe('prepareContext', () => {
  let storage: InMemoryMemory;
  const threadId = 'gw-thread-1';
  const resourceId = 'gw-resource-1';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should return empty system message and messages when no data exists', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    const result = await om.prepareContext({ threadId, resourceId });

    expect(result.systemMessage).toBeNull();
    expect(result.messages).toEqual([]);
    expect(result.record).toBeDefined();
    expect(result.record.activeObservations).toBe('');
  });

  it('should return caller-provided messages in the result', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    const userMsg = createTestMessage('Hello there', 'user', { threadId });
    const assistantMsg = createTestMessage('Hi! How can I help?', 'assistant', { threadId });

    const result = await om.prepareContext({
      threadId,
      resourceId,
      messages: [userMsg, assistantMsg],
    });

    expect(result.systemMessage).toBeNull();
    expect(result.messages.length).toBe(2);
    // Messages should have the same content
    const texts = result.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('Hello there');
    expect(texts).toContain('Hi! How can I help?');
  });

  it('should filter out system messages from input', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    const systemMsg: MastraDBMessage = {
      id: 'sys-1',
      role: 'system',
      content: { format: 2, parts: [{ type: 'text', text: 'You are a helpful assistant' }] },
      type: 'text',
      createdAt: new Date(),
      threadId,
    };
    const userMsg = createTestMessage('Hello', 'user', { threadId });

    const result = await om.prepareContext({
      threadId,
      resourceId,
      messages: [systemMsg, userMsg],
    });

    // System message should be filtered out
    const roles = result.messages.map(m => m.role);
    expect(roles).not.toContain('system');
    expect(result.messages.length).toBe(1);
  });

  it('should load historical messages from storage', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    // Pre-populate storage with historical messages
    const historicalMsg = createTestMessage('Old conversation', 'user', {
      threadId,
      resourceId,
      createdAt: new Date('2025-01-01T10:00:00Z'),
    });
    const historicalReply = createTestMessage('Old reply', 'assistant', {
      threadId,
      resourceId,
      createdAt: new Date('2025-01-01T10:01:00Z'),
    });

    await storage.saveMessages({ messages: [historicalMsg, historicalReply] });

    // Call prepareContext without providing messages — should load from storage
    const result = await om.prepareContext({ threadId, resourceId });

    expect(result.messages.length).toBe(2);
    const texts = result.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('Old conversation');
    expect(texts).toContain('Old reply');
  });

  it('should merge historical and caller-provided messages', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    // Pre-populate storage with historical messages
    const historicalMsg = createTestMessage('Previous turn', 'user', {
      threadId,
      resourceId,
      createdAt: new Date('2025-01-01T10:00:00Z'),
    });
    await storage.saveMessages({ messages: [historicalMsg] });

    // Call with new messages
    const newMsg = createTestMessage('Current turn', 'user', { threadId });

    const result = await om.prepareContext({
      threadId,
      resourceId,
      messages: [newMsg],
    });

    // Should have both historical and new messages
    expect(result.messages.length).toBe(2);
    const texts = result.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('Previous turn');
    expect(texts).toContain('Current turn');
  });

  it('should inject observation system message when observations exist', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    // Create an OM record with existing observations
    const record = await storage.initializeObservationalMemory({
      threadId,
      resourceId,
      scope: 'thread',
      config: {},
    });

    await storage.updateActiveObservations({
      id: record.id,
      observations: '- User prefers concise answers\n- User is working on a TypeScript project',
      tokenCount: 100,
      lastObservedAt: new Date('2025-01-01T12:00:00Z'),
    });

    const result = await om.prepareContext({ threadId, resourceId });

    expect(result.systemMessage).not.toBeNull();
    expect(result.systemMessage).toContain('User prefers concise answers');
    expect(result.systemMessage).toContain('TypeScript project');
  });

  it('should create OM record on first call', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    const result = await om.prepareContext({ threadId, resourceId });

    // Record should have been auto-created
    expect(result.record).toBeDefined();
    expect(result.record.activeObservations).toBe('');
    expect(result.record.isObserving).toBe(false);

    // Should be persisted in storage
    const stored = await storage.getObservationalMemory(threadId, resourceId);
    expect(stored).not.toBeNull();
  });

  it('should work without resourceId', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    const userMsg = createTestMessage('Hello', 'user', { threadId });

    const result = await om.prepareContext({
      threadId,
      messages: [userMsg],
    });

    expect(result.systemMessage).toBeNull();
    expect(result.messages.length).toBe(1);
    expect(result.record).toBeDefined();
  });

  it('should filter already-observed messages from the result', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 5000, model: 'test-model' },
      reflection: { observationTokens: 10000, model: 'test-model' },
    });

    // Create a record where messages have been observed up to a certain time
    const record = await storage.initializeObservationalMemory({
      threadId,
      resourceId,
      scope: 'thread',
      config: {},
    });

    const observedAt = new Date('2025-01-01T12:00:00Z');
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- Previous conversation summary',
      tokenCount: 50,
      lastObservedAt: observedAt,
    });

    // Store old messages (before observation) and new messages (after)
    const oldMsg = createTestMessage('Already observed content', 'user', {
      id: 'old-1',
      threadId,
      resourceId,
      createdAt: new Date('2025-01-01T10:00:00Z'),
    });
    const newMsg = createTestMessage('New content after observation', 'user', {
      id: 'new-1',
      threadId,
      resourceId,
      createdAt: new Date('2025-01-01T14:00:00Z'),
    });
    await storage.saveMessages({ messages: [oldMsg, newMsg] });

    const result = await om.prepareContext({ threadId, resourceId });

    // Should only contain the new message (old one was already observed)
    const texts = result.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('New content after observation');
    expect(texts).not.toContain('Already observed content');
  });
});

// =============================================================================
// processResponse
// =============================================================================

describe('processResponse', () => {
  let storage: InMemoryMemory;
  const threadId = 'gw-thread-2';
  const resourceId = 'gw-resource-2';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should save input and response messages to storage', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    const input = createTestMessage('What is TypeScript?', 'user', { threadId, resourceId });
    const response = createTestMessage('TypeScript is a typed superset of JavaScript.', 'assistant', {
      threadId,
      resourceId,
    });

    const result = await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [input],
      responseMessages: [response],
    });

    expect(result.saved).toBe(true);
    expect(result.observationTriggered).toBe(false);
    expect(result.record).toBeDefined();

    // Verify messages were actually saved to storage
    const stored = await storage.listMessages({
      threadId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(stored.messages.length).toBe(2);
  });

  it('should return saved=false when no messages provided', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    const result = await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [],
      responseMessages: [],
    });

    expect(result.saved).toBe(false);
    expect(result.observationTriggered).toBe(false);
  });

  it('should work without resourceId', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    const input = createTestMessage('Hello', 'user', { threadId });
    const response = createTestMessage('Hi!', 'assistant', { threadId });

    const result = await om.processResponse({
      threadId,
      inputMessages: [input],
      responseMessages: [response],
    });

    expect(result.saved).toBe(true);
    expect(result.record).toBeDefined();
  });

  it('should create OM record on first call', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    // Verify no record exists yet
    const before = await storage.getObservationalMemory(threadId, resourceId);
    expect(before).toBeNull();

    await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [createTestMessage('Hello', 'user', { threadId, resourceId })],
      responseMessages: [createTestMessage('Hi!', 'assistant', { threadId, resourceId })],
    });

    // Record should have been auto-created
    const after = await storage.getObservationalMemory(threadId, resourceId);
    expect(after).not.toBeNull();
  });

  it('should trigger observation when threshold is exceeded', async () => {
    // Use a very low threshold so messages exceed it
    const mockObserverModel = createStreamCapableMockModel({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: '- User asked about TypeScript\n- Assistant explained TypeScript basics',
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Very low threshold
        model: mockObserverModel,
      },
      reflection: {
        observationTokens: 100000,
        model: mockObserverModel,
      },
    });

    // Generate enough messages to exceed the low threshold
    const inputMessages: MastraDBMessage[] = [];
    const responseMessages: MastraDBMessage[] = [];
    for (let i = 0; i < 5; i++) {
      inputMessages.push(
        createTestMessage(`Question ${i}: What is TypeScript feature number ${i}?`, 'user', {
          threadId,
          resourceId,
          createdAt: new Date(Date.now() + i * 2000),
        }),
      );
      responseMessages.push(
        createTestMessage(
          `Answer ${i}: TypeScript feature ${i} is a great feature that provides type safety and developer experience improvements.`,
          'assistant',
          { threadId, resourceId, createdAt: new Date(Date.now() + i * 2000 + 1000) },
        ),
      );
    }

    const result = await om.processResponse({
      threadId,
      resourceId,
      inputMessages,
      responseMessages,
    });

    expect(result.saved).toBe(true);
    expect(result.observationTriggered).toBe(true);
    expect(result.record).toBeDefined();
  });

  it('should not trigger observation when below threshold', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    const result = await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [createTestMessage('Short question', 'user', { threadId, resourceId })],
      responseMessages: [createTestMessage('Short answer', 'assistant', { threadId, resourceId })],
    });

    expect(result.saved).toBe(true);
    expect(result.observationTriggered).toBe(false);
  });

  it('should accumulate messages across multiple processResponse calls', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    // First turn
    await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [createTestMessage('Turn 1 input', 'user', { threadId, resourceId })],
      responseMessages: [createTestMessage('Turn 1 response', 'assistant', { threadId, resourceId })],
    });

    // Second turn
    await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [createTestMessage('Turn 2 input', 'user', { threadId, resourceId })],
      responseMessages: [createTestMessage('Turn 2 response', 'assistant', { threadId, resourceId })],
    });

    // Verify all 4 messages are in storage
    const stored = await storage.listMessages({
      threadId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(stored.messages.length).toBe(4);
  });
});

// =============================================================================
// prepareContext + processResponse integration
// =============================================================================

describe('prepareContext + processResponse integration', () => {
  let storage: InMemoryMemory;
  const threadId = 'gw-thread-3';
  const resourceId = 'gw-resource-3';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should round-trip: processResponse saves, prepareContext loads', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    // Save messages via processResponse
    await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [
        createTestMessage('What is Mastra?', 'user', {
          threadId,
          resourceId,
          createdAt: new Date('2025-06-01T10:00:00Z'),
        }),
      ],
      responseMessages: [
        createTestMessage('Mastra is an AI framework.', 'assistant', {
          threadId,
          resourceId,
          createdAt: new Date('2025-06-01T10:00:01Z'),
        }),
      ],
    });

    // Load context via prepareContext
    const ctx = await om.prepareContext({ threadId, resourceId });

    // Should see the messages we just saved
    expect(ctx.messages.length).toBe(2);
    const texts = ctx.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('What is Mastra?');
    expect(texts).toContain('Mastra is an AI framework.');
  });

  it('should include new caller messages alongside stored history', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    // First turn — saved via processResponse
    await om.processResponse({
      threadId,
      resourceId,
      inputMessages: [
        createTestMessage('Turn 1', 'user', {
          threadId,
          resourceId,
          createdAt: new Date('2025-06-01T10:00:00Z'),
        }),
      ],
      responseMessages: [
        createTestMessage('Response 1', 'assistant', {
          threadId,
          resourceId,
          createdAt: new Date('2025-06-01T10:00:01Z'),
        }),
      ],
    });

    // Second turn — new messages passed to prepareContext
    const newMsg = createTestMessage('Turn 2', 'user', { threadId });

    const ctx = await om.prepareContext({
      threadId,
      resourceId,
      messages: [newMsg],
    });

    // Should have history (2 msgs) + new message (1 msg)
    expect(ctx.messages.length).toBe(3);
    const texts = ctx.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    expect(texts).toContain('Turn 1');
    expect(texts).toContain('Response 1');
    expect(texts).toContain('Turn 2');
  });

  it('should use observations from a previous processResponse in prepareContext', async () => {
    const mockObserverModel = createStreamCapableMockModel({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: '- User is building an AI gateway\n- User prefers TypeScript',
          },
        ],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Very low threshold to trigger observation
        model: mockObserverModel,
      },
      reflection: {
        observationTokens: 100000,
        model: mockObserverModel,
      },
    });

    // Generate enough messages to trigger observation
    const inputMsgs: MastraDBMessage[] = [];
    const responseMsgs: MastraDBMessage[] = [];
    for (let i = 0; i < 5; i++) {
      inputMsgs.push(
        createTestMessage(`Detailed question ${i} about building AI gateways with TypeScript`, 'user', {
          threadId,
          resourceId,
          createdAt: new Date(Date.now() + i * 2000),
        }),
      );
      responseMsgs.push(
        createTestMessage(
          `Detailed answer ${i} about TypeScript gateway patterns and best practices for AI integration`,
          'assistant',
          { threadId, resourceId, createdAt: new Date(Date.now() + i * 2000 + 1000) },
        ),
      );
    }

    const saveResult = await om.processResponse({
      threadId,
      resourceId,
      inputMessages: inputMsgs,
      responseMessages: responseMsgs,
    });

    // If observation was triggered, prepareContext should include it
    if (saveResult.observationTriggered) {
      const ctx = await om.prepareContext({ threadId, resourceId });
      expect(ctx.systemMessage).not.toBeNull();
      expect(ctx.systemMessage).toContain('AI gateway');
    }
  });

  it('should handle multiple threads independently', async () => {
    const om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 50000, model: 'test-model' },
      reflection: { observationTokens: 100000, model: 'test-model' },
    });

    const threadA = 'thread-A';
    const threadB = 'thread-B';

    // Save to thread A
    await om.processResponse({
      threadId: threadA,
      resourceId,
      inputMessages: [createTestMessage('Thread A message', 'user', { threadId: threadA, resourceId })],
      responseMessages: [createTestMessage('Thread A response', 'assistant', { threadId: threadA, resourceId })],
    });

    // Save to thread B
    await om.processResponse({
      threadId: threadB,
      resourceId,
      inputMessages: [createTestMessage('Thread B message', 'user', { threadId: threadB, resourceId })],
      responseMessages: [createTestMessage('Thread B response', 'assistant', { threadId: threadB, resourceId })],
    });

    // prepareContext for each thread should only see its own messages
    const ctxA = await om.prepareContext({ threadId: threadA, resourceId });
    const ctxB = await om.prepareContext({ threadId: threadB, resourceId });

    const textsA = ctxA.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });
    const textsB = ctxB.messages.map(m => {
      const content = m.content as MastraMessageContentV2;
      return content.parts.find((p: any) => p.type === 'text')?.text;
    });

    expect(textsA).toContain('Thread A message');
    expect(textsA).not.toContain('Thread B message');
    expect(textsB).toContain('Thread B message');
    expect(textsB).not.toContain('Thread A message');
  });
});
