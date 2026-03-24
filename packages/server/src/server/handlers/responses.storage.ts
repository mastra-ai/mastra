import type { MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { ResponseObject, ResponseTool, ResponseUsage } from '../schemas/responses';
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

export type StoredResponseTurnMetadata = {
  agentId: string;
  model: string;
  createdAt: number;
  completedAt: number | null;
  status: ResponseObject['status'];
  usage: ResponseUsage | null;
  instructions?: string;
  previousResponseId?: string;
  providerOptions?: ProviderMetadataLike;
  tools: ResponseTool[];
  store: boolean;
  messageIds: string[];
};

export type StoredResponseTurn = {
  metadata: StoredResponseTurnMetadata;
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
 * Resolves the memory storage domain used for stored Responses API entries.
 */
export async function getMemoryStore(mastra: Mastra | undefined): Promise<MemoryStorage | null> {
  const storage = mastra?.getStorage();
  if (!storage) {
    return null;
  }

  const memoryStore = await storage.getStore('memory');
  if (!memoryStore) {
    return null;
  }

  return memoryStore;
}

/**
 * Reads the Responses-specific metadata attached to a stored assistant message.
 */
function getStoredResponseTurnMetadata(message: MastraDBMessage): StoredResponseTurnMetadata | null {
  const mastraMetadata = isPlainObject(message.content?.metadata?.mastra) ? message.content.metadata.mastra : null;
  const responseMetadata = mastraMetadata && isPlainObject(mastraMetadata.response) ? mastraMetadata.response : null;

  if (
    !responseMetadata ||
    typeof responseMetadata.agentId !== 'string' ||
    typeof responseMetadata.model !== 'string' ||
    typeof responseMetadata.createdAt !== 'number' ||
    (responseMetadata.completedAt !== null && typeof responseMetadata.completedAt !== 'number') ||
    (responseMetadata.instructions !== undefined && typeof responseMetadata.instructions !== 'string') ||
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
    previousResponseId: responseMetadata.previousResponseId,
    providerOptions: responseMetadata.providerOptions as ProviderMetadataLike,
    tools: responseMetadata.tools as ResponseTool[],
    store: responseMetadata.store,
    messageIds: responseMetadata.messageIds.filter((value): value is string => typeof value === 'string'),
  };
}

/**
 * Attaches Responses-specific metadata to the persisted assistant message.
 */
function setStoredResponseTurnMetadata(
  message: MastraDBMessage,
  metadata: StoredResponseTurnMetadata,
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
 * Looks up a stored response by assistant message ID.
 */
export async function findStoredResponseTurn({
  mastra,
  responseId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  requestContext: RequestContext;
}): Promise<StoredResponseTurn | null> {
  const memoryStore = await getMemoryStore(mastra);
  if (!memoryStore) {
    return null;
  }

  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
  const { messages: matchedMessages } = await memoryStore.listMessagesById({ messageIds: [responseId] });
  const message = matchedMessages[0];
  if (!message || message.role !== 'assistant') {
    return null;
  }

  const metadata = getStoredResponseTurnMetadata(message);
  if (!metadata) {
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
 * Resolves the response messages that should represent the stored assistant turn.
 */
export async function resolveStoredResponseTurnMessages({
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
 * Persists the response turn and records the response metadata on the final assistant message.
 */
export async function persistStoredResponseTurn({
  mastra,
  responseId,
  metadata,
  threadContext,
  messages,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  metadata: StoredResponseTurnMetadata;
  threadContext: ThreadExecutionContext;
  messages: MastraDBMessage[];
}): Promise<void> {
  const memoryStore = await getMemoryStore(mastra);
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

  const storedMessage = setStoredResponseTurnMetadata(lastAssistantMessage, {
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
 * Removes all persisted messages for a stored response.
 */
export async function deleteStoredResponseTurn({
  mastra,
  responseId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  requestContext: RequestContext;
}): Promise<boolean> {
  const match = await findStoredResponseTurn({ mastra, responseId, requestContext });
  if (!match) {
    return false;
  }

  await match.memoryStore.deleteMessages(match.metadata.messageIds);
  return true;
}
