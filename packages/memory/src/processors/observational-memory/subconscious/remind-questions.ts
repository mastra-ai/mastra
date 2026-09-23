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
  getRemindMessageMetadata,
  getRemindThreadId,
  REMIND_MESSAGE_METADATA_KEY,
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
  | { accepted: false; replyId?: string; status: 'rejected'; error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function consumeWakeOutput(output: { consumeStream(): Promise<unknown> }, writer?: ProcessorStreamWriter): void {
  void output.consumeStream().catch(async error => {
    await publishSubconsciousError({ error: `remind: ${errorText(error)}`, agent: 'remind', writer });
  });
}

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

function inScopeMessage(message: unknown, threadId: string, resourceId: string): MastraDBMessage | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const dbMessage = message as MastraDBMessage;
  const content = (message as { content?: unknown }).content;
  const isStoredMessage = !!content && typeof content === 'object' && !Array.isArray(content) && 'format' in content;
  if (isStoredMessage && (dbMessage.threadId !== threadId || dbMessage.resourceId !== resourceId)) return undefined;
  return dbMessage;
}

function messageParts(message: MastraDBMessage): MastraDBMessage['content']['parts'] {
  const content = message.content as unknown;
  if (Array.isArray(content)) return content as MastraDBMessage['content']['parts'];
  return Array.isArray((content as { parts?: unknown } | undefined)?.parts)
    ? (content as MastraDBMessage['content']).parts
    : [];
}

function trustedQuestion(messages: unknown, replyId: string, threadId: string, resourceId: string): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(message => {
    const dbMessage = inScopeMessage(message, threadId, resourceId);
    if (!dbMessage) return false;
    const metadata = getRemindMessageMetadata(dbMessage);
    if (metadata?.type === 'question' && metadata.replyId === replyId) return true;
    return dbMessage.role === 'user' && messageText(message).startsWith(`Memory question ${replyId}\n`);
  });
}

function hasTerminalReply(messages: unknown, replyId: string, threadId: string, resourceId: string): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(message => {
    const dbMessage = inScopeMessage(message, threadId, resourceId);
    if (!dbMessage) return false;
    return messageParts(dbMessage).some(part => {
      if (part.type !== 'tool-invocation') return false;
      const invocation = part.toolInvocation;
      if (invocation.toolName !== 'reply_to_memory_question' || invocation.state !== 'result') return false;
      const result = invocation.result as { delivered?: unknown; replyId?: unknown; moreComing?: unknown } | undefined;
      return result?.delivered === true && result.replyId === replyId && result.moreComing === false;
    });
  });
}

async function persistParentSignal(
  parentAgent: Agent,
  signal: Parameters<Agent['sendSignal']>[0],
  options: {
    parentThreadId: string;
    resourceId: string;
  },
) {
  const result = parentAgent.sendSignal(signal, {
    resourceId: options.resourceId,
    threadId: options.parentThreadId,
    ifActive: { behavior: 'persist' },
    ifIdle: { behavior: 'persist' },
  });
  const accepted = await result.accepted;
  if (accepted.action !== 'persist') throw new Error(`Reminder reply was not persisted (${accepted.action}).`);
  await result.persisted;

  const delivery = parentAgent.sendSignal(signal, {
    resourceId: options.resourceId,
    threadId: options.parentThreadId,
    ifActive: { behavior: 'deliver' },
    ifIdle: { behavior: 'discard' },
  });
  const delivered = await delivery.accepted;
  if (delivered.action === 'blocked') throw new Error('Reminder reply delivery was blocked.');
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
      'Ask the reminder sidekick a memory question. Returns immediately after the sidekick accepts the question; the answer arrives later as a correlated signal.',
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

      const replyId = `subconscious:remind:${crypto.randomUUID()}:reply`;
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
            replyId,
            status: 'rejected',
            error: 'ask_memory requires a usable reminder model.',
          } satisfies AskMemoryResult;
        }

        const reminderMemory = options.memory.createSubconsciousMemory();
        const reminderThread = await ensureOwnedRemindThread({ memory: reminderMemory, parentThreadId, resourceId });
        const replyTool = createReplyToMemoryQuestionTool({
          parentAgent,
          parentThreadId,
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
          maxSteps: options.config.maxSteps,
        });
        const delivery = reminderAgent.sendMessage(
          {
            contents: `Memory question ${replyId}\n\n${question}`,
            metadata: {
              [REMIND_MESSAGE_METADATA_KEY]: { type: 'question', replyId, askedAt: Date.now() },
            },
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
        return { accepted: false, replyId, status: 'rejected', error: message } satisfies AskMemoryResult;
      }
    },
  });
}

export function createReplyToMemoryQuestionTool(options: {
  parentAgent: Agent;
  parentThreadId: string;
  resourceId: string;
}): ToolAction<any, any, any> {
  const deliveredSignalIds = new Set<string>();
  return createTool({
    id: 'reply_to_memory_question',
    description:
      'Reply to a memory question from the current reminder conversation. Use moreComing=true for progress, or false for the final answer.',
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
        outcome?: 'answer' | 'unable-to-answer' | 'error';
      };
      const messages = context.agent?.messages;
      const reminderThreadId = getRemindThreadId(options.parentThreadId);
      if (
        context.agent?.threadId !== reminderThreadId ||
        context.agent.resourceId !== options.resourceId ||
        !trustedQuestion(messages, replyId, reminderThreadId, options.resourceId)
      ) {
        return { delivered: false, replyId, reason: 'question-not-in-current-conversation' };
      }
      if (!moreComing && hasTerminalReply(messages, replyId, reminderThreadId, options.resourceId)) {
        return { delivered: false, replyId, reason: 'already-terminal' };
      }

      const trimmedAnswer = answer.trim();
      const suffix = moreComing
        ? `partial:${crypto.createHash('sha256').update(trimmedAnswer).digest('hex').slice(0, 12)}`
        : 'terminal';
      const signalId = `${replyId}:${suffix}:signal`;
      if (deliveredSignalIds.has(signalId)) return { delivered: true, replyId, moreComing, outcome };
      const signal = {
        id: signalId,
        type: 'reactive' as const,
        tagName: 'remind-answer',
        contents: trimmedAnswer,
        createdAt: new Date(),
        metadata: { origin: 'subconscious' },
        attributes: {
          source: 'subconscious',
          agent: 'remind',
          replyId,
          moreComing: String(moreComing),
          outcome,
        },
      };
      try {
        await persistParentSignal(options.parentAgent, signal, options);
        deliveredSignalIds.add(signalId);
        return { delivered: true, replyId, moreComing, outcome };
      } catch (error) {
        deliveredSignalIds.delete(signalId);
        await publishSubconsciousError({
          error: `remind: ${errorText(error)}`,
          agent: 'remind',
          writer: context.writer,
        });
        return { delivered: false, replyId, reason: 'delivery-failed', error: errorText(error) };
      }
    },
  });
}
