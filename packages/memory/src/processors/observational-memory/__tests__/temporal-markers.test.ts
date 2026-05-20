import { readFileSync } from 'node:fs';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { formatTemporalGap, formatTemporalTimestamp } from '../date-utils';
import { ObservationalMemory } from '../observational-memory';
import type { MemoryContextProvider } from '../processor';
import { ObservationalMemoryProcessor } from '../processor';

function createMessage(params: {
  id: string;
  text: string;
  role?: 'user' | 'assistant';
  timestamp: string | number;
  partTimestamps?: number[];
  threadId: string;
  resourceId: string;
}): MastraDBMessage {
  const createdAt = new Date(params.timestamp);
  const partTimestamps = params.partTimestamps ?? [createdAt.getTime()];
  const content: MastraMessageContentV2 = {
    format: 2,
    parts: partTimestamps.map(createdAt => ({ type: 'text' as const, text: params.text, createdAt })),
  };

  return {
    id: params.id,
    role: params.role ?? 'user',
    content,
    type: 'text',
    createdAt,
    threadId: params.threadId,
    resourceId: params.resourceId,
  };
}

type FixtureRow = {
  id: string;
  role: 'user' | 'assistant';
  createdAt: string;
  content: string;
  resourceId: string;
  thread_id?: string;
};

function loadTemporalGapDbFixture(): FixtureRow[] {
  return JSON.parse(
    readFileSync(new URL('./fixtures/temporal-gap-db-fixture.json', import.meta.url), 'utf8'),
  ) as FixtureRow[];
}

function parseRowContent(row: FixtureRow): MastraMessageContentV2 {
  return JSON.parse(row.content) as MastraMessageContentV2;
}

function getTopLevelGapMs(previousRow: FixtureRow, nextRow: FixtureRow) {
  return new Date(nextRow.createdAt).getTime() - new Date(previousRow.createdAt).getTime();
}

function getPartGapMs(previousRow: FixtureRow, nextRow: FixtureRow) {
  const previousContent = parseRowContent(previousRow);
  const nextContent = parseRowContent(nextRow);
  const previousPartTimestamps = previousContent.parts
    .map(part => ('createdAt' in part ? part.createdAt : undefined))
    .filter((timestamp): timestamp is number => typeof timestamp === 'number');
  const nextPartTimestamps = nextContent.parts
    .map(part => ('createdAt' in part ? part.createdAt : undefined))
    .filter((timestamp): timestamp is number => typeof timestamp === 'number');

  return nextPartTimestamps[0]! - previousPartTimestamps[previousPartTimestamps.length - 1]!;
}

function createMemoryProvider(messages: MastraDBMessage[]): MemoryContextProvider {
  return {
    getContext: async () => ({
      systemMessage: undefined,
      messages,
      hasObservations: false,
      omRecord: null,
      continuationMessage: undefined,
      otherThreadsContext: undefined,
    }),
    persistMessages: async () => {},
  };
}

