import crypto from 'node:crypto';

import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { withOmInternalThreadId } from '../internal-request-context';
import type { ObservationalMemoryModel } from '../types';
import { publishSubconsciousError } from './activity';
import { resolveKnowledgeToolScope } from './knowledge-tools';
import { resolveSubconsciousAgentModel } from './model';
import { createReminderAgent } from './remind-agent';
import {
  ensureOwnedRemindThread,
  getRemindMessageText,
  getRemindProtocol,
  REMIND_DELIVERY_METADATA_KEY,
  REMIND_PROTOCOL_METADATA_KEY,
} from './remind-protocol';
import type {
  RemindDeliveryFailureEvent,
  RemindPartialReplyEvent,
  RemindPassiveCheckEvent,
  RemindProtocolEvent,
  RemindQuestionEvent,
  RemindRoutingFailureEvent,
  RemindTerminalDeliveredEvent,
  RemindTerminalOutcome,
  RemindTerminalPendingEvent,
} from './remind-protocol';
import type { ResolvedSubconsciousAgent } from './types';

type AskMemoryToolContext = {
  agent?: {
    agentId?: string;
    threadId?: string;
    resourceId?: string;
    messages?: unknown;
  };
  requestContext?: Parameters<typeof withOmInternalThreadId>[0];
  writer?: ProcessorStreamWriter;
};

type ReplyMemoryToolContext = Pick<AskMemoryToolContext, 'agent' | 'writer'>;

export type AskMemoryResult =
  | { accepted: true; replyId: string; status: 'pending' }
  | { accepted: false; replyId?: string; status: 'rejected' | 'delivery_unknown'; error: string };

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

