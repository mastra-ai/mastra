import type { MastraDBMessage, MastraMessageContentV2, MastraMessagePart } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationTurn } from '../observation-turn/turn';

const threadId = 'om-turn-persistence-thread';
const resourceId = 'om-turn-persistence-resource';
const assistantId = 'stable-assistant-message';

function clonePart(part: MastraMessagePart): MastraMessagePart {
  if (part.type === 'tool-invocation') {
    return {
      ...part,
      toolInvocation: {
        ...part.toolInvocation,
      },
    };
  }

  return { ...part };
}

function cloneMessage(message: MastraDBMessage): MastraDBMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
    content: {
      ...message.content,
      parts: message.content.parts.map(clonePart),
      metadata: message.content.metadata ? { ...message.content.metadata } : undefined,
    },
  };
}

function createRecord(): ObservationalMemoryRecord {
  return {
    id: 'om-record',
    threadId,
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
  } as ObservationalMemoryRecord;
}

function createMockOM() {
  const record = createRecord();
  const persistedMessages = new Map<string, MastraDBMessage>();

  return {
    scope: 'thread' as const,
    reflector: {
      maybeReflect: vi.fn(async () => {}),
    },
    buffering: {
      isAsyncObservationEnabled: vi.fn(() => false),
    },
    observer: {
      lastExchange: undefined,
    },
    getOrCreateRecord: vi.fn(async () => record),
    getStorage: vi.fn(() => ({
      getThreadById: vi.fn(async () => ({ metadata: {} })),
    })),
    getStatus: vi.fn(async () => ({
      pendingTokens: 0,
      threshold: 100_000,
      effectiveObservationTokensThreshold: 100_000,
      shouldObserve: false,
      shouldBuffer: false,
      shouldReflect: false,
      canActivate: false,
      asyncObservationEnabled: false,
      record,
    })),
    getObservationConfig: vi.fn(() => ({
      bufferOnIdle: false,
      bufferActivation: 1,
    })),
    getUnobservedMessages: vi.fn(() => []),
    buildContextSystemMessages: vi.fn(async () => undefined),
    getOtherThreadsContext: vi.fn(async () => undefined),
    activate: vi.fn(async () => ({ activated: false, record })),
    resetBufferingState: vi.fn(async () => {}),
    waitForBuffering: vi.fn(async () => {}),
    observe: vi.fn(async () => ({ observed: false, record })),
    cleanupMessages: vi.fn(async () => {}),
    sealMessagesForBuffering: vi.fn(),
    persistMessages: vi.fn(async (messages: MastraDBMessage[]) => {
      for (const message of messages) {
        persistedMessages.set(message.id, cloneMessage(message));
      }
    }),
    persistedMessages,
  };
}

function createMessageList() {
  return new MessageList({
    threadId,
    resourceId,
    generateMessageId: () => assistantId,
  });
}

function createAssistantMessage(
  parts: MastraMessagePart[],
  createdAt: Date,
  opts?: { sealed?: boolean },
): MastraDBMessage {
  const content: MastraMessageContentV2 = {
    format: 2,
    parts: parts.map(clonePart),
  };

  if (opts?.sealed) {
    content.metadata = { mastra: { sealed: true } };

    const lastPart = content.parts.at(-1) as
      | (MastraMessagePart & { metadata?: { mastra?: { sealedAt?: number } } })
      | undefined;
    if (lastPart) {
      lastPart.metadata = {
        ...(lastPart.metadata ?? {}),
        mastra: {
          ...(lastPart.metadata?.mastra ?? {}),
          sealedAt: createdAt.getTime(),
        },
      };
    }
  }

  return {
    id: assistantId,
    role: 'assistant',
    type: 'text',
    threadId,
    resourceId,
    createdAt,
    content,
  };
}

function toolPart(toolCallId: string): MastraMessagePart {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId,
      toolName: toolCallId,
      state: 'result',
      args: {},
      result: { ok: true },
    },
  };
}

function textPart(text: string): MastraMessagePart {
  return { type: 'text', text };
}

function filePart(providerMetadata: Record<string, unknown>): MastraMessagePart {
  return {
    type: 'file',
    mimeType: 'text/plain',
    data: 'data:text/plain;base64,SGVsbG8=',
    providerMetadata,
  } as MastraMessagePart;
}

async function createStartedTurn(messageList: MessageList, om = createMockOM()) {
  const turn = new ObservationTurn({
    om: om as any,
    threadId,
    resourceId,
    messageList,
  });

  await turn.start();

  return { turn, om };
}

