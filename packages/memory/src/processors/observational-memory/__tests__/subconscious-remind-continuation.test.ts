import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';

import { RemindContinuationProcessor } from '../subconscious/remind-continuation';
import { REMIND_MESSAGE_METADATA_KEY } from '../subconscious/remind-protocol';

const parentThreadId = 'parent-thread';
const resourceId = 'resource-1';
const reminderThreadId = `subconscious:${parentThreadId}:remind`;

function message(
  id: string,
  metadata:
    | { type: 'question'; replyId: string; askedAt: number }
    | { type: 'continuation'; replyIds: string[]; attempt: number },
): MastraDBMessage {
  return {
    id,
    role: 'user',
    threadId: reminderThreadId,
    resourceId,
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: id }],
      metadata: { [REMIND_MESSAGE_METADATA_KEY]: metadata },
    },
  };
}

function createHarness() {
  const parentAgent = {
    sendSignal: vi.fn((signal: unknown, options: { ifActive: { behavior: string } }) => {
      const action = options.ifActive.behavior === 'persist' ? 'persist' : 'discard';
      return {
        signal,
        accepted: Promise.resolve({ action }),
        persisted: action === 'persist' ? Promise.resolve() : undefined,
      };
    }),
  } as any;
  const consumeStream = vi.fn(async () => undefined);
  const sendMessage = vi.fn(() => ({
    accepted: Promise.resolve({ action: 'wake', runId: 'sidekick-run', output: { consumeStream } }),
  }));
  const reminderAgent = { id: 'reminder-agent', sendMessage } as any;
  const processor = new RemindContinuationProcessor({
    threadId: reminderThreadId,
    resourceId,
    parentThreadId,
    parentAgent,
    maxSteps: 7,
    getReminderAgent: () => reminderAgent,
  });
  return { processor, parentAgent, sendMessage, consumeStream };
}

function resultArgs(messages: MastraDBMessage[], steps: unknown[] = []) {
  return {
    state: {},
    messages,
    messageList: { get: { all: { db: () => messages } }, add: vi.fn() },
    result: { text: '', usage: {}, finishReason: 'stop', steps },
    abort: vi.fn(),
    retryCount: 0,
  } as any;
}

