import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type {
  ResponseObject,
  ResponseOutputItem,
  ResponseTextConfig,
  ResponseTool,
  ResponseUsage,
} from '../schemas/responses';
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
  outputItems?: ResponseOutputItem[];
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

type SyntheticToolResultMessage = Omit<MastraDBMessage, 'role'> & { role: 'tool' };

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
    !Array.isArray(responseMetadata.messageIds) ||
    (responseMetadata.outputItems !== undefined && !Array.isArray(responseMetadata.outputItems))
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
    outputItems: responseMetadata.outputItems as ResponseOutputItem[] | undefined,
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
  createdAt,
  responseId,
  text,
  threadContext,
}: {
  createdAt?: Date;
  responseId: string;
  text: string;
  threadContext: ThreadExecutionContext;
}): MastraDBMessage {
  return {
    id: responseId,
    role: 'assistant',
    type: 'text',
    createdAt: createdAt ?? new Date(),
    threadId: threadContext.threadId,
    resourceId: threadContext.resourceId,
    content: {
      format: 2 as const,
      parts: text ? [{ type: 'text', text }] : [],
    },
  };
}

function hasTextPart(message: MastraDBMessage): boolean {
  return Boolean(
    message.content?.parts?.some(
      part => isPlainObject(part) && part.type === 'text' && typeof part.text === 'string' && part.text.length > 0,
    ),
  );
}

function isEmptyAssistantMessage(message: MastraDBMessage): boolean {
  return message.role === 'assistant' && Array.isArray(message.content?.parts) && message.content.parts.length === 0;
}

function hasToolInvocationPart(message: MastraDBMessage): boolean {
  return Boolean(
    message.content?.parts?.some(
      part => isPlainObject(part) && part.type === 'tool-invocation' && isPlainObject(part.toolInvocation),
    ),
  );
}

function getMessageText(message: MastraDBMessage): string {
  return (
    message.content?.parts
      ?.flatMap(part =>
        isPlainObject(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
      )
      .join('') ?? ''
  );
}

function getOutputMessageText(item: Extract<ResponseOutputItem, { type: 'message' }>): string {
  return item.content.map(part => part.text).join('');
}

function normalizeFallbackComparisonText(text: string): string {
  return text.trim();
}

function matchesFallbackText(messageText: string, fallbackText: string): boolean {
  return (
    messageText === fallbackText ||
    normalizeFallbackComparisonText(messageText) === normalizeFallbackComparisonText(fallbackText)
  );
}

function hasMatchingAssistantText(
  messages: MastraDBMessage[],
  item: Extract<ResponseOutputItem, { type: 'message' }>,
): boolean {
  const fallbackText = getOutputMessageText(item);

  return messages.some(
    message =>
      message.role === 'assistant' &&
      hasTextPart(message) &&
      matchesFallbackText(getMessageText(message), fallbackText),
  );
}

function shouldReplaceAssistantText(messageText: string, fallbackText: string): boolean {
  const normalizedMessageText = normalizeFallbackComparisonText(messageText);
  const normalizedFallbackText = normalizeFallbackComparisonText(fallbackText);

  return (
    normalizedFallbackText !== normalizedMessageText &&
    (fallbackText.startsWith(messageText) || normalizedFallbackText.startsWith(normalizedMessageText))
  );
}

function getAssistantMessageTexts(messages: MastraDBMessage[]): string[] {
  return messages.flatMap(message =>
    message.role === 'assistant' && hasTextPart(message) ? [getMessageText(message)] : [],
  );
}

function shouldAddFallbackMessageText(
  messages: MastraDBMessage[],
  item: Extract<ResponseOutputItem, { type: 'message' }>,
): boolean {
  const assistantTexts = getAssistantMessageTexts(messages);
  if (assistantTexts.length === 0) {
    return true;
  }

  const fallbackText = getOutputMessageText(item);
  return assistantTexts.every(messageText => shouldReplaceAssistantText(messageText, fallbackText));
}

function shouldReplaceAssistantTextWithFallback({
  fallbackMessageTexts,
  message,
  textOnlyFallbackMessageTexts,
}: {
  fallbackMessageTexts: Set<string>;
  message: MastraDBMessage;
  textOnlyFallbackMessageTexts: Set<string>;
}): boolean {
  if (message.role !== 'assistant' || !hasTextPart(message)) {
    return false;
  }

  const messageText = getMessageText(message);
  if (!messageText) {
    return false;
  }

  const comparisonTexts = hasToolInvocationPart(message) ? fallbackMessageTexts : textOnlyFallbackMessageTexts;

  return [...comparisonTexts].some(fallbackText => shouldReplaceAssistantText(messageText, fallbackText));
}

function replaceAssistantTextWithFallback({
  fallbackMessageTexts,
  message,
  textOnlyFallbackMessageTexts,
}: {
  fallbackMessageTexts: Set<string>;
  message: MastraDBMessage;
  textOnlyFallbackMessageTexts: Set<string>;
}): MastraDBMessage {
  if (!shouldReplaceAssistantTextWithFallback({ fallbackMessageTexts, message, textOnlyFallbackMessageTexts })) {
    return message;
  }

  const parts = message.content?.parts ?? [];
  const remainingParts = parts.filter(part => !(isPlainObject(part) && part.type === 'text'));

  return {
    ...message,
    content: {
      ...message.content,
      parts: remainingParts,
    },
  };
}

function parseFunctionCallArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { __raw: value };
  }
}

