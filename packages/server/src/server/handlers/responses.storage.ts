import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { ResponseObject, ResponseTextConfig, ResponseTool, ResponseUsage } from '../schemas/responses';
import { getEffectiveResourceId, validateThreadOwnership } from './utils';

export type ThreadExecutionContext = {
  threadId: string;
  resourceId: string;
};

export type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
} | null;

export type ProviderMetadataLike = Record<string, Record<string, unknown> | undefined> | undefined;

export type ResponseTurnRecordMetadata = {
  agentId: string;
  model: string;
  createdAt: number;
  completedAt: number | null;
  status: ResponseObject['status'];
  usage: ResponseUsage | null;
  instructions?: string;
  text?: ResponseTextConfig;
  previousResponseId?: string;
  providerOptions?: ProviderMetadataLike;
  tools: ResponseTool[];
  store: boolean;
  messageIds: string[];
};

export type ResponseTurnRecord = {
  metadata: ResponseTurnRecordMetadata;
  message: MastraDBMessage;
  messages: MastraDBMessage[];
  thread: StorageThreadType;
  memoryStore: MemoryStorage;
};

type ResponseResultLike = {
  response?:
    | Promise<{
        dbMessages?: MastraDBMessage[];
      }>
    | {
        dbMessages?: MastraDBMessage[];
      };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves the backing memory store for a specific agent.
 *
 * This follows the normal agent-memory path. `agent.getMemory()` injects Mastra
 * root storage when the memory has no own storage, so this naturally prefers
 * agent storage first and falls back to Mastra storage through the same codepath.
 */
export async function getAgentMemoryStore({
  agent,
  requestContext,
}: {
  agent: Agent<any, any, any, any>;
  requestContext: RequestContext;
}): Promise<MemoryStorage | null> {
  const memory = await agent.getMemory({ requestContext });
  if (!memory) {
    return null;
  }

  try {
    return (await memory.storage.getStore('memory')) ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads the response-turn record metadata attached to a stored assistant message.
 */
function readResponseTurnRecordMetadata(message: MastraDBMessage): ResponseTurnRecordMetadata | null {
  const mastraMetadata = isPlainObject(message.content?.metadata?.mastra) ? message.content.metadata.mastra : null;
  const responseMetadata = mastraMetadata && isPlainObject(mastraMetadata.response) ? mastraMetadata.response : null;

  if (
    !responseMetadata ||
    typeof responseMetadata.agentId !== 'string' ||
    typeof responseMetadata.model !== 'string' ||
    typeof responseMetadata.createdAt !== 'number' ||
    (responseMetadata.completedAt !== null && typeof responseMetadata.completedAt !== 'number') ||
    (responseMetadata.instructions !== undefined && typeof responseMetadata.instructions !== 'string') ||
    (responseMetadata.text !== undefined &&
      (!isPlainObject(responseMetadata.text) || !isPlainObject(responseMetadata.text.format))) ||
    (responseMetadata.previousResponseId !== undefined && typeof responseMetadata.previousResponseId !== 'string') ||
    !Array.isArray(responseMetadata.tools) ||
    typeof responseMetadata.store !== 'boolean' ||
    !Array.isArray(responseMetadata.messageIds)
  ) {
    return null;
  }

  return {
    agentId: responseMetadata.agentId,
    model: responseMetadata.model,
    createdAt: responseMetadata.createdAt,
    completedAt: responseMetadata.completedAt,
    status: responseMetadata.status === 'completed' ? 'completed' : 'incomplete',
    usage: responseMetadata.usage as ResponseUsage | null,
    instructions: responseMetadata.instructions,
    text: responseMetadata.text as ResponseTextConfig | undefined,
    previousResponseId: responseMetadata.previousResponseId,
    providerOptions: responseMetadata.providerOptions as ProviderMetadataLike,
    tools: responseMetadata.tools as ResponseTool[],
    store: responseMetadata.store,
    messageIds: responseMetadata.messageIds.filter((value): value is string => typeof value === 'string'),
  };
}

/**
 * Writes response-turn record metadata onto a persisted assistant message.
 */
function writeResponseTurnRecordMetadata(
  message: MastraDBMessage,
  metadata: ResponseTurnRecordMetadata,
): MastraDBMessage {
  const contentMetadata = isPlainObject(message.content?.metadata) ? message.content.metadata : {};
  const mastraMetadata = isPlainObject(contentMetadata.mastra) ? contentMetadata.mastra : {};

  return {
    ...message,
    content: {
      ...message.content,
      metadata: {
        ...contentMetadata,
        mastra: {
          ...mastraMetadata,
          response: metadata,
        },
      },
    },
  };
}

/**
 * Looks up a stored response-turn record by response id.
 *
 * Response ids are assistant message ids, so this reconstructs the record by
 * loading that persisted assistant message, reading its response metadata, then
 * reloading the full set of stored turn messages referenced by the metadata.
 */
export async function findResponseTurnRecord({
  agent,
  responseId,
  requestContext,
}: {
  agent: Agent<any, any, any, any>;
  responseId: string;
  requestContext: RequestContext;
}): Promise<ResponseTurnRecord | null> {
  const memoryStore = await getAgentMemoryStore({ agent, requestContext });
  if (!memoryStore) {
    return null;
  }

  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
  const { messages: matchedMessages } = await memoryStore.listMessagesById({ messageIds: [responseId] });
  const message = matchedMessages[0];
  if (!message || message.role !== 'assistant') {
    return null;
  }

  const metadata = readResponseTurnRecordMetadata(message);
  if (!metadata || metadata.agentId !== agent.id) {
    return null;
  }

  const thread = message.threadId ? await memoryStore.getThreadById({ threadId: message.threadId }) : null;
  if (!thread) {
    return null;
  }

  await validateThreadOwnership(thread, effectiveResourceId);
  const messageIds = metadata.messageIds.length > 0 ? metadata.messageIds : [message.id];
  const { messages: responseMessages } = await memoryStore.listMessagesById({ messageIds });
  const messagesById = new Map(responseMessages.map(storedMessage => [storedMessage.id, storedMessage] as const));
  const orderedMessages = messageIds
    .map(messageId => messagesById.get(messageId))
    .filter((storedMessage): storedMessage is MastraDBMessage => Boolean(storedMessage));

  return { metadata, message, messages: orderedMessages, thread, memoryStore };
}

export async function findResponseTurnRecordAcrossAgents({
  mastra,
  responseId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  requestContext: RequestContext;
}): Promise<ResponseTurnRecord | null> {
  if (!mastra) {
    return null;
  }

  const agents = Object.values(mastra.listAgents()) as Agent<any, any, any, any>[];
  for (const agent of agents) {
    const match = await findResponseTurnRecord({ agent, responseId, requestContext });
    if (match) {
      return match;
    }
  }

  return null;
}

export type ConversationThreadRecord = {
  thread: StorageThreadType;
  memoryStore: MemoryStorage;
};

export async function findConversationThreadAcrossAgents({
  mastra,
  conversationId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  conversationId: string;
  requestContext: RequestContext;
}): Promise<ConversationThreadRecord | null> {
  if (!mastra) {
    return null;
  }

  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
  const agents = Object.values(mastra.listAgents()) as Agent<any, any, any, any>[];

  for (const agent of agents) {
    const memoryStore = await getAgentMemoryStore({ agent, requestContext });
    if (!memoryStore) {
      continue;
    }

    const thread = await memoryStore.getThreadById({ threadId: conversationId });
    if (!thread) {
      continue;
    }

    await validateThreadOwnership(thread, effectiveResourceId);
    return { thread, memoryStore };
  }

  return null;
}

/**
 * Creates a synthetic assistant message for responses that did not emit any
 * persisted DB messages but still need a durable response-turn record.
 */
function createSyntheticResponseMessage({
  responseId,
  text,
  threadContext,
}: {
  responseId: string;
  text: string;
  threadContext: ThreadExecutionContext;
}): MastraDBMessage {
  return {
    id: responseId,
    role: 'assistant',
    type: 'text',
    createdAt: new Date(),
    threadId: threadContext.threadId,
    resourceId: threadContext.resourceId,
    content: {
      format: 2 as const,
      parts: text ? [{ type: 'text', text }] : [],
    },
  };
}

/**
 * Resolves the Mastra messages that belong to the response turn being stored.
 */
export async function resolveResponseTurnMessagesForStorage({
  result,
  responseId,
  text,
  threadContext,
}: {
  result: ResponseResultLike;
  responseId: string;
  text: string;
  threadContext: ThreadExecutionContext | null;
}): Promise<MastraDBMessage[]> {
  const response = await result.response;
  const responseMessages = response?.dbMessages?.length ? response.dbMessages : [];

  if (!threadContext) {
    return responseMessages;
  }

  if (responseMessages.length === 0) {
    return [createSyntheticResponseMessage({ responseId, text, threadContext })];
  }

  return responseMessages;
}

/**
 * Persists a response-turn record by anchoring it on the final assistant
 * message in the stored turn.
 *
 * The response id becomes that assistant message id, and the response-specific
 * metadata is written onto the assistant message so later retrieval can rebuild
 * the Responses object from thread-backed storage.
 */
export async function persistResponseTurnRecord({
  memoryStore,
  responseId,
  metadata,
  threadContext,
  messages,
}: {
  memoryStore: MemoryStorage | null;
  responseId: string;
  metadata: ResponseTurnRecordMetadata;
  threadContext: ThreadExecutionContext;
  messages: MastraDBMessage[];
}): Promise<void> {
  if (!memoryStore) {
    throw new HTTPException(500, { message: 'Memory storage was not available while storing the response' });
  }

  const normalizedMessages: MastraDBMessage[] = messages.map(message => ({
    ...message,
    threadId: message.threadId ?? threadContext.threadId,
    resourceId: message.resourceId ?? threadContext.resourceId,
  }));

  const lastAssistantIndex = [...normalizedMessages].map(message => message.role).lastIndexOf('assistant');
  const lastAssistantMessage =
    lastAssistantIndex >= 0
      ? {
          ...normalizedMessages[lastAssistantIndex]!,
          id: responseId,
        }
      : ({
          id: responseId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: new Date(metadata.completedAt ? metadata.completedAt * 1000 : Date.now()),
          threadId: threadContext.threadId,
          resourceId: threadContext.resourceId,
          content: {
            format: 2 as const,
            parts: [],
          },
        } satisfies MastraDBMessage);

  if (lastAssistantIndex >= 0) {
    normalizedMessages[lastAssistantIndex] = lastAssistantMessage;
  } else {
    normalizedMessages.push(lastAssistantMessage);
  }

  const staleMessageIds =
    lastAssistantIndex >= 0 && messages[lastAssistantIndex]?.id && messages[lastAssistantIndex]?.id !== responseId
      ? [messages[lastAssistantIndex]!.id]
      : [];

  const storedMessage = writeResponseTurnRecordMetadata(lastAssistantMessage, {
    ...metadata,
    messageIds: normalizedMessages.map(message => message.id),
  });

  if (lastAssistantIndex >= 0) {
    normalizedMessages[lastAssistantIndex] = storedMessage;
  } else {
    normalizedMessages[normalizedMessages.length - 1] = storedMessage;
  }

  await memoryStore.saveMessages({ messages: normalizedMessages });

  if (staleMessageIds.length > 0) {
    await memoryStore.deleteMessages(staleMessageIds);
  }
}

/**
 * Removes all persisted messages for a stored response-turn record.
 */
export async function deleteResponseTurnRecord({
  responseTurnRecord,
}: {
  responseTurnRecord: ResponseTurnRecord;
}): Promise<void> {
  const messageIds =
    responseTurnRecord.messages.length > 0
      ? responseTurnRecord.messages.map(message => message.id)
      : [responseTurnRecord.message.id];

  await responseTurnRecord.memoryStore.deleteMessages(messageIds);
}