describe('ObservationalMemoryProcessor temporal markers', () => {
  it('formats temporal gaps using two-unit durations', () => {
    expect(formatTemporalGap(10 * 60 * 1000 - 1)).toBeNull();

    const cases = [
      { diffMs: 10 * 60 * 1000, expected: '10 minutes later' },
      { diffMs: 15 * 60 * 1000, expected: '15 minutes later' },
      { diffMs: 30 * 60 * 1000, expected: '30 minutes later' },
      { diffMs: 45 * 60 * 1000, expected: '45 minutes later' },
      { diffMs: 60 * 60 * 1000, expected: '1 hour later' },
      { diffMs: 60 * 60 * 1000 + 26 * 60 * 1000, expected: '1 hour 26 minutes later' },
      { diffMs: 6 * 60 * 60 * 1000 + 44 * 60 * 1000, expected: '6 hours 44 minutes later' },
      { diffMs: 24 * 60 * 60 * 1000, expected: '1 day later' },
      { diffMs: 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000, expected: '1 day 13 hours later' },
      { diffMs: 7 * 24 * 60 * 60 * 1000, expected: '1 week later' },
      { diffMs: 7 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000, expected: '1 week 3 days later' },
      { diffMs: 30 * 24 * 60 * 60 * 1000, expected: '1 month later' },
      { diffMs: 30 * 24 * 60 * 60 * 1000 + 14 * 24 * 60 * 60 * 1000, expected: '1 month 2 weeks later' },
      { diffMs: 365 * 24 * 60 * 60 * 1000, expected: '1 year later' },
      { diffMs: 365 * 24 * 60 * 60 * 1000 + 60 * 24 * 60 * 60 * 1000, expected: '1 year 2 months later' },
    ];

    for (const { diffMs, expected } of cases) {
      expect(formatTemporalGap(diffMs)).toBe(expected);
    }
  });

  it('labels the reported db fixture gap honestly', () => {
    const rows = loadTemporalGapDbFixture();
    const newerMessage = rows[0]!;
    const markerRow = rows[1]!;
    const previousVisibleMessage = rows[2]!;
    const markerContent = parseRowContent(markerRow);
    const { gapMs } = markerContent.metadata as { gapMs: number };

    expect(markerRow.id.startsWith('__temporal_gap_')).toBe(true);
    expect(markerContent.metadata).toMatchObject({
      reminderType: 'temporal-gap',
      gapText: '11 hours 13 minutes later',
      gapMs: 40433500,
      timestampMs: 1745333315959,
      precedesMessageId: newerMessage.id,
      systemReminder: {
        type: 'temporal-gap',
        gapText: '11 hours 13 minutes later',
        gapMs: 40433500,
        timestampMs: 1745333315959,
        precedesMessageId: newerMessage.id,
      },
    });
    expect(getTopLevelGapMs(previousVisibleMessage, newerMessage)).toBe(39911979);
    expect(getPartGapMs(previousVisibleMessage, newerMessage)).toBe(39884770);
    expect(gapMs).toBeGreaterThan(getTopLevelGapMs(previousVisibleMessage, newerMessage));
    expect(gapMs).toBeGreaterThan(getPartGapMs(previousVisibleMessage, newerMessage));
    expect(formatTemporalGap(gapMs)).toBe('11 hours 13 minutes later');
  });

  it('inserts temporal gap markers after history loads on step 0', async () => {
    const threadId = 'temporal-markers-thread';
    const resourceId = 'temporal-markers-resource';
    const history = [
      createMessage({
        id: 'history-1',
        text: 'First history message',
        role: 'user',
        timestamp: '2025-01-01T08:00:00.000Z',
        threadId,
        resourceId,
      }),
      createMessage({
        id: 'history-2',
        text: 'Second history message',
        role: 'assistant',
        timestamp: '2025-01-01T08:20:00.000Z',
        threadId,
        resourceId,
      }),
    ];

    const inputMessage = createMessage({
      id: 'input-1',
      text: 'Current user message',
      role: 'user',
      timestamp: '2025-01-01T08:50:00.000Z',
      threadId,
      resourceId,
    });

    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Temporal markers',
        createdAt: new Date('2025-01-01T08:00:00.000Z'),
        updatedAt: new Date('2025-01-01T08:00:00.000Z'),
        metadata: {},
      },
    });

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'ok' }],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      model: model as any,
      observation: { messageTokens: 500_000 },
      reflection: { observationTokens: 500_000 },
    });

    const processor = new ObservationalMemoryProcessor(om, createMemoryProvider(history), {
      temporalMarkers: true,
    });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(inputMessage, 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const capturedParts: any[] = [];
    const writer = {
      custom: async (part: any) => {
        capturedParts.push(part);
      },
    };

    await processor.processInputStep({
      messageList,
      messages: [inputMessage],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      writer: writer as any,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    const allMessages = messageList.get.all.db();
    const markers = allMessages.filter(message => message.id.startsWith('__temporal_gap_'));
    const check = messageList.makeMessageSourceChecker();

    expect(markers).toHaveLength(1);
    expect(markers.map(marker => check.getSource(marker))).toEqual(['input']);
    expect(allMessages.map(message => message.id)).toEqual(['history-1', 'history-2', markers[0]!.id, 'input-1']);
    expect(markers[0]!.content.parts[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining(
        '<system-reminder type="temporal-gap" precedesMessageId="input-1">30 minutes later —',
      ),
    });
    expect(markers[0]!.content.metadata).toEqual({
      reminderType: 'temporal-gap',
      gapText: '30 minutes later',
      gapMs: 30 * 60 * 1000,
      timestamp: formatTemporalTimestamp(new Date('2025-01-01T08:50:00Z')),
      timestampMs: new Date('2025-01-01T08:50:00Z').getTime(),
      precedesMessageId: 'input-1',
      systemReminder: {
        type: 'temporal-gap',
        message: `30 minutes later — ${formatTemporalTimestamp(new Date('2025-01-01T08:50:00Z'))}`,
        gapText: '30 minutes later',
        gapMs: 30 * 60 * 1000,
        timestamp: formatTemporalTimestamp(new Date('2025-01-01T08:50:00Z')),
        timestampMs: new Date('2025-01-01T08:50:00Z').getTime(),
        precedesMessageId: 'input-1',
      },
    });
    expect(capturedParts.filter(part => part.type === 'data-system-reminder')).toEqual([
      expect.objectContaining({
        type: 'data-system-reminder',
        transient: true,
        data: expect.objectContaining({
          reminderType: 'temporal-gap',
          gapText: '30 minutes later',
          precedesMessageId: 'input-1',
          gapMs: 30 * 60 * 1000,
          timestamp: formatTemporalTimestamp(new Date('2025-01-01T08:50:00Z')),
          timestampMs: new Date('2025-01-01T08:50:00Z').getTime(),
        }),
      }),
    ]);
  });

  it('does not insert duplicate markers when step 0 is rerun for the same input', async () => {
    const threadId = 'temporal-markers-rerun-thread';
    const resourceId = 'temporal-markers-rerun-resource';
    const history = [
      createMessage({
        id: 'history-1',
        text: 'First history message',
        role: 'assistant',
        timestamp: '2025-01-01T08:00:00.000Z',
        threadId,
        resourceId,
      }),
    ];
    const inputMessage = createMessage({
      id: 'input-1',
      text: 'Current user message',
      role: 'user',
      timestamp: '2025-01-01T08:30:00.000Z',
      threadId,
      resourceId,
    });

    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Temporal markers rerun',
        createdAt: new Date('2025-01-01T08:00:00.000Z'),
        updatedAt: new Date('2025-01-01T08:00:00.000Z'),
        metadata: {},
      },
    });

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'ok' }],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      model: model as any,
      observation: { messageTokens: 500_000 },
      reflection: { observationTokens: 500_000 },
    });

    const processor = new ObservationalMemoryProcessor(om, createMemoryProvider(history), {
      temporalMarkers: true,
    });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(inputMessage, 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const capturedParts: any[] = [];
    const writer = {
      custom: async (part: any) => {
        capturedParts.push(part);
      },
    };

    const args = {
      messageList,
      messages: [inputMessage],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      writer: writer as any,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    };

    await processor.processInputStep(args);
    await processor.processInputStep(args);

    expect(messageList.get.all.db().filter(message => message.id.startsWith('__temporal_gap_'))).toHaveLength(1);
    expect(capturedParts.filter(part => part.type === 'data-system-reminder')).toHaveLength(1);
  });

  it('does not reinsert temporal markers on later steps', async () => {
    const threadId = 'temporal-markers-step-thread';
    const resourceId = 'temporal-markers-step-resource';
    const history = [
      createMessage({
        id: 'history-1',
        text: 'First history message',
        role: 'user',
        timestamp: '2025-01-01T08:00:00.000Z',
        threadId,
        resourceId,
      }),
    ];
    const inputMessage = createMessage({
      id: 'input-1',
      text: 'Current user message',
      role: 'user',
      timestamp: '2025-01-01T08:20:00.000Z',
      threadId,
      resourceId,
    });

    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Temporal markers later step',
        createdAt: new Date('2025-01-01T08:00:00.000Z'),
        updatedAt: new Date('2025-01-01T08:00:00.000Z'),
        metadata: {},
      },
    });

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'ok' }],
        warnings: [],
      }),
    });

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      model: model as any,
      observation: { messageTokens: 500_000 },
      reflection: { observationTokens: 500_000 },
    });

    const processor = new ObservationalMemoryProcessor(om, createMemoryProvider(history), {
      temporalMarkers: true,
    });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(inputMessage, 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const sharedState: Record<string, unknown> = {};
    const capturedParts: any[] = [];
    const writer = {
      custom: async (part: any) => {
        capturedParts.push(part);
      },
    };

    const abort = (() => {
      throw new Error('aborted');
    }) as any;

    await processor.processInputStep({
      messageList,
      messages: [inputMessage],
      requestContext,
      stepNumber: 0,
      state: sharedState,
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      writer: writer as any,
      abort,
    });

    const markerCountAfterStep0 = messageList.get.all
      .db()
      .filter(message => message.id.startsWith('__temporal_gap_')).length;
    const reminderCountAfterStep0 = capturedParts.filter(part => part.type === 'data-system-reminder').length;

    messageList.add(
      createMessage({
        id: 'tool-1',
        text: 'Tool result',
        role: 'assistant',
        timestamp: '2025-01-01T08:21:00.000Z',
        threadId,
        resourceId,
      }),
      'response',
    );

    await processor.processInputStep({
      messageList,
      messages: messageList.get.all.db(),
      requestContext,
      stepNumber: 1,
      state: sharedState,
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      writer: writer as any,
      abort,
    });

    expect(messageList.get.all.db().filter(message => message.id.startsWith('__temporal_gap_'))).toHaveLength(
      markerCountAfterStep0,
    );
    expect(capturedParts.filter(part => part.type === 'data-system-reminder')).toHaveLength(reminderCountAfterStep0);
  });
});