function createSyntheticToolResultMessage({
  baseMessage,
  item,
  responseId,
  toolCall,
}: {
  baseMessage: Pick<MastraDBMessage, 'createdAt' | 'threadId' | 'resourceId'>;
  item: Extract<ResponseOutputItem, { type: 'function_call_output' }>;
  responseId: string;
  toolCall?: { args: unknown; toolName: string };
}): SyntheticToolResultMessage {
  return {
    ...baseMessage,
    id: `${responseId}:tool-result:${item.call_id}`,
    role: 'tool',
    type: 'tool-result',
    content: {
      format: 2 as const,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: item.call_id,
            toolName: toolCall?.toolName ?? 'unknown',
            args: toolCall?.args ?? {},
            result: item.output,
          },
        },
      ],
    },
  };
}

function toMastraDBMessage(message: SyntheticToolResultMessage): MastraDBMessage {
  // MastraDBMessage does not yet type persisted v2 tool-role messages, but
  // storage and response mapping already handle them at runtime.
  return message as unknown as MastraDBMessage;
}

function createSyntheticMessagesFromOutputItems({
  contextOutputItems,
  outputItems,
  responseId,
  threadContext,
}: {
  contextOutputItems?: ResponseOutputItem[];
  outputItems: ResponseOutputItem[];
  responseId: string;
  threadContext: ThreadExecutionContext;
}): MastraDBMessage[] {
  const toolContextItems = contextOutputItems ?? outputItems;
  const toolCallsById = new Map(
    toolContextItems.flatMap(item =>
      item.type === 'function_call'
        ? [[item.call_id, { args: parseFunctionCallArguments(item.arguments), toolName: item.name }] as const]
        : [],
    ),
  );

  const baseCreatedAt = Date.now();

  return outputItems.map((item, index): MastraDBMessage => {
    const baseMessage = {
      createdAt: new Date(baseCreatedAt + index),
      threadId: threadContext.threadId,
      resourceId: threadContext.resourceId,
    };

    if (item.type === 'function_call') {
      return {
        ...baseMessage,
        id: `${responseId}:tool-call:${item.call_id}`,
        role: 'assistant',
        type: 'tool-call',
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: item.call_id,
                toolName: item.name,
                args: parseFunctionCallArguments(item.arguments),
              },
            },
          ],
        },
      };
    }

    if (item.type === 'function_call_output') {
      const toolCall = toolCallsById.get(item.call_id);

      return toMastraDBMessage(createSyntheticToolResultMessage({ baseMessage, item, responseId, toolCall }));
    }

    return {
      ...baseMessage,
      id: item.id,
      role: 'assistant',
      type: 'text',
      content: {
        format: 2 as const,
        parts: item.content.map(part => ({ type: 'text' as const, text: part.text })),
      },
    };
  });
}

function getToolInvocationParts(message: MastraDBMessage): Array<Record<string, unknown>> {
  const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];

  return parts.flatMap(part =>
    isPlainObject(part) && part.type === 'tool-invocation' && isPlainObject(part.toolInvocation)
      ? [part.toolInvocation]
      : [],
  );
}

