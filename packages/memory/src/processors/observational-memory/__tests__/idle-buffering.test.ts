/**
 * Idle Buffering Tests
 *
 * Verifies that when the agent goes idle (turn.end()), unobserved messages
 * are buffered in the background when async observation buffering is enabled.
 *
 * Uses spies on ObservationTurn's OM dependency to avoid needing real model
 * instances (the @internal/ai-sdk-v5 mock models require a build step).
 */

import { MessageList } from '@mastra/core/agent';
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
    trackBackgroundWork: vi.fn(<T>(work: Promise<T>) => work),
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

  it('should exclude om-continuation from the idle buffer window', async () => {
    const realMessages = createMessages(2);
    const memoryMessage = createTestMessage('Durable memory context', 'user', 'memory-1');
    const continuationMessage = createTestMessage(
      '<system-reminder>Continue naturally</system-reminder>',
      'user',
      'om-continuation',
      new Date(0),
    );
    const allMessages = [...realMessages, memoryMessage, continuationMessage];

    const mockOM = createMockOM({ asyncEnabled: true });
    mockOM.getUnobservedMessages = vi.fn((messages: MastraDBMessage[]) => messages);
    const mockMessageList = createMockMessageList(allMessages);

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

    expect(mockMessageList.get.all.db().map(m => m.id)).toContain('om-continuation');
    expect(mockOM.buffer).toHaveBeenCalledTimes(1);
    const bufferedMessages = (mockOM.buffer as any).mock.calls[0][0].messages as MastraDBMessage[];
    expect(bufferedMessages.map(m => m.id)).toEqual([...realMessages.map(m => m.id), 'memory-1']);
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

describe('22573 idle', () => {
  it.each([
    // Pending call on the newest message: buffer everything before it.
    { times: [100, 200, 300, 400], pendingIndex: 3, expected: 3 },
    { times: [100, 200, 300, 400], pendingIndex: 3, expected: 3, reverse: true },
    // Cursor collision (max(prefix)+1ms >= pending): defer the whole attempt.
    { times: [100, 200, 400, 400], pendingIndex: 3, expected: 0 },
    { times: [100, 200, 399, 400], pendingIndex: 3, expected: 0 },
    { times: [399, 399, 399, 400], pendingIndex: 3, expected: 0 },
    // A toolCallId shared across the cut: defer the whole attempt.
    { times: [100, 200, 300, 400], pendingIndex: 3, expected: 0, splitTool: true },
    // A `call` that is not on the newest message is an orphan — the conversation
    // already continued past it — so it buffers like any other message.
    { times: [100, 200, 300, 400], pendingIndex: 2, expected: 4 },
    { times: [100, 200, 300, 400], pendingIndex: 0, expected: 4 },
  ])(
    'buffers the whole prefix or defers: $times pending=$pendingIndex split=$splitTool reverse=$reverse',
    async ({ times, pendingIndex, expected, splitTool, reverse }) => {
      const messages = times.map((time, index) =>
        createTestMessage(`Message ${index}`, 'assistant', `prefix-${index}`, new Date(time)),
      );
      messages[pendingIndex]!.content.parts.push({
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'pending', toolName: 'pending', args: {} },
      });
      if (splitTool) {
        for (const index of [1, pendingIndex]) {
          messages[index]!.content.parts.push({
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'split', toolName: 'split', args: {}, result: 'done' },
          });
        }
      }
      const list = new MessageList({ threadId: 'idle-buffer-thread' });
      list.add(structuredClone(messages), 'input');
      const mockOM = createMockOM({
        asyncEnabled: true,
        unobservedMessages: reverse ? [...messages].reverse() : messages,
      });
      const turn = new ObservationTurn({ om: mockOM as any, threadId: 'idle-buffer-thread', messageList: list });
      await turn.start();
      await turn.end();
      expect(mockOM.persistMessages).toHaveBeenCalledWith(list.get.all.db(), 'idle-buffer-thread', undefined);
      if (expected) {
        expect(mockOM.buffer).toHaveBeenCalledWith(expect.objectContaining({ messages: messages.slice(0, expected) }));
      } else {
        expect(mockOM.buffer).not.toHaveBeenCalled();
      }
    },
  );
  for (const source of ['input', 'response', 'memory'] as const) {
    for (const providerExecuted of [false, true]) {
      it(`defers pending ${source} calls with providerExecuted=${providerExecuted} and persists raw input/output`, async () => {
        const message = createTestMessage('Mixed text and tools', 'assistant', `pending-${source}`);
        message.content.parts.push(
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'complete', toolName: 'complete', args: {}, result: 'done' },
          },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'pending', toolName: 'pending', args: {}, providerExecuted },
          },
        );
        const list = new MessageList({ threadId: 'idle-buffer-thread', resourceId: 'idle-buffer-resource' });
        list.add(message, source);
        const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages: list.get.all.db() });
        const turn = new ObservationTurn({
          om: mockOM as any,
          threadId: 'idle-buffer-thread',
          resourceId: 'idle-buffer-resource',
          messageList: list,
        });
        await turn.start();
        await turn.end();
        if (source !== 'memory') {
          expect(mockOM.persistMessages).toHaveBeenCalledWith(
            list.get.all.db(),
            'idle-buffer-thread',
            'idle-buffer-resource',
          );
        }
        expect(mockOM.buffer).not.toHaveBeenCalled();
      });
    }
  }
});

describe('22573 control', () => {
  it('preserves candidate order when no tools are pending', async () => {
    const messages = [300, 100, 200].map((time, index) =>
      createTestMessage(`Completed ${index}`, 'user', `completed-${index}`, new Date(time)),
    );
    const list = new MessageList({ threadId: 'idle-buffer-thread' });
    list.add(structuredClone(messages), 'input');
    const mockOM = createMockOM({ asyncEnabled: true, unobservedMessages: messages });
    const turn = new ObservationTurn({ om: mockOM as any, threadId: 'idle-buffer-thread', messageList: list });
    await turn.start();
    await turn.end();
    expect(mockOM.buffer).toHaveBeenCalledWith(expect.objectContaining({ messages }));
  });

  it.each([
    { state: 'result', asyncEnabled: true, bufferOnIdle: true, expected: 1 },
    { state: 'text', asyncEnabled: true, bufferOnIdle: true, expected: 1 },
    { state: 'empty', asyncEnabled: true, bufferOnIdle: true, expected: 0 },
    { state: 'result', asyncEnabled: false, bufferOnIdle: true, expected: 0 },
    { state: 'result', asyncEnabled: true, bufferOnIdle: false, expected: 0 },
  ])(
    'retains idle behavior for $state async=$asyncEnabled idle=$bufferOnIdle',
    async ({ state, asyncEnabled, bufferOnIdle, expected }) => {
      const list = new MessageList({ threadId: 'idle-buffer-thread' });
      const message = createTestMessage('Completed turn', 'assistant');
      if (state === 'result') {
        message.content.parts.push({
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'complete', toolName: 'complete', args: {}, result: 'done' },
        });
      }
      if (state !== 'empty') list.add(message, 'input');
      const mockOM = createMockOM({ asyncEnabled, bufferOnIdle, unobservedMessages: list.get.all.db() });
      const turn = new ObservationTurn({ om: mockOM as any, threadId: 'idle-buffer-thread', messageList: list });
      await turn.start();
      await turn.end();
      expect(mockOM.buffer).toHaveBeenCalledTimes(expected);
    },
  );
});
