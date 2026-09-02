import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type {
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
  Processor,
  ProcessorStreamWriter,
} from '@mastra/core/processors';

import { withOmInternalThreadId } from '../internal-request-context';
import { publishSubconsciousError } from './activity';
import { getRemindMessageMetadata, getRemindMessageText, REMIND_MESSAGE_METADATA_KEY } from './remind-protocol';

const NUDGE_AFTER_MS = 20_000;
const MAX_CONTINUATION_ATTEMPTS = 2;
const OUTPUT_HANDLED_KEY = 'remind-continuation-output-handled';
const QUESTION_TIMERS_KEY = 'remind-question-timers';

type PendingQuestion = {
  replyId: string;
  askedAt: number;
  attempt: number;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ReplyResult = { delivered?: unknown; replyId?: unknown; moreComing?: unknown };

function recordTerminalReply(replies: Set<string>, output: ReplyResult | undefined): void {
  if (output?.delivered === true && output.moreComing === false && typeof output.replyId === 'string') {
    replies.add(output.replyId);
  }
}

function terminalReplies(messages: MastraDBMessage[], result?: ProcessOutputResultArgs['result']): Set<string> {
  const replies = new Set<string>();
  for (const message of messages) {
    const terminalMarker = getRemindMessageText(message).match(
      /^Memory question (\S+) terminal: unable to answer after two continuation attempts$/,
    );
    if (terminalMarker?.[1]) replies.add(terminalMarker[1]);
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation') continue;
      const invocation = part.toolInvocation;
      if (invocation.toolName !== 'reply_to_memory_question' || invocation.state !== 'result') continue;
      recordTerminalReply(replies, invocation.result as ReplyResult | undefined);
    }
  }
  for (const step of result?.steps ?? []) {
    for (const toolResult of step.toolResults ?? []) {
      if (toolResult.payload.toolName !== 'reply_to_memory_question') continue;
      recordTerminalReply(replies, toolResult.payload.result as ReplyResult | undefined);
    }
  }
  return replies;
}

function messageMetadata(message: MastraDBMessage) {
  const metadata = getRemindMessageMetadata(message);
  if (metadata) return metadata;
  if (message.role !== 'user') return undefined;

  const text = getRemindMessageText(message);
  const question = text.match(/^Memory question (\S+)\n/);
  if (question?.[1]) {
    return { type: 'question' as const, replyId: question[1], askedAt: message.createdAt.getTime() };
  }
  const continuation = text.match(
    /^Continue these unanswered memory questions \(attempt (\d+)\): (.+)\. Reply to each with reply_to_memory_question\.$/,
  );
  if (!continuation?.[1] || !continuation[2]) return undefined;
  return {
    type: 'continuation' as const,
    replyIds: continuation[2].split(', ').filter(Boolean),
    attempt: Number(continuation[1]),
  };
}

function getPendingQuestions(messages: MastraDBMessage[], answered = terminalReplies(messages)): PendingQuestion[] {
  const pending = new Map<string, PendingQuestion>();
  for (const message of messages) {
    const metadata = messageMetadata(message);
    if (metadata?.type === 'question') {
      pending.set(metadata.replyId, { replyId: metadata.replyId, askedAt: metadata.askedAt, attempt: 0 });
    } else if (metadata?.type === 'continuation') {
      for (const replyId of metadata.replyIds) {
        const question = pending.get(replyId);
        if (question) question.attempt = Math.max(question.attempt, metadata.attempt);
      }
    }
  }
  for (const replyId of answered) pending.delete(replyId);
  return [...pending.values()];
}

function consumeWakeOutput(output: { consumeStream(): Promise<unknown> }, writer?: ProcessorStreamWriter): void {
  void output.consumeStream().catch(async error => {
    await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer });
  });
}

export class RemindContinuationProcessor implements Processor<'remind-continuation'> {
  readonly id = 'remind-continuation';
  readonly name = 'Reminder Continuation Processor';
  private readonly deliveredTerminalReplies = new Set<string>();

  constructor(
    private readonly options: {
      threadId: string;
      resourceId: string;
      parentThreadId: string;
      parentAgent: Agent;
      maxSteps: number;
      getReminderAgent(): Agent;
    },
  ) {}

  async processOutputStep(args: ProcessOutputStepArgs): Promise<MastraDBMessage[]> {
    if (args.toolCalls?.length || (args.finishReason && args.finishReason !== 'stop')) return args.messages;

    const messages = args.messageList.get.all
      .db()
      .filter(message => message.threadId === this.options.threadId && message.resourceId === this.options.resourceId);
    const pending = getPendingQuestions(messages);
    if (pending.length === 0) return args.messages;

    const timers = (args.state[QUESTION_TIMERS_KEY] ??= new Map<string, number>()) as Map<string, number>;
    for (const question of pending) timers.set(question.replyId, timers.get(question.replyId) ?? question.askedAt);
    const oldest = Math.min(...pending.map(question => timers.get(question.replyId) ?? question.askedAt));
    if (Date.now() - oldest < NUDGE_AFTER_MS) return args.messages;

    if (args.retryCount === 0) {
      if (args.sendSignal) {
        await args.sendSignal({
          id: `subconscious:remind:nudge:${args.stepNumber}:${args.retryCount}`,
          type: 'reactive',
          tagName: 'remind-continuation',
          contents: `Before stopping, answer these memory questions with reply_to_memory_question: ${pending
            .map(question => question.replyId)
            .join(', ')}.`,
          attributes: { replyIds: pending.map(question => question.replyId).join(',') },
          metadata: { origin: 'subconscious' },
        });
      }
      args.abort('Outstanding memory questions require a reply before this run stops.', {
        retry: true,
        metadata: { replyIds: pending.map(question => question.replyId) },
      });
    }
    return args.messages;
  }