function getMissingFallbackOutputItems({
  fallbackOutputItems = [],
  messages,
}: {
  fallbackOutputItems?: ResponseObject['output'];
  messages: MastraDBMessage[];
}): ResponseOutputItem[] {
  if (!fallbackOutputItems.length) {
    return [];
  }

  const existingCallIds = new Set<string>();
  const existingResultCallIds = new Set<string>();

  for (const message of messages) {
    for (const toolInvocation of getToolInvocationParts(message)) {
      const toolCallId = typeof toolInvocation.toolCallId === 'string' ? toolInvocation.toolCallId : null;
      if (!toolCallId) {
        continue;
      }

      if (message.role === 'assistant' && (toolInvocation.args !== undefined || toolInvocation.result === undefined)) {
        existingCallIds.add(toolCallId);
      }
      if (toolInvocation.result !== undefined) {
        existingResultCallIds.add(toolCallId);
      }
    }
  }

  return fallbackOutputItems.filter(item => {
    if (item.type === 'function_call') {
      return !existingCallIds.has(item.call_id);
    }

    if (item.type === 'function_call_output') {
      return !existingResultCallIds.has(item.call_id);
    }

    if (item.type === 'message') {
      if (!item.content.some(part => part.text.length > 0) || hasMatchingAssistantText(messages, item)) {
        return false;
      }

      return shouldAddFallbackMessageText(messages, item);
    }

    return false;
  });
}

function getFallbackOutputIdForMessage(
  message: MastraDBMessage,
  responseId: string,
  fallbackOutputIds: Set<string>,
): string | null {
  for (const toolInvocation of getToolInvocationParts(message)) {
    const toolCallId = typeof toolInvocation.toolCallId === 'string' ? toolInvocation.toolCallId : null;
    if (!toolCallId) {
      continue;
    }

    if (message.role === 'assistant' && toolInvocation.args !== undefined) {
      return toolCallId;
    }

    if (toolInvocation.result !== undefined) {
      return `${toolCallId}:output`;
    }
  }

  if (message.role === 'assistant' && hasTextPart(message)) {
    return fallbackOutputIds.has(message.id) ? message.id : responseId;
  }

  return null;
}

