import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import type { ProcessOutputStepArgs } from '@mastra/core/processors';

import type { AgentSignalRoutingAction } from './types.js';

type AgentSignalInput = Parameters<NonNullable<ProcessOutputStepArgs['sendSignal']>>[0];

const TOOL_NAME = 'agent_signal_send';
const REMINDER_TAG = 'expected-reply-reminder';
const SUCCESSFUL_REPLY_ACTIONS = new Set<AgentSignalRoutingAction>(['wake', 'deliver', 'persist']);

export type ExpectedReplyObligation = {
  messageId: string;
  peerId: string;
  summary?: string;
};

type OutboundReply = {
  targetId: string;
  replyTo?: string;
  routingAction?: AgentSignalRoutingAction;
};

export class CrossAgentMessagingExpectedReplyProcessor {
  readonly id = 'cross-agent-messaging-expected-reply';
  readonly name = 'Cross Agent Messaging Expected Reply Watchdog';

  async processOutputStep(args: ProcessOutputStepArgs): Promise<MastraDBMessage[]> {
    const { finishReason, toolCalls, messageList, retryCount, sendSignal, abort } = args;

    if (toolCalls?.length) return messageList.get.all.db();
    if (finishReason && finishReason !== 'stop') return messageList.get.all.db();

    const unanswered = findUnansweredExpectedReplies(messageList.get.all.db());
    if (!unanswered.length) return messageList.get.all.db();

    const peerIds = [...new Set(unanswered.map(item => item.peerId))];
    const messageIds = unanswered.map(item => item.messageId);
    if (sendSignal) {
      await sendSignal(createExpectedReplyReminderSignal(unanswered));
    }

    if (retryCount === 0) {
      abort(
        `A connected peer expected a correlated reply. Send one outbound ${TOOL_NAME} call for each request: ${unanswered
          .map(item => `${item.peerId} replyTo=${item.messageId}`)
          .join(', ')}`,
        {
          retry: true,
          metadata: { peerIds, messageIds },
        },
      );
    }

    return messageList.get.all.db();
  }
}

export function createExpectedReplyReminderSignal(obligations: ExpectedReplyObligation[]): AgentSignalInput {
  const peerIds = [...new Set(obligations.map(item => item.peerId))];
  const messageIds = obligations.map(item => item.messageId);
  const summaries = obligations.map(item => item.summary).filter((summary): summary is string => Boolean(summary));

  return {
    type: 'reactive',
    tagName: REMINDER_TAG,
    contents: `A connected peer expected a reply, but no successfully routed correlated ${TOOL_NAME} call was sent after their notification. Reply to: ${obligations
      .map(item => `${item.peerId} with replyTo=${item.messageId}`)
      .join(', ')}.`,
    attributes: {
      count: obligations.length,
      peers: peerIds.join(','),
      messageIds: messageIds.join(','),
    },
    metadata: {
      crossAgentMessaging: {
        reason: 'expected-reply-unanswered',
        peerIds,
        messageIds,
        summaries,
      },
    },
  };
}

export function findUnansweredExpectedReplies(messages: MastraDBMessage[]): ExpectedReplyObligation[] {
  const obligations = new Map<string, ExpectedReplyObligation>();

  for (const message of messages) {
    const expectedReply = readExpectedReplyObligation(message);
    if (expectedReply) {
      obligations.set(expectedReply.messageId, expectedReply);
      continue;
    }

    for (const outboundReply of readOutboundReplies(message)) {
      if (!outboundReply.replyTo || !isSuccessfullyRouted(outboundReply.routingAction)) continue;
      const obligation = obligations.get(outboundReply.replyTo);
      if (obligation?.peerId === outboundReply.targetId) {
        obligations.delete(outboundReply.replyTo);
      }
    }
  }

  return [...obligations.values()];
}

function readExpectedReplyObligation(message: MastraDBMessage): ExpectedReplyObligation | undefined {
  if (message.role !== 'signal') return;

  const signal = message.content.metadata?.signal;
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) return;

  const signalRecord = signal as Record<string, unknown>;
  if (signalRecord.type !== 'notification') return;

  const metadata = readRecord(signalRecord.metadata);
  const notification = readRecord(metadata?.notification);
  if (notification?.source !== 'agent-connection' || notification?.kind !== 'peer-signal') return;

  const crossAgentMessaging = readRecord(metadata?.crossAgentMessaging);
  const attributes = readRecord(signalRecord.attributes);
  const expectsReply = crossAgentMessaging?.expectsReply === true || attributes?.expectsReply === true;
  const returnPeerId = readString(crossAgentMessaging?.returnPeerId) ?? readString(attributes?.returnPeerId);
  const messageId =
    readString(crossAgentMessaging?.messageId) ??
    readString(attributes?.messageId) ??
    readString(signalRecord.id) ??
    readString(message.id);

  if (!expectsReply || !returnPeerId || !messageId) return;

  return { messageId, peerId: returnPeerId, summary: readText(message) };
}

function readOutboundReplies(message: MastraDBMessage): OutboundReply[] {
  const replies: OutboundReply[] = [];
  for (const part of message.content.parts ?? []) {
    const toolInvocation = part.type === 'tool-invocation' ? (part as any).toolInvocation : undefined;
    if (!toolInvocation || toolInvocation.toolName !== TOOL_NAME) continue;

    const result = readRecord(toolInvocation.result);
    if (result?.isError === true) continue;

    const input =
      readRecord(toolInvocation.rawInput) ?? readRecord(toolInvocation.args) ?? readRecord(toolInvocation.input);
    const target = readRecord(result?.target);
    const targetId = readString(input?.targetId) ?? readString(target?.id);
    if (!targetId) continue;

    replies.push({
      targetId,
      replyTo: readString(result?.replyTo) ?? readString(input?.replyTo),
      routingAction: readRoutingAction(result?.routingAction),
    });
  }
  return replies;
}

function isSuccessfullyRouted(action: AgentSignalRoutingAction | undefined): boolean {
  return action !== undefined && SUCCESSFUL_REPLY_ACTIONS.has(action);
}

function readRoutingAction(value: unknown): AgentSignalRoutingAction | undefined {
  return value === 'wake' || value === 'deliver' || value === 'persist' || value === 'discard' || value === 'blocked'
    ? value
    : undefined;
}

function readText(message: MastraDBMessage): string | undefined {
  const text = (message.content.parts ?? [])
    .map((part: MastraMessagePart) => (part.type === 'text' ? part.text : ''))
    .join('\n')
    .trim();
  return text || undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
