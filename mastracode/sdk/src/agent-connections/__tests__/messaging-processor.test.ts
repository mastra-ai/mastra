import { describe, expect, it, vi } from 'vitest';

import {
  CrossAgentMessagingExpectedReplyProcessor,
  createExpectedReplyReminderSignal,
  findUnansweredExpectedReplies,
} from '../messaging-processor.js';

function notificationMessage(options: { returnPeerId: string; expectsReply?: boolean; summary?: string }) {
  return {
    id: `signal-${options.returnPeerId}`,
    role: 'signal',
    createdAt: new Date(),
    type: 'notification',
    content: {
      format: 2,
      parts: [{ type: 'text', text: options.summary ?? 'Please reply' }],
      metadata: {
        signal: {
          type: 'notification',
          tagName: 'notification',
          attributes: {
            expectsReply: options.expectsReply ?? true,
            returnPeerId: options.returnPeerId,
          },
          metadata: {
            notification: { source: 'agent-connection', kind: 'peer-signal' },
            crossAgentMessaging: {
              expectsReply: options.expectsReply ?? true,
              returnPeerId: options.returnPeerId,
            },
          },
        },
      },
    },
  } as any;
}

function outboundSignalMessage(targetId: string, isError = false) {
  return {
    id: `assistant-${targetId}`,
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolName: 'agent_signal_send',
            state: 'result',
            rawInput: { targetId, summary: 'Reply', expectsReply: false },
            result: { isError, target: { id: targetId } },
          },
        },
      ],
    },
  } as any;
}

function messageList(messages: any[]) {
  return { get: { all: { db: () => messages } } };
}

describe('CrossAgentMessagingExpectedReplyProcessor', () => {
  it('finds unanswered expected-reply notifications', () => {
    const unanswered = findUnansweredExpectedReplies([notificationMessage({ returnPeerId: 'code-agent:r:t' })]);

    expect(unanswered).toEqual([{ peerId: 'code-agent:r:t', summary: 'Please reply' }]);
  });

  it('treats one later outbound signal to the return peer as the reply', () => {
    const unanswered = findUnansweredExpectedReplies([
      notificationMessage({ returnPeerId: 'code-agent:r:t' }),
      outboundSignalMessage('code-agent:r:t'),
    ]);

    expect(unanswered).toEqual([]);
  });

  it('injects a reactive reminder and retries when an expected reply is missing at idle', async () => {
    const processor = new CrossAgentMessagingExpectedReplyProcessor();
    const sendSignal = vi.fn();
    const abort = vi.fn((reason: string, options: unknown) => {
      throw Object.assign(new Error(reason), { options });
    });

    await expect(
      processor.processOutputStep({
        finishReason: 'stop',
        toolCalls: [],
        messageList: messageList([notificationMessage({ returnPeerId: 'code-agent:r:t' })]),
        retryCount: 0,
        sendSignal,
        abort,
      } as any),
    ).rejects.toThrow('A connected peer expected a reply');

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reactive', tagName: 'expected-reply-reminder' }),
    );
    expect(abort).toHaveBeenCalledWith(expect.stringContaining('code-agent:r:t'), {
      retry: true,
      metadata: { peerIds: ['code-agent:r:t'] },
    });
  });

  it('does not retry when there are tool calls or no unanswered expected replies', async () => {
    const processor = new CrossAgentMessagingExpectedReplyProcessor();
    const abort = vi.fn();

    await processor.processOutputStep({
      finishReason: 'tool-calls',
      toolCalls: [{ toolName: 'agent_signal_send' }],
      messageList: messageList([notificationMessage({ returnPeerId: 'code-agent:r:t' })]),
      retryCount: 0,
      abort,
    } as any);

    await processor.processOutputStep({
      finishReason: 'stop',
      toolCalls: [],
      messageList: messageList([
        notificationMessage({ returnPeerId: 'code-agent:r:t' }),
        outboundSignalMessage('code-agent:r:t'),
      ]),
      retryCount: 0,
      abort,
    } as any);

    expect(abort).not.toHaveBeenCalled();
  });

  it('builds reminder signal metadata for expected replies', () => {
    expect(createExpectedReplyReminderSignal([{ peerId: 'peer-1', summary: 'Question' }])).toMatchObject({
      type: 'reactive',
      tagName: 'expected-reply-reminder',
      attributes: { count: 1, peers: 'peer-1' },
      metadata: { crossAgentMessaging: { reason: 'expected-reply-unanswered', peerIds: ['peer-1'] } },
    });
  });
});