function sortMessagesByFallbackOutputOrder({
  fallbackOutputItems = [],
  messages,
  responseId,
}: {
  fallbackOutputItems?: ResponseObject['output'];
  messages: MastraDBMessage[];
  responseId: string;
}): MastraDBMessage[] {
  if (!fallbackOutputItems.length) {
    return messages;
  }

  const outputOrder = new Map(fallbackOutputItems.map((item, index) => [item.id, index]));
  const fallbackOutputIds = new Set(outputOrder.keys());

  return messages
    .map((message, index) => ({
      index,
      message,
      outputIndex:
        outputOrder.get(getFallbackOutputIdForMessage(message, responseId, fallbackOutputIds) ?? '') ??
        Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.outputIndex - right.outputIndex || left.index - right.index)
    .map(({ message }) => message);
}

/**
 * Resolves the Mastra messages that belong to the response turn being stored.
 */
export async function resolveResponseTurnMessagesForStorage({
  result,
  responseId,
  text,
  threadContext,
  fallbackOutputItems,
}: {
  result: ResponseResultLike;
  responseId: string;
  text: string;
  threadContext: ThreadExecutionContext | null;
  fallbackOutputItems?: ResponseObject['output'];
}): Promise<MastraDBMessage[]> {
  const response = await result.response;
  const responseMessages = response?.dbMessages?.length ? response.dbMessages : [];

  if (!threadContext) {
    return responseMessages;
  }

  if (responseMessages.length === 0) {
    if (fallbackOutputItems?.length) {
      const syntheticMessages = createSyntheticMessagesFromOutputItems({
        outputItems: fallbackOutputItems,
        responseId,
        threadContext,
      });

      return text && !syntheticMessages.some(message => message.role === 'assistant' && hasTextPart(message))
        ? [
            ...syntheticMessages,
            createSyntheticResponseMessage({
              createdAt: new Date(new Date(syntheticMessages.at(-1)?.createdAt ?? Date.now()).getTime() + 1),
              responseId,
              text,
              threadContext,
            }),
          ]
        : syntheticMessages;
    }

    return [createSyntheticResponseMessage({ responseId, text, threadContext })];
  }

  const missingFallbackItems = getMissingFallbackOutputItems({ fallbackOutputItems, messages: responseMessages });
  const missingFallbackMessageIds = new Set(
    missingFallbackItems
      .filter((item): item is Extract<ResponseOutputItem, { type: 'message' }> => item.type === 'message')
      .map(item => item.id),
  );
  const fallbackItemsWithMatchingAssistantText = (fallbackOutputItems ?? []).filter(
    (item): item is Extract<ResponseOutputItem, { type: 'message' }> =>
      item.type === 'message' && hasMatchingAssistantText(responseMessages, item),
  );
  const textOnlyFallbackMessageTexts = new Set(
    fallbackItemsWithMatchingAssistantText.map(getOutputMessageText).filter(Boolean),
  );
  const fallbackMessageTexts = new Set(
    (fallbackOutputItems ?? [])
      .filter((item): item is Extract<ResponseOutputItem, { type: 'message' }> => item.type === 'message')
      .filter(item => missingFallbackMessageIds.has(item.id) || fallbackItemsWithMatchingAssistantText.includes(item))
      .map(getOutputMessageText)
      .filter(Boolean),
  );
  const baseMessages = fallbackMessageTexts.size
    ? responseMessages.map(message =>
        replaceAssistantTextWithFallback({ fallbackMessageTexts, message, textOnlyFallbackMessageTexts }),
      )
    : responseMessages;
  const syntheticFallbackMessages = createSyntheticMessagesFromOutputItems({
    contextOutputItems: fallbackOutputItems ?? [],
    outputItems: missingFallbackItems,
    responseId,
    threadContext,
  });
  const resolvedMessages = sortMessagesByFallbackOutputOrder({
    fallbackOutputItems,
    messages: [...baseMessages, ...syntheticFallbackMessages],
    responseId,
  });

  if (text && !resolvedMessages.some(message => message.role === 'assistant' && hasTextPart(message))) {
    return [...resolvedMessages, createSyntheticResponseMessage({ responseId, text, threadContext })];
  }

  return resolvedMessages;
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
  const responseAnchorIndex =
    [...normalizedMessages]
      .map((message, index) => ({ index, message }))
      .reverse()
      .find(({ message }) => message.role === 'assistant' && hasTextPart(message))?.index ?? lastAssistantIndex;
  const lastAssistantMessage =
    responseAnchorIndex >= 0
      ? {
          ...normalizedMessages[responseAnchorIndex]!,
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

  if (responseAnchorIndex >= 0) {
    normalizedMessages[responseAnchorIndex] = lastAssistantMessage;
  } else {
    normalizedMessages.push(lastAssistantMessage);
  }
  const storedMessageIndex = responseAnchorIndex >= 0 ? responseAnchorIndex : normalizedMessages.length - 1;

  const droppedSupersededMessageIds = normalizedMessages.flatMap((message, index) =>
    index !== storedMessageIndex && isEmptyAssistantMessage(message) && messages[index]?.id
      ? [messages[index]!.id]
      : [],
  );
  const staleMessageIds =
    responseAnchorIndex >= 0 && messages[responseAnchorIndex]?.id && messages[responseAnchorIndex]?.id !== responseId
      ? [messages[responseAnchorIndex]!.id]
      : [];
  const messagesToSave = normalizedMessages.filter(
    (message, index) => index === storedMessageIndex || !isEmptyAssistantMessage(message),
  );

  const storedMessage = writeResponseTurnRecordMetadata(lastAssistantMessage, {
    ...metadata,
    messageIds: messagesToSave.map(message => message.id),
  });

  if (responseAnchorIndex >= 0) {
    normalizedMessages[responseAnchorIndex] = storedMessage;
  } else {
    normalizedMessages[normalizedMessages.length - 1] = storedMessage;
  }

  const savedMessages = normalizedMessages.filter(
    (message, index) => index === storedMessageIndex || !isEmptyAssistantMessage(message),
  );

  await memoryStore.saveMessages({ messages: savedMessages });

  const deleteMessageIds = [...new Set([...staleMessageIds, ...droppedSupersededMessageIds])];
  if (deleteMessageIds.length > 0) {
    await memoryStore.deleteMessages(deleteMessageIds);
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
