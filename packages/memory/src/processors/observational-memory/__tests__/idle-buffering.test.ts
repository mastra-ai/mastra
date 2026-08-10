/**
 * Idle Buffering Tests
 *
 * Verifies that when the agent goes idle (turn.end()), unobserved messages
 * are buffered in the background when async observation buffering is enabled.
 *
 * Uses spies on ObservationTurn's OM dependency to avoid needing real model
 * instances (the @internal/ai-sdk-v5 mock models require a build step).
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ObservationTurn } from '../observation-turn/turn';

// =============================================================================
// Helpers
// =============================================================================

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  id?: string,
  createdAt?: Date,
): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text: content, createdAt: Date.now() }],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: createdAt ?? new Date(),
  };
}

function createMockRecord(overrides?: Partial<ObservationalMemoryRecord>): ObservationalMemoryRecord {
  return {
    id: 'rec-test',
    threadId: 'idle-buffer-thread',
    activeObservations: null,
    observationTokenCount: 0,
    lastObservedAt: null,
    generationCount: 0,
    bufferedObservationChunks: null,
    isBufferingObservation: false,
    lastBufferedAt: null,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ObservationalMemoryRecord;
}

function createMessages(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(
      `Message ${i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `msg-${i}`,
      new Date(Date.now() - (count - i) * 1000),
    ),
  );
}

/**
 * Create a minimal mock of ObservationalMemory with only the methods
 * that ObservationTurn.end() needs.
 */
function createMockOM(opts: { asyncEnabled: boolean; bufferOnIdle?: boolean; unobservedMessages?: MastraDBMessage[] }) {
  const record = createMockRecord();
  return {
    buffering: {
      isAsyncObservationEnabled: vi.fn(() => opts.asyncEnabled),
    },
    getObservationConfig: vi.fn(() => ({ bufferOnIdle: opts.bufferOnIdle ?? true })),
    getOrCreateRecord: vi.fn(async () => record),
    getUnobservedMessages: vi.fn(() => opts.unobservedMessages ?? []),
    persistMessages: vi.fn(async () => {}),
    buffer: vi.fn(async () => ({ buffered: true, record })),
    scope: 'thread' as const,
    _mockRecord: record,
  };
}

