import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type {
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
  ProcessToolResultArgs,
  Processor,
  ProcessorStreamWriter,
} from '@mastra/core/processors';

import type { Memory } from '../../..';
import { withOmInternalThreadId } from '../internal-request-context';
import { publishSubconsciousError } from './activity';
import {
  getRemindMessageText,
  getRemindProtocol,
  REMIND_DELIVERY_METADATA_KEY,
  REMIND_PROTOCOL_METADATA_KEY,
} from './remind-protocol';
import type {
  RemindContinuationEvent,
  RemindDeliveryFailureEvent,
  RemindProtocolEvent,
  RemindTerminalDeliveredEvent,
  RemindTerminalPendingEvent,
} from './remind-protocol';

const PAGE_SIZE = 100;
const MAX_CONTINUATION_ATTEMPTS = 2;
const MAX_TERMINAL_DELIVERY_ATTEMPTS = 2;
const STATE_KEY = 'remind-continuation-view';
const OUTPUT_HANDLED_KEY = 'remind-continuation-output-handled';

export interface RemindOutstandingQuestion {
  replyId: string;
  createdAt: number;
  attempts: number;
  moreComing: boolean;
  terminalPending: boolean;
}

interface RemindContinuationView {
  outstanding: Map<string, RemindOutstandingQuestion>;
  seenEventIds: Set<string>;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function commonEventFields(options: {
  eventId: string;
  deliveryId: string;
  parentAgentId: string;
  parentThreadId: string;
  resourceId: string;
  createdAt?: number;
}) {
  const { createdAt, ...identity } = options;
  return { ...identity, createdAt: createdAt ?? Date.now() };
}

async function nextProtocolCreatedAt(memory: Memory, threadId: string, resourceId: string): Promise<number> {
  const store = await memory.storage.getStore('memory');
  const newest = await store?.listMessages({
    threadId,
    resourceId,
    page: 0,
    perPage: 1,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  const latest = newest?.messages[0]?.createdAt?.getTime() ?? 0;
  return Math.max(Date.now(), latest + 1);
}

function protocolMessage(options: {
  event: RemindProtocolEvent;
  threadId: string;
  resourceId: string;
  text: string;
}): MastraDBMessage {
  return {
    id: options.event.eventId,
    role: 'user',
    threadId: options.threadId,
    resourceId: options.resourceId,
    createdAt: new Date(options.event.createdAt),
    content: {
      format: 2,
      parts: [{ type: 'text', text: options.text }],
      metadata: { [REMIND_PROTOCOL_METADATA_KEY]: options.event },
    },
  };
}

async function saveProtocolMessage(
  memory: Memory,
  options: Parameters<typeof protocolMessage>[0],
): Promise<MastraDBMessage> {
  const message = protocolMessage(options);
  await memory.saveMessages({ messages: [message] });
  return message;
}

function applyEvent(view: RemindContinuationView, event: RemindProtocolEvent): void {
  if (view.seenEventIds.has(event.eventId)) return;
  view.seenEventIds.add(event.eventId);

  switch (event.kind) {
    case 'question':
      view.outstanding.set(event.replyId, {
        replyId: event.replyId,
        createdAt: event.createdAt,
        attempts: view.outstanding.get(event.replyId)?.attempts ?? 0,
        moreComing: false,
        terminalPending: false,
      });
      break;
    case 'partial-reply': {
      const existing = view.outstanding.get(event.replyId);
      if (existing) existing.moreComing = true;
      break;
    }
    case 'continuation':
      for (const replyId of event.outstandingReplyIds) {
        const existing = view.outstanding.get(replyId);
        if (existing) existing.attempts = Math.max(existing.attempts, event.attempts[replyId] ?? 0);
      }
      break;
    case 'terminal-delivered':
    case 'routing-failure':
      view.outstanding.delete(event.replyId);
      break;
    case 'delivery-failure':
      if (event.deliveryKind === 'terminal' && event.exhausted) view.outstanding.delete(event.replyId);
      break;
    case 'terminal-pending-delivery': {
      const existing = view.outstanding.get(event.replyId);
      if (existing) existing.terminalPending = true;
      break;
    }
    case 'passive-check':
      break;
  }
}

function applyEvents(events: RemindProtocolEvent[]): RemindContinuationView {
  const view: RemindContinuationView = { outstanding: new Map(), seenEventIds: new Set() };
  for (const event of events) applyEvent(view, event);
  return view;
}

export async function reconstructRemindContinuationView(options: {
  memory: Memory;
  threadId: string;
  resourceId: string;
}): Promise<RemindContinuationView> {
  const store = await options.memory.storage.getStore('memory');
  if (!store) return { outstanding: new Map(), seenEventIds: new Set() };

  const newestEvents: RemindProtocolEvent[] = [];
  const olderQuestions = new Map<string, number>();
  let snapshot: RemindContinuationEvent | undefined;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await store.listMessages({
      threadId: options.threadId,
      resourceId: options.resourceId,
      page,
      perPage: PAGE_SIZE,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    hasMore = result.hasMore;
    page++;

    for (const message of result.messages) {
      const event = getRemindProtocol(message);
      if (!event) continue;
      if (!snapshot && event.kind === 'continuation') {
        snapshot = event;
        continue;
      }
      if (!snapshot) newestEvents.push(event);
      else if (event.kind === 'question') olderQuestions.set(event.replyId, event.createdAt);
    }

    if (snapshot) break;
  }

  if (!snapshot) return applyEvents(newestEvents.reverse());

  const view: RemindContinuationView = { outstanding: new Map(), seenEventIds: new Set([snapshot.eventId]) };
  for (const replyId of snapshot.outstandingReplyIds) {
    view.outstanding.set(replyId, {
      replyId,
      createdAt: 0,
      attempts: snapshot.attempts[replyId] ?? 0,
      moreComing: false,
      terminalPending: false,
    });
  }
  for (const event of newestEvents.reverse()) applyEvent(view, event);
  for (const [replyId, createdAt] of olderQuestions) {
    const question = view.outstanding.get(replyId);
    if (question && question.createdAt === 0) question.createdAt = createdAt;
  }

  const missingQuestionIds = () =>
    new Set(
      [...view.outstanding.values()].filter(question => question.createdAt === 0).map(question => question.replyId),
    );
  let missing = missingQuestionIds();
  while (missing.size > 0 && hasMore) {
    const result = await store.listMessages({
      threadId: options.threadId,
      resourceId: options.resourceId,
      page,
      perPage: PAGE_SIZE,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    hasMore = result.hasMore;
    page++;
    for (const message of result.messages) {
      const event = getRemindProtocol(message);
      if (event?.kind !== 'question' || !missing.has(event.replyId)) continue;
      const question = view.outstanding.get(event.replyId);
      if (question) question.createdAt = event.createdAt;
    }
    missing = missingQuestionIds();
  }

  return view;
}

function consumeWakeOutput(output: { consumeStream(): Promise<unknown> }, writer?: ProcessorStreamWriter): void {
  void output.consumeStream().catch(async error => {
    await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer });
  });
}

export class RemindContinuationProcessor implements Processor<'remind-continuation'> {
  readonly id = 'remind-continuation';
  readonly name = 'Reminder Continuation Processor';

  constructor(
    private readonly options: {
      memory: Memory;
      threadId: string;
      resourceId: string;
      parentThreadId: string;
      parentAgent: Agent;
      parentAgentId: string;
      maxSteps: number;
      getReminderAgent(): Agent;
    },
  ) {}

  private async view(state: Record<string, unknown>, force = false): Promise<RemindContinuationView> {
    if (!force && state[STATE_KEY]) return state[STATE_KEY] as RemindContinuationView;
    const view = await reconstructRemindContinuationView(this.options);
    state[STATE_KEY] = view;
    return view;
  }

  async processToolResult({ state, messages }: ProcessToolResultArgs): Promise<MastraDBMessage[]> {
    delete state[STATE_KEY];
    return messages;
  }

  async processOutputStep(args: ProcessOutputStepArgs): Promise<MastraDBMessage[]> {
    if (args.toolCalls?.length || (args.finishReason && args.finishReason !== 'stop')) return args.messages;
    const view = await this.view(args.state);
    const outstanding = [...view.outstanding.values()].filter(question => !question.terminalPending);
    if (outstanding.length === 0) return args.messages;

    if (args.sendSignal) {
      await args.sendSignal({
        id: `subconscious:remind:continuation-nudge:${args.stepNumber}:${args.retryCount}`,
        type: 'reactive',
        tagName: 'remind-continuation',
        contents: `Before stopping, answer the outstanding memory questions with reply_to_memory_question: ${outstanding
          .map(question => question.replyId)
          .join(', ')}. Use moreComing=true only when further work is genuinely required.`,
        attributes: {
          replyIds: outstanding.map(question => question.replyId).join(','),
          oldestCreatedAt: String(Math.min(...outstanding.map(question => question.createdAt))),
        },
        metadata: { origin: 'subconscious' },
      });
    }
    if (args.retryCount === 0) {
      args.abort('Outstanding memory questions require a reply before this run stops.', {
        retry: true,
        metadata: { replyIds: outstanding.map(question => question.replyId) },
      });
    }
    return args.messages;
  }

  async processOutputResult(args: ProcessOutputResultArgs): Promise<MastraDBMessage[]> {
    if (args.state[OUTPUT_HANDLED_KEY]) return args.messages;
    args.state[OUTPUT_HANDLED_KEY] = true;
    try {
      const view = await this.view(args.state, true);
      const outstanding = [...view.outstanding.values()];
      if (outstanding.length === 0) return args.messages;

      const exhausted = outstanding.filter(
        question => question.terminalPending || question.attempts >= MAX_CONTINUATION_ATTEMPTS,
      );
      for (const question of exhausted) await this.deliverUnableToAnswer(question.replyId, args.writer);

      const refreshed = await reconstructRemindContinuationView(this.options);
      const retryable = [...refreshed.outstanding.values()].filter(
        question => !question.terminalPending && question.attempts < MAX_CONTINUATION_ATTEMPTS,
      );
      if (retryable.length > 0) {
        await this.persistAndDispatchContinuation([...refreshed.outstanding.values()], retryable, args);
      }
    } catch (error) {
      await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer: args.writer });
    }
    return args.messages;
  }

  private async persistAndDispatchContinuation(
    outstanding: RemindOutstandingQuestion[],
    retryable: RemindOutstandingQuestion[],
    args: ProcessOutputResultArgs,
  ): Promise<void> {
    const retryableIds = new Set(retryable.map(question => question.replyId));
    const attempts = Object.fromEntries(
      outstanding.map(question => [question.replyId, question.attempts + (retryableIds.has(question.replyId) ? 1 : 0)]),
    );
    const eventId = `subconscious:remind:continuation:${outstanding
      .map(question => `${question.replyId}:${attempts[question.replyId]}`)
      .sort()
      .join('|')}`;
    const createdAt = await nextProtocolCreatedAt(this.options.memory, this.options.threadId, this.options.resourceId);
    const event: RemindContinuationEvent = {
      kind: 'continuation',
      ...commonEventFields({
        eventId,
        deliveryId: `${eventId}:delivery`,
        parentAgentId: this.options.parentAgentId,
        parentThreadId: this.options.parentThreadId,
        resourceId: this.options.resourceId,
        createdAt,
      }),
      outstandingReplyIds: outstanding.map(question => question.replyId),
      attempts,
    };
    await saveProtocolMessage(this.options.memory, {
      event,
      threadId: this.options.threadId,
      resourceId: this.options.resourceId,
      text: `Continue unresolved memory questions: ${retryable.map(question => question.replyId).join(', ')}. Reply to each with reply_to_memory_question.`,
    });

    const reminderAgent = this.options.getReminderAgent();
    const delivery = reminderAgent.sendMessage(
      {
        contents: `Resolve canonical reminder event ${eventId}.`,
        metadata: { [REMIND_DELIVERY_METADATA_KEY]: { eventId, deliveryId: event.deliveryId } },
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

  private async deliverUnableToAnswer(replyId: string, writer?: ProcessorStreamWriter): Promise<void> {
    const view = await reconstructRemindContinuationView(this.options);
    if (!view.outstanding.has(replyId)) return;

    const signalId = `${replyId}:terminal:signal`;
    const pendingEventId = `${replyId}:terminal:pending`;
    const deliveredEventId = `${replyId}:terminal:delivered`;
    const failureEventIds = [1, 2].map(attempt => `${replyId}:delivery-failure:terminal:${attempt}`);
    const store = await this.options.memory.storage.getStore('memory');
    const stored = await store?.listMessagesById({
      messageIds: [pendingEventId, deliveredEventId, ...failureEventIds],
    });
    const storedById = new Map((stored?.messages ?? []).map(message => [message.id, message]));
    const existingDeliveredMessage = storedById.get(deliveredEventId);
    if (existingDeliveredMessage && getRemindProtocol(existingDeliveredMessage)?.kind === 'terminal-delivered') return;

    const existingFailures = failureEventIds.flatMap(eventId => {
      const message = storedById.get(eventId);
      const event = message && getRemindProtocol(message);
      return event?.kind === 'delivery-failure' ? [event] : [];
    });
    if (existingFailures.some(failure => failure.exhausted)) return;

    const existingPendingMessage = storedById.get(pendingEventId);
    const existingPending = existingPendingMessage && getRemindProtocol(existingPendingMessage);
    const terminalOutcome =
      existingPending?.kind === 'terminal-pending-delivery' ? existingPending.outcome : 'unable-to-answer';
    const answer =
      (existingPendingMessage && getRemindMessageText(existingPendingMessage).split('\n\n').slice(1).join('\n\n')) ||
      'Unable to answer this memory question after two continuation attempts.';
    if (existingPending?.kind !== 'terminal-pending-delivery') {
      const pending: RemindTerminalPendingEvent = {
        kind: 'terminal-pending-delivery',
        ...commonEventFields({
          eventId: pendingEventId,
          deliveryId: signalId,
          parentAgentId: this.options.parentAgentId,
          parentThreadId: this.options.parentThreadId,
          resourceId: this.options.resourceId,
          createdAt: await nextProtocolCreatedAt(this.options.memory, this.options.threadId, this.options.resourceId),
        }),
        replyId,
        outcome: terminalOutcome,
      };
      await saveProtocolMessage(this.options.memory, {
        event: pending,
        threadId: this.options.threadId,
        resourceId: this.options.resourceId,
        text: `Terminal reply pending delivery for ${replyId}\n\n${answer}`,
      });
    }

    const firstAttempt = Math.max(0, ...existingFailures.map(failure => failure.attempt)) + 1;
    for (let attempt = firstAttempt; attempt <= MAX_TERMINAL_DELIVERY_ATTEMPTS; attempt++) {
      try {
        const result = this.options.parentAgent.sendSignal(
          {
            id: signalId,
            type: 'reactive',
            tagName: 'memory-reply',
            contents: answer,
            attributes: { replyId, moreComing: false, outcome: terminalOutcome },
            metadata: { origin: 'subconscious', replyId, moreComing: false, outcome: terminalOutcome },
          },
          {
            threadId: this.options.parentThreadId,
            resourceId: this.options.resourceId,
            ifActive: { behavior: 'deliver' },
            ifIdle: { behavior: 'wake' },
          },
        );
        const accepted = await result.accepted;
        if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
          throw new Error(`Terminal reply delivery was not accepted (${accepted.action}).`);
        }
        if (accepted.action === 'wake') consumeWakeOutput(accepted.output, writer);
      } catch (error) {
        const failure: RemindDeliveryFailureEvent = {
          kind: 'delivery-failure',
          ...commonEventFields({
            eventId: `${replyId}:delivery-failure:terminal:${attempt}`,
            deliveryId: signalId,
            parentAgentId: this.options.parentAgentId,
            parentThreadId: this.options.parentThreadId,
            resourceId: this.options.resourceId,
            createdAt: await nextProtocolCreatedAt(this.options.memory, this.options.threadId, this.options.resourceId),
          }),
          replyId,
          deliveryKind: 'terminal',
          attempt,
          exhausted: attempt === MAX_TERMINAL_DELIVERY_ATTEMPTS,
          error: errorText(error),
        };
        try {
          await saveProtocolMessage(this.options.memory, {
            event: failure,
            threadId: this.options.threadId,
            resourceId: this.options.resourceId,
            text: `Terminal reply delivery attempt ${attempt} failed for ${replyId}: ${failure.error}`,
          });
        } catch (persistenceError) {
          await publishSubconsciousError({
            error: `remind: ${failure.error}; delivery-failure persistence failed: ${errorText(persistenceError)}`,
            agent: 'remind',
            writer,
          });
        }
        if (attempt < MAX_TERMINAL_DELIVERY_ATTEMPTS) continue;
        await publishSubconsciousError({ error: `remind: ${failure.error}`, agent: 'remind', writer });
        return;
      }

      const delivered: RemindTerminalDeliveredEvent = {
        kind: 'terminal-delivered',
        ...commonEventFields({
          eventId: `${replyId}:terminal:delivered`,
          deliveryId: signalId,
          parentAgentId: this.options.parentAgentId,
          parentThreadId: this.options.parentThreadId,
          resourceId: this.options.resourceId,
          createdAt: await nextProtocolCreatedAt(this.options.memory, this.options.threadId, this.options.resourceId),
        }),
        replyId,
        outcome: terminalOutcome,
      };
      try {
        await saveProtocolMessage(this.options.memory, {
          event: delivered,
          threadId: this.options.threadId,
          resourceId: this.options.resourceId,
          text: `Terminal reply delivered for ${replyId}.`,
        });
      } catch (error) {
        await publishSubconsciousError({
          error: `remind: terminal reply ${replyId} was accepted, but its delivered marker failed: ${errorText(error)}`,
          agent: 'remind',
          writer,
        });
      }
      return;
    }
  }
}