describe('ObservationTurn assistant persistence', () => {
  it('persists accumulated assistant parts across step boundary saves', async () => {
    const messageList = createMessageList();
    const { turn, om } = await createStartedTurn(messageList);

    messageList.add(
      createAssistantMessage([toolPart('weather')], new Date('2026-01-01T00:00:00.000Z'), { sealed: true }),
      'response',
    );
    await turn.step(1).prepare();

    messageList.add(createAssistantMessage([toolPart('forecast')], new Date('2026-01-01T00:00:01.000Z')), 'response');
    await turn.step(2).prepare();

    const persisted = om.persistedMessages.get(assistantId);
    expect(persisted?.content.parts.map(part => part.type)).toEqual(['tool-invocation', 'tool-invocation']);
    expect(
      persisted?.content.parts.map(part =>
        part.type === 'tool-invocation' ? part.toolInvocation.toolCallId : undefined,
      ),
    ).toEqual(['weather', 'forecast']);
  });

  it('flushes one merged assistant message at turn end after sealed step splits', async () => {
    const messageList = createMessageList();
    const { turn, om } = await createStartedTurn(messageList);

    messageList.add(
      createAssistantMessage([toolPart('weather')], new Date('2026-01-01T00:00:00.000Z'), { sealed: true }),
      'response',
    );
    await turn.step(1).prepare();

    messageList.add(createAssistantMessage([toolPart('forecast')], new Date('2026-01-01T00:00:01.000Z')), 'response');
    await turn.step(2).prepare();

    messageList.add(
      createAssistantMessage([textPart('Here is the summary.')], new Date('2026-01-01T00:00:02.000Z')),
      'response',
    );
    await turn.end();

    const persisted = om.persistedMessages.get(assistantId);
    expect(persisted?.content.parts.map(part => part.type)).toEqual(['tool-invocation', 'tool-invocation', 'text']);
    expect(
      persisted?.content.parts.map(part =>
        part.type === 'tool-invocation' ? part.toolInvocation.toolCallId : part.type === 'text' ? part.text : undefined,
      ),
    ).toEqual(['weather', 'forecast', 'Here is the summary.']);
  });

  it('keeps distinct assistant text parts when merging step snapshots', async () => {
    const messageList = createMessageList();
    const { turn, om } = await createStartedTurn(messageList);

    messageList.add(
      createAssistantMessage(
        [textPart('I will check the current weather.'), toolPart('weather')],
        new Date('2026-01-01T00:00:00.000Z'),
        { sealed: true },
      ),
      'response',
    );
    await turn.step(1).prepare();

    messageList.add(
      createAssistantMessage([textPart('Here is the summary.')], new Date('2026-01-01T00:00:01.000Z')),
      'response',
    );
    await turn.end();

    const persisted = om.persistedMessages.get(assistantId);
    expect(
      persisted?.content.parts.map(part =>
        part.type === 'tool-invocation' ? part.toolInvocation.toolCallId : part.type === 'text' ? part.text : undefined,
      ),
    ).toEqual(['I will check the current weather.', 'weather', 'Here is the summary.']);
  });

  it('does not duplicate non-tool parts when metadata keys are ordered differently', async () => {
    const messageList = createMessageList();
    const { turn, om } = await createStartedTurn(messageList);

    messageList.add(
      createAssistantMessage(
        [filePart({ provider: { alpha: 1, beta: 2 } })],
        new Date('2026-01-01T00:00:00.000Z'),
        { sealed: true },
      ),
      'response',
    );
    await turn.step(1).prepare();

    messageList.add(
      createAssistantMessage(
        [filePart({ provider: { beta: 2, alpha: 1 } }), textPart('Here is the summary.')],
        new Date('2026-01-01T00:00:01.000Z'),
      ),
      'response',
    );
    await turn.end();

    const persisted = om.persistedMessages.get(assistantId);
    expect(persisted?.content.parts.map(part => part.type)).toEqual(['file', 'text']);
  });

  it('re-persists tracked memory-source assistant snapshots that gained parts before turn end', async () => {
    const messageList = createMessageList();
    const { turn, om } = await createStartedTurn(messageList);

    messageList.add(createAssistantMessage([toolPart('weather')], new Date('2026-01-01T00:00:00.000Z')), 'response');
    await turn.step(1).prepare();

    messageList.add(
      createAssistantMessage(
        [toolPart('weather'), textPart('Here is the summary.')],
        new Date('2026-01-01T00:00:01.000Z'),
      ),
      'memory',
    );
    await turn.end();

    const persisted = om.persistedMessages.get(assistantId);
    expect(persisted?.content.parts.map(part => part.type)).toEqual(['tool-invocation', 'text']);
    expect(
      persisted?.content.parts.map(part =>
        part.type === 'tool-invocation' ? part.toolInvocation.toolCallId : part.type === 'text' ? part.text : undefined,
      ),
    ).toEqual(['weather', 'Here is the summary.']);
  });
});