async function listProtocolEvents(memory: Memory, threadId: string, resourceId: string) {
  const store = await memory.storage.getStore('memory');
  const result = await store?.listMessages({
    threadId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return (result?.messages ?? []).flatMap(message => {
    const event = getRemindProtocol(message);
    return event ? [{ event, message }] : [];
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function collectText(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const nested of Object.values(value as Record<string, unknown>)) collectText(nested, output);
}

function trustedInputContainsQuestion(messages: unknown, questionMessage: MastraDBMessage): boolean {
  const texts: string[] = [];
  collectText(messages, texts);
  const questionText = getRemindMessageText(questionMessage);
  return texts.some(text => text.includes(questionMessage.id) || text.includes(questionText));
}

function consumeWakeOutput(output: { consumeStream(): Promise<unknown> }, writer?: ProcessorStreamWriter): void {
  void output.consumeStream().catch(async error => {
    await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer });
  });
}

function commonEventFields(options: {
  eventId: string;
  deliveryId: string;
  parentAgentId: string;
  parentThreadId: string;
  resourceId: string;
  createdAt?: number;
}) {
  return { ...options, createdAt: options.createdAt ?? Date.now() };
}

export function createAskMemoryTool(options: {
  memory: Memory;
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
  getParentAgent(agentId: string): Agent | undefined;
}): ToolAction<any, any, any> {
  return createTool({
    id: 'ask_memory',
    description:
      'Ask the durable reminder sidekick a memory question. Returns immediately after durable acceptance; the answer arrives later as a correlated signal.',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', minLength: 1 } },
      required: ['question'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const context = rawContext as AskMemoryToolContext;
      const question = (input as { question: string }).question.trim();
      const parentAgentId = context.agent?.agentId;
      const parentThreadId = context.agent?.threadId;
      const resourceId = context.agent?.resourceId;
      if (!question || !parentAgentId || !parentThreadId || !resourceId) {
        return {
          accepted: false,
          status: 'rejected',
          error: 'ask_memory requires a calling agent, threadId, resourceId, and non-empty question.',
        } satisfies AskMemoryResult;
      }

      const parentAgent = options.getParentAgent(parentAgentId);
      if (!parentAgent) {
        return {
          accepted: false,
          status: 'rejected',
          error: `ask_memory could not resolve calling agent ${parentAgentId} from the registered runtime.`,
        } satisfies AskMemoryResult;
      }

      let replyId: string | undefined;
      let questionSaved = false;
      try {
        const scope = resolveKnowledgeToolScope(context);
        const model = await resolveSubconsciousAgentModel({
          config: options.config,
          omModel: options.omModel,
          mainAgent: parentAgent,
          requestContext: context.requestContext,
        });
        if (!model) {
          return {
            accepted: false,
            status: 'rejected',
            error: 'ask_memory requires a usable reminder model.',
          } satisfies AskMemoryResult;
        }

        const reminderMemory = options.memory.createSubconsciousMemory();
        const reminderThread = await ensureOwnedRemindThread({
          memory: reminderMemory,
          parentThreadId,
          resourceId,
        });
        replyId = `subconscious:remind:${crypto.randomUUID()}:reply`;
        const eventId = `${replyId}:question`;
        const deliveryId = `${replyId}:question:delivery`;
        const event: RemindQuestionEvent = {
          kind: 'question',
          ...commonEventFields({ eventId, deliveryId, parentAgentId, parentThreadId, resourceId }),
          replyId,
          replyRequired: true,
        };
        await saveProtocolMessage(reminderMemory, {
          event,
          threadId: reminderThread.id,
          resourceId,
          text: `Memory question ${replyId}\n\n${question}`,
        });
        questionSaved = true;

        const replyTool = createReplyToMemoryQuestionTool({
          memory: reminderMemory,
          parentAgent,
          parentAgentId,
          parentThreadId,
          reminderThreadId: reminderThread.id,
          resourceId,
        });
        const reminderAgent = createReminderAgent({
          model,
          memory: reminderMemory,
          scope,
          threadId: reminderThread.id,
          resourceId,
          parentThreadId,
          parentAgent,
          fallbackSendSignal: async () => {
            throw new Error('The registered parent agent is required for reminder question replies.');
          },
          additionalTools: { reply_to_memory_question: replyTool },
          instructions: options.config.instructions,
        });
        const delivery = reminderAgent.sendMessage(
          {
            contents: `Resolve canonical reminder event ${eventId}.`,
            metadata: { [REMIND_DELIVERY_METADATA_KEY]: { eventId, deliveryId } },
          },
          {
            resourceId,
            threadId: reminderThread.id,
            ifActive: { behavior: 'deliver' },
            ifIdle: {
              behavior: 'wake',
              streamOptions: {
                memory: { thread: reminderThread.id, resource: resourceId },
                requestContext: withOmInternalThreadId(context.requestContext, reminderAgent.id),
                maxSteps: options.config.maxSteps,
              },
            },
          },
        );
        const accepted = await delivery.accepted;
        if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
          throw new Error(`Reminder question ${replyId} was not accepted for processing (${accepted.action}).`);
        }
        if (accepted.action === 'wake') consumeWakeOutput(accepted.output, context.writer);
        return { accepted: true, replyId, status: 'pending' } satisfies AskMemoryResult;
      } catch (error) {
        const message = errorText(error);
        await publishSubconsciousError({ error: `remind: ${message}`, agent: 'remind', writer: context.writer });
        if (!replyId || !questionSaved) {
          return { accepted: false, replyId, status: 'rejected', error: message } satisfies AskMemoryResult;
        }

        const event: RemindRoutingFailureEvent = {
          kind: 'routing-failure',
          ...commonEventFields({
            eventId: `${replyId}:routing-failure`,
            deliveryId: `${replyId}:routing-failure:delivery`,
            parentAgentId,
            parentThreadId,
            resourceId,
          }),
          replyId,
          error: message,
        };
        try {
          await saveProtocolMessage(options.memory, {
            event,
            threadId: `subconscious:${parentThreadId}:remind`,
            resourceId,
            text: `Memory question ${replyId} could not be routed: ${message}`,
          });
          return { accepted: false, replyId, status: 'rejected', error: message } satisfies AskMemoryResult;
        } catch (persistenceError) {
          const ambiguous = `${message}; routing-failure persistence also failed: ${errorText(persistenceError)}`;
          await publishSubconsciousError({ error: `remind: ${ambiguous}`, agent: 'remind', writer: context.writer });
          return {
            accepted: false,
            replyId,
            status: 'delivery_unknown',
            error: ambiguous,
          } satisfies AskMemoryResult;
        }
      }
    },
  });
}

export function createReplyToMemoryQuestionTool(options: {
  memory: Memory;
  parentAgent: Agent;
  parentAgentId: string;
  parentThreadId: string;
  reminderThreadId: string;
  resourceId: string;
}): ToolAction<any, any, any> {
  const attemptedTerminalSignals = new Set<string>();

  return createTool({
    id: 'reply_to_memory_question',
    description:
      'Reply to a trusted memory question. Use moreComing=true for incremental progress, or false for the single terminal answer.',
    inputSchema: {
      type: 'object',
      properties: {
        replyId: { type: 'string', minLength: 1 },
        answer: { type: 'string', minLength: 1 },
        moreComing: { type: 'boolean' },
        outcome: { type: 'string', enum: ['answer', 'unable-to-answer', 'error'] },
      },
      required: ['replyId', 'answer', 'moreComing'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const context = rawContext as ReplyMemoryToolContext;
      const {
        replyId,
        answer,
        moreComing,
        outcome = 'answer',
      } = input as {
        replyId: string;
        answer: string;
        moreComing: boolean;
        outcome?: RemindTerminalOutcome;
      };
      const entries = await listProtocolEvents(options.memory, options.reminderThreadId, options.resourceId);
      const questionEntry = entries.find(
        entry =>
          entry.event.kind === 'question' &&
          entry.event.replyId === replyId &&
          entry.event.parentAgentId === options.parentAgentId &&
          entry.event.parentThreadId === options.parentThreadId &&
          entry.event.resourceId === options.resourceId,
      );
      if (!questionEntry || !trustedInputContainsQuestion(context.agent?.messages, questionEntry.message)) {
        return { delivered: false, reason: 'untrusted-or-unknown-reply-id' };
      }

      const replyEvents = entries
        .map(entry => entry.event)
        .filter((event): event is Exclude<RemindProtocolEvent, RemindPassiveCheckEvent | RemindQuestionEvent> =>
          'replyId' in event ? event.replyId === replyId : false,
        );
      const delivered = replyEvents.some(event => event.kind === 'terminal-delivered');
      const exhausted = replyEvents.some(event => event.kind === 'delivery-failure' && event.exhausted);
      if (delivered || exhausted) return { delivered: false, reason: 'already-terminal' };

      if (moreComing) {
        const sequence =
          Math.max(0, ...replyEvents.filter(event => event.kind === 'partial-reply').map(event => event.sequence)) + 1;
        const eventId = `${replyId}:partial:${sequence}`;
        const event: RemindPartialReplyEvent = {
          kind: 'partial-reply',
          ...commonEventFields({
            eventId,
            deliveryId: `${eventId}:delivery`,
            parentAgentId: options.parentAgentId,
            parentThreadId: options.parentThreadId,
            resourceId: options.resourceId,
          }),
          replyId,
          sequence,
          moreComing: true,
        };
        await saveProtocolMessage(options.memory, {
          event,
          threadId: options.reminderThreadId,
          resourceId: options.resourceId,
          text: `Partial reply ${sequence} for ${replyId}\n\n${answer}`,
        });
        const signalId = `${replyId}:partial:${sequence}:signal`;
        try {
          const result = options.parentAgent.sendSignal(
            {
              id: signalId,
              type: 'reactive',
              tagName: 'memory-reply',
              contents: answer,
              attributes: { replyId, sequence, moreComing: true },
              metadata: { origin: 'subconscious', replyId, sequence, moreComing: true },
            },
            {
              threadId: options.parentThreadId,
              resourceId: options.resourceId,
              ifActive: { behavior: 'deliver' },
              ifIdle: { behavior: 'persist' },
            },
          );
          const accepted = await result.accepted;
          if (accepted.action === 'blocked' || accepted.action === 'discard') {
            throw new Error(`Partial reply delivery was not accepted (${accepted.action}).`);
          }
          return { delivered: true, replyId, sequence, moreComing: true };
        } catch (error) {
          const failure: RemindDeliveryFailureEvent = {
            kind: 'delivery-failure',
            ...commonEventFields({
              eventId: `${replyId}:delivery-failure:partial:${sequence}`,
              deliveryId: signalId,
              parentAgentId: options.parentAgentId,
              parentThreadId: options.parentThreadId,
              resourceId: options.resourceId,
            }),
            replyId,
            deliveryKind: 'partial',
            attempt: 1,
            exhausted: false,
            error: errorText(error),
          };
          await saveProtocolMessage(options.memory, {
            event: failure,
            threadId: options.reminderThreadId,
            resourceId: options.resourceId,
            text: `Partial reply delivery failed for ${replyId}: ${failure.error}`,
          });
          return { delivered: false, reason: 'delivery-failed', replyId, sequence, moreComing: true };
        }
      }

      const signalId = `${replyId}:terminal:signal`;
      if (attemptedTerminalSignals.has(signalId))
        return { delivered: false, reason: 'terminal-delivery-already-attempted' };
      attemptedTerminalSignals.add(signalId);
      const existingPending = entries.find(
        entry => entry.event.kind === 'terminal-pending-delivery' && entry.event.replyId === replyId,
      );
      const persistedPendingText = existingPending ? getRemindMessageText(existingPending.message) : undefined;
      const answerToDeliver = persistedPendingText?.split('\n\n').slice(1).join('\n\n') || answer;
      const terminalOutcome =
        existingPending?.event.kind === 'terminal-pending-delivery' ? existingPending.event.outcome : outcome;
      const pending: RemindTerminalPendingEvent = {
        kind: 'terminal-pending-delivery',
        ...commonEventFields({
          eventId: `${replyId}:terminal:pending`,
          deliveryId: signalId,
          parentAgentId: options.parentAgentId,
          parentThreadId: options.parentThreadId,
          resourceId: options.resourceId,
        }),
        replyId,
        outcome: terminalOutcome,
      };
      if (!existingPending) {
        await saveProtocolMessage(options.memory, {
          event: pending,
          threadId: options.reminderThreadId,
          resourceId: options.resourceId,
          text: `Terminal reply pending delivery for ${replyId}\n\n${answer}`,
        });
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = options.parentAgent.sendSignal(
            {
              id: signalId,
              type: 'reactive',
              tagName: 'memory-reply',
              contents: answerToDeliver,
              attributes: { replyId, moreComing: false, outcome: terminalOutcome },
              metadata: { origin: 'subconscious', replyId, moreComing: false, outcome: terminalOutcome },
            },
            {
              threadId: options.parentThreadId,
              resourceId: options.resourceId,
              ifActive: { behavior: 'deliver' },
              ifIdle: { behavior: 'wake' },
            },
          );
          const accepted = await result.accepted;
          if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
            throw new Error(`Terminal reply delivery was not accepted (${accepted.action}).`);
          }
          if (accepted.action === 'wake') consumeWakeOutput(accepted.output, context.writer);
        } catch (error) {
          const failure: RemindDeliveryFailureEvent = {
            kind: 'delivery-failure',
            ...commonEventFields({
              eventId: `${replyId}:delivery-failure:terminal:${attempt}`,
              deliveryId: signalId,
              parentAgentId: options.parentAgentId,
              parentThreadId: options.parentThreadId,
              resourceId: options.resourceId,
            }),
            replyId,
            deliveryKind: 'terminal',
            attempt,
            exhausted: attempt === 2,
            error: errorText(error),
          };
          try {
            await saveProtocolMessage(options.memory, {
              event: failure,
              threadId: options.reminderThreadId,
              resourceId: options.resourceId,
              text: `Terminal reply delivery attempt ${attempt} failed for ${replyId}: ${failure.error}`,
            });
          } catch (persistenceError) {
            await publishSubconsciousError({
              error: `remind: ${failure.error}; delivery-failure persistence failed: ${errorText(persistenceError)}`,
              agent: 'remind',
              writer: context.writer,
            });
          }
          if (attempt === 2) {
            return {
              delivered: false,
              reason: 'delivery-exhausted',
              replyId,
              moreComing: false,
              outcome: terminalOutcome,
            };
          }
          continue;
        }

        const deliveredEvent: RemindTerminalDeliveredEvent = {
          kind: 'terminal-delivered',
          ...commonEventFields({
            eventId: `${replyId}:terminal:delivered`,
            deliveryId: signalId,
            parentAgentId: options.parentAgentId,
            parentThreadId: options.parentThreadId,
            resourceId: options.resourceId,
          }),
          replyId,
          outcome: terminalOutcome,
        };
        try {
          await saveProtocolMessage(options.memory, {
            event: deliveredEvent,
            threadId: options.reminderThreadId,
            resourceId: options.resourceId,
            text: `Terminal reply delivered for ${replyId}.`,
          });
          return { delivered: true, replyId, moreComing: false, outcome: terminalOutcome };
        } catch (persistenceError) {
          await publishSubconsciousError({
            error: `remind: terminal reply ${replyId} was accepted, but its delivered marker failed: ${errorText(persistenceError)}`,
            agent: 'remind',
            writer: context.writer,
          });
          return {
            delivered: false,
            reason: 'delivery-marker-unknown',
            replyId,
            moreComing: false,
            outcome: terminalOutcome,
          };
        }
      }
      return {
        delivered: false,
        reason: 'delivery-exhausted',
        replyId,
        moreComing: false,
        outcome: terminalOutcome,
      };
    },
  });
}