function createMockMessageList(messages: MastraDBMessage[], contextMessageIds: string[] = []) {
  return {
    get: {
      all: { db: () => messages },
      input: { db: () => [] as MastraDBMessage[] },
      response: { db: () => [] as MastraDBMessage[] },
    },
    makeMessageSourceChecker: () => ({ context: new Set(contextMessageIds) }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('turn.end() idle buffering', () => {
  const threadId = 'idle-buffer-thread';
  const resourceId = 'idle-buffer-resource';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger background buffer() when buffering is enabled and unobserved messages exist', async () => {
    const unobservedMessages = createMessages(5);
    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages });
    const mockMessageList = createMockMessageList(unobservedMessages);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    const result = await turn.end();
    expect(result.record).toBeTruthy();

    expect(mockOM.buffer).toHaveBeenCalledTimes(1);
    expect(mockOM.buffer).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId,
        resourceId,
        messages: unobservedMessages,
        record: mockOM._mockRecord,
      }),
    );
  });

  // Regression: https://github.com/mastra-ai/mastra/issues/19730
  // `context`-sourced messages are per-run ephemeral input. They must never reach the
  // buffer/seal/persist pipeline, which would upsert them as durable user messages.
  it('should exclude context-sourced messages from the idle buffer window', async () => {
    const realMessages = createMessages(3);
    const contextMessage = createTestMessage('<client-context>{"page":"/cart"}</client-context>', 'user', 'ctx-1');
    const allMessages = [...realMessages, contextMessage];

    const mockOM = createMockOM({ asyncEnabled: true });
    // Pass through, so the assertion reflects the window the turn actually built.
    mockOM.getUnobservedMessages = vi.fn((messages: MastraDBMessage[]) => messages);
    const mockMessageList = createMockMessageList(allMessages, ['ctx-1']);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.buffer).toHaveBeenCalledTimes(1);
    const bufferedMessages = (mockOM.buffer as any).mock.calls[0][0].messages as MastraDBMessage[];
    expect(bufferedMessages.map(m => m.id)).toEqual(realMessages.map(m => m.id));
    expect(bufferedMessages).not.toContain(contextMessage);
  });

  it('should NOT trigger buffer() when bufferOnIdle is disabled', async () => {
    const messages = createMessages(5);
    const mockOM = createMockOM({ asyncEnabled: true, bufferOnIdle: false, unobservedMessages: messages });
    const mockMessageList = createMockMessageList(messages);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.buffer).not.toHaveBeenCalled();
  });

  it('should NOT trigger buffer() when buffering is disabled', async () => {
    const messages = createMessages(5);
    const mockOM = createMockOM({ asyncEnabled: false, unobservedMessages: messages });
    const mockMessageList = createMockMessageList(messages);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.buffer).not.toHaveBeenCalled();
  });

  it('should NOT trigger buffer() when there are no unobserved messages', async () => {
    const messages = createMessages(5);
    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages: [] });
    const mockMessageList = createMockMessageList(messages);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.buffer).not.toHaveBeenCalled();
  });

  it('should still return the record even if buffer() rejects', async () => {
    const unobservedMessages = createMessages(5);
    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages });
    mockOM.buffer.mockRejectedValue(new Error('buffer failed'));
    const mockMessageList = createMockMessageList(unobservedMessages);

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    const result = await turn.end();

    expect(result.record).toBeTruthy();
    expect(result.record).toBe(mockOM._mockRecord);
    expect(mockOM.buffer).toHaveBeenCalledTimes(1);

    // Give the fire-and-forget .catch() handler time to run
    await new Promise(r => setTimeout(r, 10));
  });

  it('should persist unsaved messages before triggering buffer', async () => {
    const unobservedMessages = createMessages(5);
    const unsavedInput = [createTestMessage('new user msg', 'user', 'unsaved-1')];
    const unsavedOutput = [createTestMessage('new assistant msg', 'assistant', 'unsaved-2')];

    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages });
    const mockMessageList = {
      get: {
        all: { db: () => unobservedMessages },
        input: { db: () => unsavedInput },
        response: { db: () => unsavedOutput },
      },
      makeMessageSourceChecker: () => ({ context: new Set<string>() }),
    };

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: vi.fn(),
      requestContext: { get: vi.fn() } as any,
    });

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.persistMessages).toHaveBeenCalledTimes(1);
    expect(mockOM.persistMessages).toHaveBeenCalledWith([...unsavedInput, ...unsavedOutput], threadId, resourceId);
    expect(mockOM.buffer).toHaveBeenCalledTimes(1);
  });

  it('should pass all context fields to buffer()', async () => {
    const unobservedMessages = createMessages(3);
    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages });
    const mockMessageList = createMockMessageList(unobservedMessages);
    const mockWriter = { custom: vi.fn() };
    const mockSendSignal = vi.fn();
    const mockRequestContext = { get: vi.fn() };
    const mockObservabilityContext = { span: vi.fn() };
    const mockActorModelContext = { provider: 'test-provider', modelId: 'test-model' };

    const turn = new ObservationTurn({
      om: mockOM as any,
      threadId,
      resourceId,
      messageList: mockMessageList as any,
      sendSignal: mockSendSignal,
      requestContext: mockRequestContext as any,
      observabilityContext: mockObservabilityContext as any,
    });
    turn.writer = mockWriter as any;
    turn.actorModelContext = mockActorModelContext;

    (turn as any)._started = true;
    (turn as any)._record = mockOM._mockRecord;

    await turn.end();

    expect(mockOM.buffer).toHaveBeenCalledWith({
      threadId,
      resourceId,
      messages: unobservedMessages,
      record: mockOM._mockRecord,
      writer: mockWriter,
      sendSignal: mockSendSignal,
      requestContext: mockRequestContext,
      currentModel: mockActorModelContext,
      observabilityContext: mockObservabilityContext,
      skipMinimumTokenCheck: true,
    });
  });
});