  async processOutputResult(args: ProcessOutputResultArgs): Promise<MastraDBMessage[]> {
    if (args.state[OUTPUT_HANDLED_KEY]) return args.messages;
    args.state[OUTPUT_HANDLED_KEY] = true;

    try {
      const messages = args.messageList.get.all
        .db()
        .filter(
          message => message.threadId === this.options.threadId && message.resourceId === this.options.resourceId,
        );
      const pending = getPendingQuestions(messages, terminalReplies(messages, args.result));
      if (pending.length === 0) return args.messages;

      const retryable = pending.filter(question => question.attempt < MAX_CONTINUATION_ATTEMPTS);
      const byAttempt = new Map<number, PendingQuestion[]>();
      for (const question of retryable) {
        const group = byAttempt.get(question.attempt) ?? [];
        group.push(question);
        byAttempt.set(question.attempt, group);
      }
      for (const questions of byAttempt.values()) await this.dispatchContinuation(questions, args);
      for (const question of pending.filter(question => question.attempt >= MAX_CONTINUATION_ATTEMPTS)) {
        await this.deliverUnableToAnswer(question.replyId, args.messageList);
      }
    } catch (error) {
      await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer: args.writer });
    }
    return args.messages;
  }

  private async dispatchContinuation(questions: PendingQuestion[], args: ProcessOutputResultArgs): Promise<void> {
    const attempt = Math.max(...questions.map(question => question.attempt)) + 1;
    const replyIds = questions.map(question => question.replyId);
    const reminderAgent = this.options.getReminderAgent();
    const delivery = reminderAgent.sendMessage(
      {
        contents: `Continue these unanswered memory questions (attempt ${attempt}): ${replyIds.join(', ')}. Reply to each with reply_to_memory_question.`,
        metadata: {
          [REMIND_MESSAGE_METADATA_KEY]: { type: 'continuation', replyIds, attempt },
        },
      },
      {
        resourceId: this.options.resourceId,
        threadId: this.options.threadId,
        ifActive: { behavior: 'deliver' },
        ifIdle: {
          behavior: 'wake',
          streamOptions: {
            memory: { thread: this.options.threadId, resource: this.options.resourceId },
            requestContext: withOmInternalThreadId(args.requestContext, reminderAgent.id),
            maxSteps: this.options.maxSteps,
          },
        },
      },
    );
    const accepted = await delivery.accepted;
    if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
      throw new Error(`Reminder continuation was not accepted (${accepted.action}).`);
    }
    if (accepted.action === 'wake') consumeWakeOutput(accepted.output, args.writer);
  }

  private async deliverUnableToAnswer(
    replyId: string,
    messageList: ProcessOutputResultArgs['messageList'],
  ): Promise<void> {
    if (this.deliveredTerminalReplies.has(replyId)) return;
    const signal = {
      id: `${replyId}:terminal:signal`,
      type: 'reactive' as const,
      tagName: 'remind-answer',
      contents: 'The memory sidekick was unable to answer this memory question after two continuation attempts.',
      createdAt: new Date(),
      metadata: { origin: 'subconscious' },
      attributes: {
        source: 'subconscious',
        agent: 'remind',
        replyId,
        moreComing: 'false',
        outcome: 'unable-to-answer',
      },
    };
    const persisted = this.options.parentAgent.sendSignal(signal, {
      resourceId: this.options.resourceId,
      threadId: this.options.parentThreadId,
      ifActive: { behavior: 'persist' },
      ifIdle: { behavior: 'persist' },
    });
    const accepted = await persisted.accepted;
    if (accepted.action !== 'persist')
      throw new Error(`Terminal reminder failure was not persisted (${accepted.action}).`);
    await persisted.persisted;

    const delivery = this.options.parentAgent.sendSignal(signal, {
      resourceId: this.options.resourceId,
      threadId: this.options.parentThreadId,
      ifActive: { behavior: 'deliver' },
      ifIdle: { behavior: 'discard' },
    });
    const delivered = await delivery.accepted;
    if (delivered.action === 'blocked') throw new Error('Terminal reminder failure delivery was blocked.');
    this.deliveredTerminalReplies.add(replyId);
    messageList.add(
      {
        id: `subconscious:remind:${replyId}:terminal`,
        role: 'assistant',
        threadId: this.options.threadId,
        resourceId: this.options.resourceId,
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: `Memory question ${replyId} terminal: unable to answer after two continuation attempts`,
            },
          ],
        },
      },
      'response',
    );
  }
}
