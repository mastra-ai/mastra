import { Agent } from '@mastra/core/agent';
import type { ProcessorContext } from '@mastra/core/processors';
import type { KnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { createKnowledgeTools } from './knowledge-tools';
import { RemindContinuationProcessor } from './remind-continuation';
import { getRemindProtocol, RemindEventReferenceProcessor } from './remind-protocol';
import type { SubconsciousModel } from './types';

const DEFAULT_INSTRUCTIONS = `Review each passive reminder check in this conversation and use the knowledge tools when more context is needed.

Be selective. Never repeat knowledge already visible in the current observations or recent messages. If nothing is relevant, remain silent.
When a grounded reminder is useful, you must call send_reminder with the passive-check event ID, a concise reminder, and up to five source IDs from that event's scoped candidates. Prose without the tool is not delivered.`;

type SendSignal = NonNullable<ProcessorContext['sendSignal']>;

export function createReminderAgent(options: {
  model: SubconsciousModel;
  memory: Memory;
  scope: KnowledgeScope;
  threadId: string;
  resourceId: string;
  parentThreadId: string;
  parentAgent?: ProcessorContext['agent'];
  fallbackSendSignal: SendSignal;
  additionalTools?: Record<string, ToolAction<any, any, any>>;
  acceptedTerminalSignals?: Set<string>;
  instructions?: string;
  maxSteps?: number;
}) {
  const fallbackDeliveredEvents = new Set<string>();
  const sendReminder = createTool({
    id: 'send_reminder',
    description: 'Deliver one grounded reminder to the parent conversation for a passive reminder check.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', minLength: 1 },
        reminder: { type: 'string', minLength: 1 },
        sourceIds: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          maxItems: 5,
          uniqueItems: true,
        },
      },
      required: ['eventId', 'reminder', 'sourceIds'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async input => {
      const { eventId, reminder, sourceIds } = input as {
        eventId: string;
        reminder: string;
        sourceIds: string[];
      };
      const signalId = `subconscious:remind:${eventId}:remembered`;
      if (fallbackDeliveredEvents.has(eventId)) return { delivered: false, reason: 'already-delivered' };

      const store = await options.memory.storage.getStore('memory');
      const stored = await store?.listMessagesById({ messageIds: [eventId, signalId] });
      const eventMessage = stored?.messages.find(message => message.id === eventId);
      const deliveredSignal = stored?.messages.find(
        message =>
          message.id === signalId &&
          message.role === 'signal' &&
          message.threadId === options.parentThreadId &&
          message.resourceId === options.resourceId,
      );
      if (deliveredSignal) return { delivered: false, reason: 'already-delivered' };
      const protocol = eventMessage && getRemindProtocol(eventMessage);
      if (
        !eventMessage ||
        eventMessage.threadId !== options.threadId ||
        eventMessage.resourceId !== options.resourceId ||
        protocol?.kind !== 'passive-check' ||
        protocol.parentThreadId !== options.parentThreadId ||
        protocol.resourceId !== options.resourceId ||
        sourceIds.some(sourceId => !protocol.candidateIds.includes(sourceId))
      ) {
        return { delivered: false, reason: 'ungrounded' };
      }

      const contents = `${reminder.trim()}\n\nSources: ${sourceIds.join(', ')}`;
      const signal = {
        id: signalId,
        type: 'reactive' as const,
        tagName: 'remembered',
        contents,
        createdAt: new Date(),
        metadata: { origin: 'subconscious' },
        attributes: {
          source: 'subconscious',
          sourceIds: sourceIds.join(','),
          agent: 'remind',
          threadId: options.parentThreadId,
        },
      };
      try {
        if (options.parentAgent) {
          const persisted = options.parentAgent.sendSignal(signal, {
            resourceId: options.resourceId,
            threadId: options.parentThreadId,
            ifActive: { behavior: 'persist' },
            ifIdle: { behavior: 'persist' },
          });
          const persistenceAccepted = await persisted.accepted;
          if (persistenceAccepted.action !== 'persist') {
            return { delivered: false, reason: persistenceAccepted.action };
          }
          await persisted.persisted;

          const activeDelivery = options.parentAgent.sendSignal(signal, {
            resourceId: options.resourceId,
            threadId: options.parentThreadId,
            ifActive: { behavior: 'deliver' },
            ifIdle: { behavior: 'discard' },
          });
          const deliveryAccepted = await activeDelivery.accepted;
          if (deliveryAccepted.action === 'blocked') return { delivered: false, reason: deliveryAccepted.action };
        } else {
          await options.fallbackSendSignal(signal);
          fallbackDeliveredEvents.add(eventId);
        }
        return { delivered: true };
      } catch (error) {
        fallbackDeliveredEvents.delete(eventId);
        throw error;
      }
    },
  });

  let reminderAgent: Agent;
  const outputProcessors =
    options.parentAgent && options.additionalTools?.reply_to_memory_question
      ? [
          new RemindContinuationProcessor({
            memory: options.memory,
            threadId: options.threadId,
            resourceId: options.resourceId,
            parentThreadId: options.parentThreadId,
            parentAgent: options.parentAgent,
            parentAgentId: options.parentAgent.id,
            maxSteps: options.maxSteps ?? 50,
            acceptedTerminalSignals: options.acceptedTerminalSignals,
            getReminderAgent: () => reminderAgent,
          }),
        ]
      : undefined;
  reminderAgent = new Agent({
    id: `subconscious-remind-${options.parentThreadId}`,
    name: 'Subconscious Remind',
    instructions: [DEFAULT_INSTRUCTIONS, options.instructions?.trim()].filter(Boolean).join('\n\n'),
    model: options.model,
    memory: options.memory,
    mastra: options.parentAgent?.getMastraInstance(),
    pubsub: options.parentAgent?.getPubSub(),
    tools: {
      ...createKnowledgeTools(options.memory, options.scope),
      ...options.additionalTools,
      send_reminder: sendReminder,
    },
    inputProcessors: [
      new RemindEventReferenceProcessor(
        options.memory,
        options.threadId,
        options.resourceId,
        options.additionalTools?.reply_to_memory_question ? 'reply_to_memory_question' : undefined,
        options.parentAgent?.id,
      ),
    ],
    outputProcessors,
    maxProcessorRetries: outputProcessors ? 1 : undefined,
  });
  return reminderAgent;
}
