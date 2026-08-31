import { Agent } from '@mastra/core/agent';
import type { ProcessorContext } from '@mastra/core/processors';
import type { KnowledgeScope } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { createKnowledgeTools } from './knowledge-tools';
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
  instructions?: string;
}) {
  const deliveredEvents = new Set<string>();
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
      if (deliveredEvents.has(eventId)) return { delivered: false, reason: 'already-delivered' };

      const store = await options.memory.storage.getStore('memory');
      const stored = await store?.listMessagesById({ messageIds: [eventId] });
      const eventMessage = stored?.messages.find(message => message.id === eventId);
      const protocol = eventMessage && getRemindProtocol(eventMessage);
      if (
        !eventMessage ||
        eventMessage.threadId !== options.threadId ||
        eventMessage.resourceId !== options.resourceId ||
        protocol?.parentThreadId !== options.parentThreadId ||
        protocol.resourceId !== options.resourceId ||
        sourceIds.some(sourceId => !protocol.candidateIds.includes(sourceId))
      ) {
        return { delivered: false, reason: 'ungrounded' };
      }

      deliveredEvents.add(eventId);
      const contents = `${reminder.trim()}\n\nSources: ${sourceIds.join(', ')}`;
      const signal = {
        id: `subconscious:remind:${eventId}:remembered`,
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
          const result = options.parentAgent.sendSignal(signal, {
            resourceId: options.resourceId,
            threadId: options.parentThreadId,
            ifActive: { behavior: 'deliver' },
            ifIdle: { behavior: 'persist' },
          });
          const accepted = await result.accepted;
          if (accepted.action === 'blocked' || accepted.action === 'discard') {
            deliveredEvents.delete(eventId);
            return { delivered: false, reason: accepted.action };
          }
        } else {
          await options.fallbackSendSignal(signal);
        }
        return { delivered: true };
      } catch (error) {
        deliveredEvents.delete(eventId);
        throw error;
      }
    },
  });

  return new Agent({
    id: `subconscious-remind-${options.parentThreadId}`,
    name: 'Subconscious Remind',
    instructions: [DEFAULT_INSTRUCTIONS, options.instructions?.trim()].filter(Boolean).join('\n\n'),
    model: options.model,
    memory: options.memory,
    mastra: options.parentAgent?.getMastraInstance(),
    pubsub: options.parentAgent?.getPubSub(),
    tools: {
      ...createKnowledgeTools(options.memory, options.scope),
      send_reminder: sendReminder,
    },
    inputProcessors: [new RemindEventReferenceProcessor(options.memory, options.threadId, options.resourceId)],
  });
}
