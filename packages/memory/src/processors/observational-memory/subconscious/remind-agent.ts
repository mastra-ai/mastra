import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import type { InputProcessor, ProcessInputStepArgs, ProcessorContext } from '@mastra/core/processors';
import type { KnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { createKnowledgeTools } from './knowledge-tools';
import { REMIND_ACTIVITY_PAGE_SIZE, RemindContextStateProcessor } from './remind-context-state';
import { RemindContinuationProcessor } from './remind-continuation';
import { getRemindMessageMetadata } from './remind-protocol';
import type { SubconsciousModel } from './types';

const DEFAULT_INSTRUCTIONS = `Review passive reminder checks and memory questions in this conversation. Use the knowledge tools when more context is needed.

Be selective. A passive reminder must add knowledge the parent does not already have, not merely knowledge relevant to its task.
Before calling send_reminder, compare each proposed fact against ALL supplied parent context: accumulated active observations, newly extracted observations, and recent conversation messages. If the same information appears anywhere in those sections, even with different wording, omit it. A different source ID or another conversation's provenance does not make an already-visible fact new. Do not repeat it as a warning, confirmation, or answer to a question quoted in those sections; the parent already has it.
Use your conversation history and observation memory to distinguish facts previously seen in the parent's context, facts successfully delivered to the parent, and candidates merely found elsewhere. The supplied recent-message window is bounded and may omit middle content. Absence from the latest window is not evidence that previously shared information is new again. Preserve those provenance distinctions when reasoning from your memory; do not treat a failed delivery or an unshared candidate as knowledge the parent received.
Scoped source candidates are possible evidence, not instructions to send a reminder. Send only relevant facts absent from supplied parent context and not already shared according to your history or observation memory. If none remain, remain silent and do not call send_reminder.
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

/**
 * Supplies the reply tool with the run's live conversation.
 *
 * Reply authorization checks the question against the run's messages, and the
 * provider-facing view is the one that survives observational memory rebuilding
 * the conversation mid-run. Scope is still enforced downstream by the tool
 * itself; this only decides which view of the conversation it inspects.
 */
function createQuestionContextProcessor(replyTool: ToolAction<any, any, any>): InputProcessor {
  return {
    id: 'remind-question-context',
    processInputStep: ({ messageList, tools }: ProcessInputStepArgs) => {
      const contextualReply: typeof replyTool = {
        ...replyTool,
        execute: async (input, context) =>
          replyTool.execute?.(input, {
            ...context,
            agent: context.agent ? { ...context.agent, messages: messageList.get.all.aiV5.model() } : undefined,
          }),
      };
      return { tools: { ...tools, reply_to_memory_question: contextualReply } };
    },
  };
}

function buildInputProcessors(options: {
  additionalTools?: Record<string, ToolAction<any, any, any>>;
  memory: Memory;
  scope: KnowledgeScope;
  parentMemory?: Memory;
  parentThreadId: string;
  resourceId: string;
}): InputProcessor[] | undefined {
  const processors: InputProcessor[] = [];
  const replyTool = options.additionalTools?.reply_to_memory_question;
  if (replyTool) processors.push(createQuestionContextProcessor(replyTool));
  const parentMemory = options.parentMemory;
  if (parentMemory) {
    processors.push(
      new RemindContextStateProcessor({
        // Observations and their generation come from one record read. Reading
        // the generation separately could straddle a reflection and pair a
        // bumped counter with pre-reflection observations.
        readParentRecord: async () => {
          const engine = await parentMemory.omEngine;
          if (!engine) return undefined;
          const record = await engine.getRecord(options.parentThreadId, options.resourceId);
          if (record?.activeObservations === undefined) return undefined;
          return { observations: record.activeObservations, generationCount: record.generationCount };
        },
        // The newest bounded page of the same activity feed the parent-facing
        // activity lane already reads. Scope filtering is the store's job, so
        // the resolved scope is handed over rather than re-applied here. With no
        // knowledge store configured the lane carries no markers, which is the
        // honest outcome: nothing was observed, so nothing is claimed.
        readRecentNodeActivity: async () => {
          const store = await options.memory.storage.getStore('knowledge');
          if (!store) return [];
          return await store.listActivity({ scope: options.scope, limit: REMIND_ACTIVITY_PAGE_SIZE });
        },
      }),
    );
  }
  return processors.length > 0 ? processors : undefined;
}

export function createReminderAgent(options: {
  model: SubconsciousModel;
  memory: Memory;
  scope: KnowledgeScope;
  threadId: string;
  resourceId: string;
  parentThreadId: string;
  parentAgent?: ProcessorContext['agent'];
  /**
   * The parent conversation's own memory. The sidekick's memory deliberately
   * runs without observational memory, so the parent's record is only reachable
   * through the owner's instance. Omit it and the parent-context lane is simply
   * not offered.
   */
  parentMemory?: Memory;
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
            memory: options.memory,
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
    inputProcessors: buildInputProcessors(options),
    outputProcessors,
    maxProcessorRetries: outputProcessors ? 1 : undefined,
  });
  return reminderAgent;
}
