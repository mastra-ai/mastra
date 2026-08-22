import { describe, expect, it, vi } from 'vitest';

import {
  CrossAgentMessagingExpectedReplyProcessor,
  createExpectedReplyReminderSignal,
  findUnansweredExpectedReplies,
} from '../messaging-processor.js';

function notificationMessage(options: {
  messageId: string;
  returnPeerId: string;
  expectsReply?: boolean;
  summary?: string;
}) {
  return {
    id: `signal-${options.messageId}`,
    role: 'signal',
    createdAt: new Date(),
    type: 'notification',
    content: {
      format: 2,
      parts: [{ type: 'text', text: options.summary ?? 'Please reply' }],
      metadata: {
        signal: {
          id: `created-signal-${options.messageId}`,
          type: 'notification',
          tagName: 'notification',
          attributes: {
            expectsReply: options.expectsReply ?? true,
            messageId: options.messageId,
            returnPeerId: options.returnPeerId,
          },
          metadata: {
            notification: { source: 'agent-connection', kind: 'peer-signal' },
            crossAgentMessaging: {
              expectsReply: options.expectsReply ?? true,
              messageId: options.messageId,
              returnPeerId: options.returnPeerId,
            },
          },
        },
      },
    },
  } as any;
}

function outboundSignalMessage(options: {
  targetId: string;
  replyTo?: string;
  routingAction?: 'wake' | 'deliver' | 'persist' | 'discard' | 'blocked';
  isError?: boolean;
}) {
  return {
    id: `assistant-${options.targetId}-${options.replyTo ?? 'uncorrelated'}`,
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
            rawInput: {
              targetId: options.targetId,
              summary: 'Reply',
              expectsReply: false,
              replyTo: options.replyTo,
            },
            result: {
              isError: options.isError ?? false,
              target: { id: options.targetId },
              replyTo: options.replyTo,
              routingAction: options.routingAction ?? 'deliver',
            },
          },
        },
      ],
    },
  } as any;
}

function messageList(messages: any[]) {
  return { get: { all: { db: () => messages } } };
}

const REQUEST = { messageId: 'request-1', returnPeerId: 'code-agent:r:t' };

describe('CrossAgentMessagingExpectedReplyProcessor', () => {
  it('finds unanswered expected-reply notifications by message id', () => {
    const unanswered = findUnansweredExpectedReplies([notificationMessage(REQUEST)]);

    expect(unanswered).toEqual([{ messageId: 'request-1', peerId: 'code-agent:r:t', summary: 'Please reply' }]);
  });

  it('requires a correlated successfully routed reply to the expected peer', () => {
    expect(
      findUnansweredExpectedReplies([
        notificationMessage(REQUEST),
        outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', routingAction: 'deliver' }),
      ]),
    ).toEqual([]);

    for (const outbound of [
      outboundSignalMessage({ targetId: 'code-agent:r:t' }),
      outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'other-request' }),
      outboundSignalMessage({ targetId: 'other-peer', replyTo: 'request-1' }),
      outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', routingAction: 'discard' }),
      outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', routingAction: 'blocked' }),
      outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', isError: true }),
    ]) {
      expect(findUnansweredExpectedReplies([notificationMessage(REQUEST), outbound])).toHaveLength(1);
    }
  });

  it('tracks concurrent requests to the same peer independently', () => {
    const unanswered = findUnansweredExpectedReplies([
      notificationMessage({ messageId: 'request-1', returnPeerId: 'code-agent:r:t', summary: 'First' }),
      notificationMessage({ messageId: 'request-2', returnPeerId: 'code-agent:r:t', summary: 'Second' }),
      outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', routingAction: 'persist' }),
    ]);

    expect(unanswered).toEqual([{ messageId: 'request-2', peerId: 'code-agent:r:t', summary: 'Second' }]);
  });

  it('injects a correlated reactive reminder and retries when an expected reply is missing at idle', async () => {
    const processor = new CrossAgentMessagingExpectedReplyProcessor();
    const sendSignal = vi.fn();
    const abort = vi.fn((reason: string, options: unknown) => {
      throw Object.assign(new Error(reason), { options });
    });

    await expect(
      processor.processOutputStep({
        finishReason: 'stop',
        toolCalls: [],
        messageList: messageList([notificationMessage(REQUEST)]),
        retryCount: 0,
        sendSignal,
        abort,
      } as any),
    ).rejects.toThrow('A connected peer expected a correlated reply');

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'expected-reply-reminder',
        attributes: expect.objectContaining({ messageIds: 'request-1' }),
      }),
    );
    expect(abort).toHaveBeenCalledWith(expect.stringContaining('replyTo=request-1'), {
      retry: true,
      metadata: { peerIds: ['code-agent:r:t'], messageIds: ['request-1'] },
    });
  });

  it('does not retry when there are tool calls or no unanswered expected replies', async () => {
    const processor = new CrossAgentMessagingExpectedReplyProcessor();
    const abort = vi.fn();

    await processor.processOutputStep({
      finishReason: 'tool-calls',
      toolCalls: [{ toolName: 'agent_signal_send' }],
      messageList: messageList([notificationMessage(REQUEST)]),
      retryCount: 0,
      abort,
    } as any);

    await processor.processOutputStep({
      finishReason: 'stop',
      toolCalls: [],
      messageList: messageList([
        notificationMessage(REQUEST),
        outboundSignalMessage({ targetId: 'code-agent:r:t', replyTo: 'request-1', routingAction: 'wake' }),
      ]),
      retryCount: 0,
      abort,
    } as any);

    expect(abort).not.toHaveBeenCalled();
  });

  it('builds reminder signal metadata for correlated expected replies', () => {
    expect(
      createExpectedReplyReminderSignal([{ messageId: 'request-1', peerId: 'peer-1', summary: 'Question' }]),
    ).toMatchObject({
      type: 'reactive',
      tagName: 'expected-reply-reminder',
      attributes: { count: 1, peers: 'peer-1', messageIds: 'request-1' },
      metadata: {
        crossAgentMessaging: {
          reason: 'expected-reply-unanswered',
          peerIds: ['peer-1'],
          messageIds: ['request-1'],
        },
      },
    });
  });
});