describe('Subconscious reminder continuation', () => {
  it('sends a direct continuation for an unanswered question', async () => {
    const { processor, sendMessage, consumeStream } = createHarness();
    const question = message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() });

    await processor.processOutputResult(resultArgs([question]));

    expect(sendMessage).toHaveBeenCalledWith(
      {
        contents:
          'Continue these unanswered memory questions (attempt 1): reply-1. Reply to each with reply_to_memory_question.',
        metadata: {
          [REMIND_MESSAGE_METADATA_KEY]: { type: 'continuation', replyIds: ['reply-1'], attempt: 1 },
        },
      },
      expect.objectContaining({
        threadId: reminderThreadId,
        resourceId,
        ifActive: { behavior: 'deliver' },
        ifIdle: expect.objectContaining({ behavior: 'wake' }),
      }),
    );
    expect(consumeStream).toHaveBeenCalledOnce();
  });

  it('increments continuation attempts from messages already in the MessageList', async () => {
    const { processor, sendMessage } = createHarness();
    const messages = [
      message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() }),
      message('continuation-1', { type: 'continuation', replyIds: ['reply-1'], attempt: 1 }),
    ];

    await processor.processOutputResult(resultArgs(messages));

    expect(sendMessage.mock.calls[0]![0].metadata[REMIND_MESSAGE_METADATA_KEY]).toEqual({
      type: 'continuation',
      replyIds: ['reply-1'],
      attempt: 2,
    });
  });

  it('reconstructs direct question and continuation text when transport metadata is absent', async () => {
    const { processor, sendMessage } = createHarness();
    const messages: MastraDBMessage[] = [
      {
        id: 'question-1',
        role: 'user',
        threadId: reminderThreadId,
        resourceId,
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'Memory question reply-1\n\nWhat did I decide?' }] },
      },
      {
        id: 'continuation-1',
        role: 'user',
        threadId: reminderThreadId,
        resourceId,
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Continue these unanswered memory questions (attempt 1): reply-1. Reply to each with reply_to_memory_question.',
            },
          ],
        },
      },
    ];

    await processor.processOutputResult(resultArgs(messages));

    expect(sendMessage.mock.calls[0]![0].metadata[REMIND_MESSAGE_METADATA_KEY]).toEqual({
      type: 'continuation',
      replyIds: ['reply-1'],
      attempt: 2,
    });
  });

  it('keeps continuation attempts independent when questions join at different times', async () => {
    const { processor, sendMessage } = createHarness();
    const messages = [
      message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() }),
      message('continuation-1', { type: 'continuation', replyIds: ['reply-1'], attempt: 1 }),
      message('question-2', { type: 'question', replyId: 'reply-2', askedAt: Date.now() }),
    ];

    await processor.processOutputResult(resultArgs(messages));

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.map(call => call[0].metadata[REMIND_MESSAGE_METADATA_KEY])).toEqual(
      expect.arrayContaining([
        { type: 'continuation', replyIds: ['reply-2'], attempt: 1 },
        { type: 'continuation', replyIds: ['reply-1'], attempt: 2 },
      ]),
    );
  });

  it('delivers one deterministic unable-to-answer signal after two continuation attempts', async () => {
    const { processor, parentAgent, sendMessage } = createHarness();
    const messages = [
      message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() }),
      message('continuation-1', { type: 'continuation', replyIds: ['reply-1'], attempt: 1 }),
      message('continuation-2', { type: 'continuation', replyIds: ['reply-1'], attempt: 2 }),
    ];

    const args = resultArgs(messages);
    await processor.processOutputResult(args);
    await processor.processOutputResult(resultArgs(messages));

    const terminalMarker = (args.messageList.add as ReturnType<typeof vi.fn>).mock.calls[0]![0] as MastraDBMessage;
    const reconstructed = createHarness();
    await reconstructed.processor.processOutputResult(resultArgs([...messages, terminalMarker]));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(reconstructed.sendMessage).not.toHaveBeenCalled();
    expect(reconstructed.parentAgent.sendSignal).not.toHaveBeenCalled();
    expect(parentAgent.sendSignal).toHaveBeenCalledTimes(2);
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'reply-1:terminal:signal',
        contents: 'The memory sidekick was unable to answer this memory question after two continuation attempts.',
      }),
      expect.objectContaining({ ifActive: { behavior: 'persist' }, ifIdle: { behavior: 'persist' } }),
    );
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'reply-1:terminal:signal' }),
      expect.objectContaining({ ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'discard' } }),
    );
  });

  it('does not continue a question with a successful terminal tool result', async () => {
    const { processor, parentAgent, sendMessage } = createHarness();
    const question = message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() });
    const steps = [
      {
        toolResults: [
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call-1',
              toolName: 'reply_to_memory_question',
              result: { delivered: true, replyId: 'reply-1', moreComing: false },
            },
          },
        ],
      },
    ];

    await processor.processOutputResult(resultArgs([question], steps));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(parentAgent.sendSignal).not.toHaveBeenCalled();
  });

  it('does not revive a question with a terminal tool result in MessageList history', async () => {
    const { processor, parentAgent, sendMessage } = createHarness();
    const question = message('question-1', { type: 'question', replyId: 'reply-1', askedAt: Date.now() });
    const toolResult = {
      id: 'tool-result-1',
      role: 'tool',
      threadId: reminderThreadId,
      resourceId,
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'reply_to_memory_question',
              args: {},
              result: { delivered: true, replyId: 'reply-1', moreComing: false },
            },
          },
        ],
      },
    } as MastraDBMessage;

    await processor.processOutputResult(resultArgs([question, toolResult]));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(parentAgent.sendSignal).not.toHaveBeenCalled();
  });

  it('uses request-local processor state to nudge a stale unanswered question once before stopping', async () => {
    const { processor } = createHarness();
    const question = message('question-1', {
      type: 'question',
      replyId: 'reply-1',
      askedAt: Date.now() - 20_001,
    });
    const args = {
      ...resultArgs([question]),
      finishReason: 'stop',
      stepNumber: 1,
      toolCalls: [],
      sendSignal: vi.fn(async () => undefined),
    } as any;

    await processor.processOutputStep(args);
    await processor.processOutputStep({ ...args, retryCount: 1 });

    expect(args.sendSignal).toHaveBeenCalledOnce();
    expect(args.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'remind-continuation', attributes: { replyIds: 'reply-1' } }),
    );
    expect(args.state['remind-question-timers'].get('reply-1')).toBe(
      question.content.metadata![REMIND_MESSAGE_METADATA_KEY].askedAt,
    );
    expect(args.abort).toHaveBeenCalledOnce();
    expect(args.abort).toHaveBeenCalledWith(
      'Outstanding memory questions require a reply before this run stops.',
      expect.objectContaining({ retry: true }),
    );
  });
});
