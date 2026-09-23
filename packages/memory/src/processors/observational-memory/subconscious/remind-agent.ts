import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import type { ProcessorContext } from '@mastra/core/processors';
import type { KnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { createKnowledgeTools } from './knowledge-tools';
import { RemindContinuationProcessor } from './remind-continuation';
import { getRemindMessageMetadata } from './remind-protocol';
import type { SubconsciousModel } from './types';

const DEFAULT_INSTRUCTIONS = `Review passive reminder checks and memory questions in this conversation. Use the knowledge tools when more context is needed.

Be selective. Never repeat knowledge already visible in the current observations or recent messages. If nothing is relevant to a passive check, remain silent.
For a useful grounded passive reminder, call send_reminder with its event ID, a concise reminder, and up to five candidate source IDs. Prose without the tool is not delivered.
For a memory question, call reply_to_memory_question with its reply ID. Use moreComing=true only for genuine progress and moreComing=false for the final answer.`;

type SendSignal = NonNullable<ProcessorContext['sendSignal']>;

type ReminderToolContext = {
  agent?: { messages?: unknown; threadId?: string; resourceId?: string };
};

function messageText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  const parts = Array.isArray(content)
    ? content
    : Array.isArray((content as { parts?: unknown } | undefined)?.parts)
      ? (content as { parts: unknown[] }).parts
      : [];
  return parts
    .filter((part): part is { type: 'text'; text: string } => {
      return (
        !!part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string'
      );
    })
    .map(part => part.text)
    .join('\n');
}

function wasReminderDelivered(messages: unknown, eventId: string, threadId: string, resourceId: string): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(message => {
    if (!message || typeof message !== 'object') return false;
    const dbMessage = message as MastraDBMessage;
    const content = (message as { content?: unknown }).content;
    const isStoredMessage = !!content && typeof content === 'object' && !Array.isArray(content) && 'format' in content;
    if (isStoredMessage && (dbMessage.threadId !== threadId || dbMessage.resourceId !== resourceId)) return false;
    const parts = Array.isArray((content as { parts?: unknown } | undefined)?.parts)
      ? (content as MastraDBMessage['content']).parts
      : [];
    return parts.some(part => {
      if (part.type !== 'tool-invocation') return false;
      const invocation = part.toolInvocation;
      if (invocation.toolName !== 'send_reminder' || invocation.state !== 'result') return false;
      const result = invocation.result as { delivered?: unknown; eventId?: unknown } | undefined;
      return result?.delivered === true && result.eventId === eventId;
    });
  });
}

function passiveCheck(
  messages: unknown,
  eventId: string,
  threadId: string,
  resourceId: string,
): Extract<ReturnType<typeof getRemindMessageMetadata>, { type: 'passive-check' }> | undefined {
  if (!Array.isArray(messages)) return undefined;
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const dbMessage = message as MastraDBMessage;
    const content = (message as { content?: unknown }).content;
    const isStoredMessage = !!content && typeof content === 'object' && !Array.isArray(content) && 'format' in content;
    if (isStoredMessage && (dbMessage.threadId !== threadId || dbMessage.resourceId !== resourceId)) continue;
    const metadata = getRemindMessageMetadata(dbMessage);
    if (metadata?.type === 'passive-check' && metadata.eventId === eventId) return metadata;
    if (dbMessage.role !== 'user') continue;

    const text = messageText(message);
    if (!text.startsWith(`Passive reminder check ${eventId}\n`)) continue;
    const serializedSources = text.match(/Scoped source candidates:\n([^\n]+)/)?.[1];
    if (!serializedSources) continue;
    try {
      const sources = JSON.parse(serializedSources) as Array<{ id?: unknown; recordId?: unknown }>;
      const candidateIds = [
        ...new Set(
          sources.flatMap(source => [source.id, source.recordId]).filter((id): id is string => typeof id === 'string'),
        ),
      ];
      return { type: 'passive-check', eventId, candidateIds };
    } catch {
      continue;
    }
  }
  return undefined;
}

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
  instructions?: string;
  maxSteps?: number;
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
    execute: async (input, rawContext) => {
      const { eventId, reminder, sourceIds } = input as {
        eventId: string;
        reminder: string;
        sourceIds: string[];
      };
      const context = rawContext as ReminderToolContext;
      const messages = context.agent?.messages;
      if (context.agent?.threadId !== options.threadId || context.agent.resourceId !== options.resourceId) {
        return { delivered: false, reason: 'wrong-conversation' };
      }
      const check = passiveCheck(messages, eventId, options.threadId, options.resourceId);
      if (!check || sourceIds.some(sourceId => !check.candidateIds.includes(sourceId))) {
        return { delivered: false, reason: 'ungrounded' };
      }
      if (
        deliveredEvents.has(eventId) ||
        wasReminderDelivered(messages, eventId, options.threadId, options.resourceId)
      ) {
        return { delivered: false, reason: 'already-delivered', eventId };
      }

      const signalId = `subconscious:remind:${eventId}:remembered`;
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
        if (typeof options.parentAgent?.sendSignal === 'function') {
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
        }
        deliveredEvents.add(eventId);
        return { delivered: true, eventId };
      } catch (error) {
        deliveredEvents.delete(eventId);
        throw error;
      }
    },
  });

  let reminderAgent: Agent;
  const outputProcessors =
    options.parentAgent && options.additionalTools?.reply_to_memory_question
      ? [
          new RemindContinuationProcessor({
            threadId: options.threadId,
            resourceId: options.resourceId,
            parentThreadId: options.parentThreadId,
            parentAgent: options.parentAgent,
            maxSteps: options.maxSteps ?? 50,
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
    mastra: options.parentAgent?.getMastraInstance?.(),
    pubsub: options.parentAgent?.getPubSub?.(),
    tools: {
      ...createKnowledgeTools(options.memory, options.scope),
      ...options.additionalTools,
      send_reminder: sendReminder,
    },
    outputProcessors,
    maxProcessorRetries: outputProcessors ? 1 : undefined,
  });
  return reminderAgent;
}
