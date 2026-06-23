import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import type { ProcessOutputStepArgs } from '@mastra/core/processors';

type AgentSignalInput = Parameters<NonNullable<ProcessOutputStepArgs['sendSignal']>>[0];

const TOOL_NAME = 'agent_signal_send';
const REMINDER_TAG = 'expected-reply-reminder';

type ExpectedReplyObligation = {
  peerId: string;
  summary?: string;
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

    const peerIds = unanswered.map(item => item.peerId);
    if (sendSignal) {
      await sendSignal(createExpectedReplyReminderSignal(unanswered));
    }

    if (retryCount === 0) {
      abort(`A connected peer expected a reply. Send one outbound ${TOOL_NAME} call to: ${peerIds.join(', ')}`, {
        retry: true,
        metadata: { peerIds },
      });
    }

    return messageList.get.all.db();
  }
}

export function createExpectedReplyReminderSignal(obligations: ExpectedReplyObligation[]): AgentSignalInput {
  const peerIds = obligations.map(item => item.peerId);
  const summaries = obligations.map(item => item.summary).filter((summary): summary is string => Boolean(summary));

  return {
    type: 'reactive',
    tagName: REMINDER_TAG,
    contents: `A connected peer expected a reply, but no outbound ${TOOL_NAME} call was sent after their notification. Send one signal to: ${peerIds.join(', ')}.`,
    attributes: { count: obligations.length, peers: peerIds.join(',') },
    metadata: {
      crossAgentMessaging: {
        reason: 'expected-reply-unanswered',
        peerIds,
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
      obligations.set(expectedReply.peerId, expectedReply);
      continue;
    }

    const outboundPeerId = readOutboundPeerId(message);
    if (outboundPeerId) {
      obligations.delete(outboundPeerId);
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

  if (!expectsReply || !returnPeerId) return;

  return { peerId: returnPeerId, summary: readText(message) };
}

function readOutboundPeerId(message: MastraDBMessage): string | undefined {
  for (const part of message.content.parts ?? []) {
    const toolInvocation = part.type === 'tool-invocation' ? (part as any).toolInvocation : undefined;
    if (!toolInvocation || toolInvocation.toolName !== TOOL_NAME) continue;

    const isErrored = readToolResultError(toolInvocation.result);
    if (isErrored) continue;

    const input =
      readRecord(toolInvocation.rawInput) ?? readRecord(toolInvocation.args) ?? readRecord(toolInvocation.input);
    const result = readRecord(toolInvocation.result);
    const target = readRecord(result?.target);
    const targetId = readString(input?.targetId) ?? readString(target?.id);
    if (targetId) return targetId;
  }
}

function readToolResultError(result: unknown): boolean {
  const resultRecord = readRecord(result);
  return resultRecord?.isError === true;
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
