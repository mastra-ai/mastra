import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import { isProviderDefinedTool } from '@mastra/core/tools';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type {
  ConversationItem,
  ResponseInputMessage,
  ResponseObject,
  ResponseOutputItem,
  ResponseTextConfig,
  ResponseTool,
} from '../schemas/responses';
import type { ProviderMetadataLike, ResponseTurnRecord, UsageLike } from './responses.storage';

export type ResponseExecutionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Flattens Responses API message content into the plain-text shape Mastra agent
 * execution expects today.
 */
function normalizeMessageContent(content: ResponseInputMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map(part => part.text).join('');
}

/**
 * Extracts the human-readable text represented by a persisted Mastra message.
 */
function getMessageText(message: MastraDBMessage): string {
  const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];
  return parts
    .flatMap(part => (part.type === 'text' ? [part.text] : []))
    .filter((text): text is string => typeof text === 'string')
    .join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageRole(message: MastraDBMessage): string {
  return (message as { role?: string }).role ?? '';
}

/**
 * Creates a stable fallback key for tool items when a tool call id is missing
 * from the stored message payload.
 */
function getToolKey(toolCallId: string | null, messageId: string, partIndex: number) {
  return toolCallId ?? `${messageId}:${partIndex}`;
}

function getFunctionCallOutputItemId(toolCallId: string) {
  return `${toolCallId}:output`;
}

/**
 * Normalizes tool parameter schemas so the Responses API always exposes the
 * plain JSON Schema object regardless of whether the source tool came from a
 * provider-defined tool or a Mastra/Zod tool definition.
 */
function normalizeToolParameters(schema: unknown): unknown {
  if (!isRecord(schema)) {
    return schema;
  }

  if (isRecord(schema.json) && Object.keys(schema).length === 1) {
    return schema.json;
  }

  return schema;
}

/**
 * Maps configured Mastra tools into Responses API tool definitions.
 */
export function mapMastraToolsToResponseTools(tools: Record<string, unknown> | undefined): ResponseTool[] {
  if (!tools) {
    return [];
  }

  return Object.values(tools).flatMap(tool => {
    if (!isRecord(tool)) {
      return [];
    }

    const name = typeof tool.id === 'string' ? tool.id : typeof tool.name === 'string' ? tool.name : null;
    if (!name) {
      return [];
    }

    const description = typeof tool.description === 'string' ? tool.description : undefined;

    let parameters: unknown;
    if (isProviderDefinedTool(tool)) {
      const resolvedSchema = typeof tool.inputSchema === 'function' ? tool.inputSchema() : tool.inputSchema;
      parameters =
        isRecord(resolvedSchema) && 'jsonSchema' in resolvedSchema
          ? normalizeToolParameters(resolvedSchema.jsonSchema)
          : undefined;
    } else if ('inputSchema' in tool && tool.inputSchema) {
      parameters = normalizeToolParameters(zodToJsonSchema(tool.inputSchema as never));
    }

    return [
      {
        type: 'function',
        name,
        ...(description ? { description } : {}),
        ...(parameters !== undefined ? { parameters: JSON.parse(JSON.stringify(parameters)) } : {}),
      } satisfies ResponseTool,
    ];
  });
}

function stringifyToolPayload(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value === undefined ? {} : value);
}

function stringifyToolArguments(value: unknown) {
  if (isRecord(value) && typeof value.__raw === 'string') {
    return value.__raw;
  }

  return stringifyToolPayload(value === null ? undefined : value);
}

function createOutputMessage({
  messageId,
  status,
  text,
}: {
  messageId: string;
  status: ResponseObject['status'];
  text: string;
}) {
  const responseStatus: Extract<ResponseObject['output'][number], { type: 'message' }>['status'] =
    status === 'completed' ? 'completed' : 'incomplete';

  return {
    id: messageId,
    type: 'message' as const,
    role: 'assistant' as const,
    status: responseStatus,
    content: [createOutputTextPart(text)],
  };
}

function createConversationMessage({
  messageId,
  role,
  text,
}: {
  messageId: string;
  role: 'system' | 'user' | 'assistant';
  text: string;
}) {
  return {
    id: messageId,
    type: 'message' as const,
    role,
    status: 'completed' as const,
    content: [
      role === 'assistant'
        ? createOutputTextPart(text)
        : {
            type: 'input_text' as const,
            text,
          },
    ],
  };
}

function createFunctionCallItem({
  itemId,
  callId,
  name,
  args,
}: {
  itemId: string;
  callId: string;
  name: string;
  args: unknown;
}) {
  return {
    id: itemId,
    type: 'function_call' as const,
    call_id: callId,
    name,
    arguments: stringifyToolArguments(args),
    status: 'completed' as const,
  };
}

function createFunctionCallOutputItem({ itemId, callId, output }: { itemId: string; callId: string; output: unknown }) {
  return {
    id: itemId,
    type: 'function_call_output' as const,
    call_id: callId,
    output: stringifyToolPayload(output),
  };
}

type ResponseToolItem = Extract<ConversationItem, { type: 'function_call' | 'function_call_output' }>;

/**
 * Records which tool call ids already have dedicated tool-result messages so we can
 * avoid duplicating `function_call_output` items when assistant messages echo the
 * result inline.
 */
function collectToolResultCallIds(messages: MastraDBMessage[]) {
  const toolResultCallIds = new Set<string>();

  for (const message of messages) {
    const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];
    for (const [partIndex, part] of parts.entries()) {
      if (!isRecord(part) || part.type !== 'tool-invocation' || !isRecord(part.toolInvocation)) {
        continue;
      }

      const toolInvocation = part.toolInvocation;
      const toolCallId =
        typeof toolInvocation.toolCallId === 'string'
          ? toolInvocation.toolCallId
          : getToolKey(null, message.id, partIndex);

      if (getMessageRole(message) === 'tool' && toolInvocation.result !== undefined) {
        toolResultCallIds.add(toolCallId);
      }
    }
  }

  return toolResultCallIds;
}

/**
 * Maps one persisted Mastra message into the tool-related Responses items that
 * it contributes to the conversation timeline.
 */
function mapMastraMessageToResponseToolItems({
  message,
  toolResultCallIds,
  emittedCallIds,
  emittedResultCallIds,
}: {
  message: MastraDBMessage;
  toolResultCallIds: Set<string>;
  emittedCallIds: Set<string>;
  emittedResultCallIds: Set<string>;
}): ResponseToolItem[] {
  const items: ResponseToolItem[] = [];
  const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];

  for (const [partIndex, part] of parts.entries()) {
    if (!isRecord(part) || part.type !== 'tool-invocation' || !isRecord(part.toolInvocation)) {
      continue;
    }

    const toolInvocation = part.toolInvocation;
    const toolName = typeof toolInvocation.toolName === 'string' ? toolInvocation.toolName : null;
    const toolCallId =
      typeof toolInvocation.toolCallId === 'string'
        ? toolInvocation.toolCallId
        : getToolKey(null, message.id, partIndex);

    if (getMessageRole(message) === 'assistant' && toolName && !emittedCallIds.has(toolCallId)) {
      items.push(
        createFunctionCallItem({
          itemId: toolCallId,
          callId: toolCallId,
          name: toolName,
          args: toolInvocation.args,
        }),
      );
      emittedCallIds.add(toolCallId);
    }

    if (
      toolInvocation.result !== undefined &&
      !emittedResultCallIds.has(toolCallId) &&
      (getMessageRole(message) === 'tool' || !toolResultCallIds.has(toolCallId))
    ) {
      items.push(
        createFunctionCallOutputItem({
          itemId: getFunctionCallOutputItemId(toolCallId),
          callId: toolCallId,
          output: toolInvocation.result,
        }),
      );
      emittedResultCallIds.add(toolCallId);
    }
  }

  return items;
}

/**
 * Maps Mastra thread messages into OpenAI-style conversation items.
 */
export function mapMastraMessagesToConversationItems(messages: MastraDBMessage[]): ConversationItem[] {
  if (!messages.length) {
    return [];
  }

  const items: ConversationItem[] = [];
  const toolResultCallIds = collectToolResultCallIds(messages);
  const emittedCallIds = new Set<string>();
  const emittedResultCallIds = new Set<string>();

  for (const message of messages) {
    items.push(
      ...mapMastraMessageToResponseToolItems({
        message,
        toolResultCallIds,
        emittedCallIds,
        emittedResultCallIds,
      }),
    );

    const role = getMessageRole(message);
    const text = getMessageText(message);

    if ((role === 'user' || role === 'system' || role === 'assistant') && text) {
      items.push(
        createConversationMessage({
          messageId: message.id,
          role,
          text,
        }),
      );
      continue;
    }

    if (role === 'assistant' && !text) {
      const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];
      const hasOnlyToolInvocations = parts.every(
        part => isRecord(part) && part.type === 'tool-invocation' && isRecord(part.toolInvocation),
      );

      if (hasOnlyToolInvocations) {
        continue;
      }
    }

    if (role === 'tool') {
      continue;
    }
  }

  return items;
}

function mergeFallbackOutputItems({
  output,
  fallbackOutputItems,
}: {
  output: ResponseOutputItem[];
  fallbackOutputItems: ResponseOutputItem[];
}): ResponseOutputItem[] {
  if (!fallbackOutputItems.length) {
    return output;
  }

  const outputById = new Map(output.map(item => [item.id, item]));
  const fallbackIds = new Set(fallbackOutputItems.map(item => item.id));

  return [
    ...fallbackOutputItems.map(item => outputById.get(item.id) ?? item),
    ...output.filter(item => !fallbackIds.has(item.id)),
  ];
}

function getOutputMessageText(item: Extract<ResponseOutputItem, { type: 'message' }>): string {
  return item.content.map(part => part.text).join('');
}

/**
 * Maps the stored Mastra messages for one response turn back into OpenAI-style
 * `response.output` items, preserving tool/message ordering from the thread.
 */
export function mapMastraMessagesToResponseOutputItems({
  messages,
  outputMessageId,
  status,
  fallbackText,
  fallbackOutputItems = [],
}: {
  messages: MastraDBMessage[] | undefined;
  outputMessageId: string;
  status: ResponseObject['status'];
  fallbackText: string;
  fallbackOutputItems?: ResponseOutputItem[];
}): ResponseOutputItem[] {
  if (!messages?.length) {
    if (fallbackOutputItems.length) {
      return fallbackOutputItems;
    }

    return [createOutputMessage({ messageId: outputMessageId, status, text: fallbackText })];
  }

  const output: ResponseOutputItem[] = [];
  const lastAssistantIndex = [...messages].map(message => message.role).lastIndexOf('assistant');
  const outputMessageIndex =
    [...messages]
      .map((message, index) => ({ index, message }))
      .reverse()
      .find(({ message }) => getMessageRole(message) === 'assistant' && getMessageText(message))?.index ??
    lastAssistantIndex;
  const toolResultCallIds = collectToolResultCallIds(messages);
  const emittedCallIds = new Set<string>();
  const emittedResultCallIds = new Set<string>();
  const fallbackMessageItems = fallbackOutputItems.filter(
    (item): item is Extract<ResponseOutputItem, { type: 'message' }> => item.type === 'message',
  );
  const emittedFallbackMessageIds = new Set<string>();

  const getOutputMessageId = ({
    message,
    text,
    useOutputMessageId,
  }: {
    message: MastraDBMessage;
    text: string;
    useOutputMessageId: boolean;
  }) => {
    const directFallbackItem = fallbackMessageItems.find(item => item.id === message.id);
    if (directFallbackItem) {
      emittedFallbackMessageIds.add(directFallbackItem.id);
      return directFallbackItem.id;
    }

    if (useOutputMessageId) {
      const matchingFallbackItem = fallbackMessageItems.find(
        item =>
          item.id !== outputMessageId && !emittedFallbackMessageIds.has(item.id) && getOutputMessageText(item) === text,
      );
      if (matchingFallbackItem) {
        emittedFallbackMessageIds.add(matchingFallbackItem.id);
        return matchingFallbackItem.id;
      }
    }

    return useOutputMessageId ? outputMessageId : message.id;
  };

  for (const [messageIndex, message] of messages.entries()) {
    output.push(
      ...mapMastraMessageToResponseToolItems({
        message,
        toolResultCallIds,
        emittedCallIds,
        emittedResultCallIds,
      }),
    );

    const text = getMessageText(message);
    if (getMessageRole(message) === 'assistant' && text) {
      const useOutputMessageId = messageIndex === outputMessageIndex;
      output.push(
        createOutputMessage({
          messageId: getOutputMessageId({ message, text, useOutputMessageId }),
          status,
          text,
        }),
      );
    }
  }

  if (!output.some(item => item.type === 'message') && fallbackText) {
    output.push(createOutputMessage({ messageId: outputMessageId, status, text: fallbackText }));
  }

  return mergeFallbackOutputItems({ output, fallbackOutputItems });
}

/**
 * Creates a stable assistant-message-backed response identifier.
 */
export function createMessageId() {
  return `msg_${randomUUID()}`;
}

/**
 * Maps Responses API input into the plain execution messages Mastra agents expect.
 */
export function mapResponseInputToExecutionMessages(
  input: ResponseInputMessage[] | string,
): ResponseExecutionMessage[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  return input.map(message => ({
    role: message.role === 'developer' ? 'system' : message.role,
    content: normalizeMessageContent(message.content),
  }));
}

/**
 * Converts usage details to the Responses API usage shape.
 */
export function toResponseUsage(usage: UsageLike): ResponseObject['usage'] {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    input_tokens_details: {
      cached_tokens: 0,
    },
    output_tokens_details: {
      reasoning_tokens: 0,
    },
  };
}

/**
 * Maps model finish reasons onto the Responses API status field.
 */
export function toResponseStatus(finishReason: string | undefined): ResponseObject['status'] {
  if (finishReason === 'suspended' || finishReason === 'error') {
    return 'incomplete';
  }

  return 'completed';
}

/**
 * Formats a text response part using the OpenAI-compatible Responses shape.
 */
export function createOutputTextPart(text: string) {
  return {
    type: 'output_text' as const,
    text,
    annotations: [] as unknown[],
    logprobs: [] as unknown[],
  };
}

/**
 * Builds a completed Responses API object from Mastra execution state.
 */
export function buildCompletedResponse({
  responseId,
  outputMessageId,
  model,
  createdAt,
  completedAt,
  status,
  text,
  usage,
  instructions,
  textConfig,
  previousResponseId,
  conversationId,
  providerOptions,
  tools,
  store,
  messages,
  fallbackOutputItems,
}: {
  responseId: string;
  outputMessageId: string;
  model: string;
  createdAt: number;
  completedAt: number | null;
  status: ResponseObject['status'];
  text: string;
  usage: UsageLike;
  instructions?: string;
  textConfig?: ResponseTextConfig;
  previousResponseId?: string;
  conversationId?: string;
  providerOptions?: ProviderMetadataLike;
  tools: ResponseTool[];
  store: boolean;
  messages?: MastraDBMessage[];
  fallbackOutputItems?: ResponseOutputItem[];
}): ResponseObject {
  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    completed_at: completedAt,
    model,
    status,
    output: mapMastraMessagesToResponseOutputItems({
      messages,
      outputMessageId,
      status,
      fallbackText: text,
      fallbackOutputItems,
    }),
    usage: toResponseUsage(usage),
    error: null,
    incomplete_details: null,
    instructions: instructions ?? null,
    text: textConfig ?? null,
    previous_response_id: previousResponseId ?? null,
    conversation_id: conversationId ?? null,
    providerOptions,
    tools,
    store,
  };
}

/**
 * Builds the initial in-progress Responses API object emitted at stream start.
 */
export function buildInProgressResponse({
  responseId,
  model,
  createdAt,
  instructions,
  textConfig,
  previousResponseId,
  conversationId,
  tools,
  store,
}: {
  responseId: string;
  model: string;
  createdAt: number;
  instructions?: string;
  textConfig?: ResponseTextConfig;
  previousResponseId?: string;
  conversationId?: string;
  store: boolean;
  tools?: ResponseTool[];
}): ResponseObject {
  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    completed_at: null,
    model,
    status: 'in_progress',
    output: [],
    usage: null,
    error: null,
    incomplete_details: null,
    instructions: instructions ?? null,
    text: textConfig ?? null,
    previous_response_id: previousResponseId ?? null,
    conversation_id: conversationId ?? null,
    tools: tools ?? [],
    store,
  };
}

/**
 * Reconstructs a Responses API object from a stored response-turn record.
 */
export function mapResponseTurnRecordToResponse(match: ResponseTurnRecord): ResponseObject {
  return {
    id: match.message.id,
    object: 'response',
    created_at: match.metadata.createdAt,
    completed_at: match.metadata.completedAt,
    model: match.metadata.model,
    status: match.metadata.status,
    output: mapMastraMessagesToResponseOutputItems({
      messages: match.messages,
      outputMessageId: match.message.id,
      status: match.metadata.status,
      fallbackText: getMessageText(match.message),
      fallbackOutputItems: match.metadata.outputItems,
    }),
    usage: match.metadata.usage,
    error: null,
    incomplete_details: null,
    instructions: match.metadata.instructions ?? null,
    text: match.metadata.text ?? null,
    previous_response_id: match.metadata.previousResponseId ?? null,
    conversation_id: match.thread.id,
    providerOptions: match.metadata.providerOptions,
    tools: match.metadata.tools,
    store: match.metadata.store,
  };
}

/**
 * Formats an SSE event line for the streaming Responses route.
 */
export function formatSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Extracts text deltas from the Mastra stream chunk variants used by the route.
 */
export function extractTextDelta(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }

  const chunk = value as { type: string; payload?: { text?: string }; textDelta?: string; text?: string };

  switch (chunk.type) {
    case 'text-delta':
      if (typeof chunk.payload?.text === 'string') {
        return chunk.payload.text;
      }

      if (typeof chunk.textDelta === 'string') {
        return chunk.textDelta;
      }

      if (typeof chunk.text === 'string') {
        return chunk.text;
      }

      return null;
    default:
      return null;
  }
}

type ResponseOutputItemAddedPayload = {
  type: 'response.output_item.added';
  output_index: number;
  item: ResponseOutputItem;
};

type ResponseContentPartAddedPayload = {
  type: 'response.content_part.added';
  output_index: number;
  content_index: number;
  item_id: string;
  part: ReturnType<typeof createOutputTextPart>;
};

type ResponseOutputTextDeltaPayload = {
  type: 'response.output_text.delta';
  output_index: number;
  content_index: number;
  item_id: string;
  delta: string;
};

type ResponseFunctionCallArgumentsDeltaPayload = {
  type: 'response.function_call_arguments.delta';
  output_index: number;
  item_id: string;
  delta: string;
};

type ResponseFunctionCallArgumentsDonePayload = {
  type: 'response.function_call_arguments.done';
  output_index: number;
  item_id: string;
  name: string;
  arguments: string;
};

type ResponseOutputItemDonePayload = {
  type: 'response.output_item.done';
  output_index: number;
  item: ResponseOutputItem;
};

type ResponseOutputTextDonePayload = {
  type: 'response.output_text.done';
  output_index: number;
  content_index: number;
  item_id: string;
  text: string;
};

type ResponseContentPartDonePayload = {
  type: 'response.content_part.done';
  output_index: number;
  content_index: number;
  item_id: string;
  part: ReturnType<typeof createOutputTextPart>;
};

type ResponseSsePayload =
  | ResponseOutputItemAddedPayload
  | ResponseContentPartAddedPayload
  | ResponseOutputTextDeltaPayload
  | ResponseFunctionCallArgumentsDeltaPayload
  | ResponseFunctionCallArgumentsDonePayload
  | ResponseOutputItemDonePayload
  | ResponseOutputTextDonePayload
  | ResponseContentPartDonePayload;

type ResponseSseEvent<TPayload extends ResponseSsePayload = ResponseSsePayload> = {
  event: TPayload['type'];
  payload: TPayload;
};

function createResponseSseEvent<TPayload extends ResponseSsePayload>(payload: TPayload): ResponseSseEvent<TPayload> {
  return { event: payload.type, payload };
}

type ToolCallStreamState = {
  argumentsText: string;
  completed: boolean;
  itemId: string;
  name: string;
  outputIndex: number;
  zeroArgumentInputEnded: boolean;
};

type ToolResultStreamState = {
  args: unknown;
  result: unknown;
  toolCallId: string;
  toolName?: string;
};

function getChunkPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return isRecord(value.payload) ? value.payload : value;
}

function stringifyResponsePayload(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value === undefined ? {} : value);
}

function stringifyFunctionCallArguments(value: unknown, fallback = ''): string {
  const serialized = value === undefined || value === null ? fallback : stringifyResponsePayload(value);
  return serialized || fallback || '{}';
}

function removeWhitespaceOutsideJsonStrings(value: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (const char of value) {
    if (escaped) {
      escaped = false;
      result += char;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (!inString && /\s/.test(char)) {
      continue;
    }

    result += char;
  }

  return result;
}

function getRemainingArgumentsDelta(current: string, canonical: string): string | null {
  if (!current) {
    return canonical;
  }

  if (canonical.startsWith(current)) {
    return canonical.slice(current.length);
  }

  const compactCurrent = removeWhitespaceOutsideJsonStrings(current);
  const compactCanonical = removeWhitespaceOutsideJsonStrings(canonical);
  if (compactCurrent && compactCanonical.startsWith(compactCurrent)) {
    return compactCanonical.slice(compactCurrent.length);
  }

  return null;
}

function isCompleteJsonString(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function serializeToolError(error: unknown) {
  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error };
}

function getToolCallStart(value: unknown) {
  if (!isRecord(value) || value.type !== 'tool-call-input-streaming-start') {
    return null;
  }

  const payload = getChunkPayload(value);
  const toolCallId = payload?.toolCallId;
  const toolName = payload?.toolName;
  if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
    return null;
  }

  return { toolCallId, toolName };
}

function getToolCallDelta(value: unknown) {
  if (!isRecord(value) || value.type !== 'tool-call-delta') {
    return null;
  }

  const payload = getChunkPayload(value);
  const toolCallId = payload?.toolCallId;
  // Mastra/AI SDK stream chunks have used different names for streamed tool
  // argument text across versions; normalize them to the Responses delta shape.
  const delta = payload?.argsTextDelta ?? payload?.inputTextDelta ?? payload?.argsDelta ?? payload?.delta;
  if (!payload || typeof toolCallId !== 'string' || typeof delta !== 'string') {
    return null;
  }

  return {
    toolCallId,
    toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
    delta,
  };
}

function getToolCall(value: unknown) {
  if (!isRecord(value) || value.type !== 'tool-call') {
    return null;
  }

  const payload = getChunkPayload(value);
  const toolCallId = payload?.toolCallId;
  const toolName = payload?.toolName;
  const args = payload?.args ?? payload?.input;
  if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
    return null;
  }

  return { toolCallId, toolName, args };
}

function getToolCallEnd(value: unknown) {
  if (!isRecord(value) || value.type !== 'tool-call-input-streaming-end') {
    return null;
  }

  const payload = getChunkPayload(value);
  const toolCallId = payload?.toolCallId;
  if (typeof toolCallId !== 'string') {
    return null;
  }

  return { toolCallId };
}

function getToolResult(value: unknown) {
  if (!isRecord(value) || (value.type !== 'tool-result' && value.type !== 'tool-error')) {
    return null;
  }

  const payload = getChunkPayload(value);
  const toolCallId = payload?.toolCallId;
  if (!payload || typeof toolCallId !== 'string') {
    return null;
  }

  const toolName = typeof payload.toolName === 'string' ? payload.toolName : undefined;
  const args = payload.args ?? payload.input;

  if (value.type === 'tool-error') {
    return { toolCallId, toolName, args, result: serializeToolError(payload.error) };
  }

  const outputValue = payload.result !== undefined ? payload.result : payload.output;
  const result = payload.isError ? serializeToolError(outputValue) : outputValue;

  return { toolCallId, toolName, args, result };
}

export function createResponseStreamEventTranslator(responseId: string) {
  // Keep emitted SSE terminal payloads and the final completed response output
  // aligned. Once a tool call is completed, later duplicate/canonical chunks are
  // ignored because Responses SSE has no replacement event for arguments.done.
  let text = '';
  let nextOutputIndex = 0;
  let textOutputIndex: number | null = null;
  const completedToolResultCallIds = new Set<string>();
  const pendingToolResults = new Map<string, ToolResultStreamState>();
  const toolCalls = new Map<string, ToolCallStreamState>();
  const outputItems = new Map<number, ResponseOutputItem>();

  const ensureTextOutputItem = (): { events: ResponseSseEvent[]; outputIndex: number } => {
    if (textOutputIndex !== null) {
      return { events: [], outputIndex: textOutputIndex };
    }

    textOutputIndex = nextOutputIndex++;
    return {
      outputIndex: textOutputIndex,
      events: [
        createResponseSseEvent({
          type: 'response.output_item.added',
          output_index: textOutputIndex,
          item: {
            id: responseId,
            type: 'message',
            role: 'assistant',
            status: 'in_progress',
            content: [],
          },
        }),
        createResponseSseEvent({
          type: 'response.content_part.added',
          output_index: textOutputIndex,
          content_index: 0,
          item_id: responseId,
          part: createOutputTextPart(''),
        }),
      ],
    };
  };

  const ensureToolCallItem = ({
    toolCallId,
    toolName,
  }: {
    toolCallId: string;
    toolName: string;
  }): { events: ResponseSseEvent[]; state: ToolCallStreamState } => {
    const existing = toolCalls.get(toolCallId);
    if (existing) {
      if (!existing.completed && toolName && existing.name !== toolName) {
        existing.name = toolName;
      }

      return { events: [], state: existing };
    }

    const state = {
      argumentsText: '',
      completed: false,
      itemId: toolCallId,
      name: toolName,
      outputIndex: nextOutputIndex++,
      zeroArgumentInputEnded: false,
    };
    toolCalls.set(toolCallId, state);

    return {
      state,
      events: [
        createResponseSseEvent({
          type: 'response.output_item.added',
          output_index: state.outputIndex,
          item: {
            id: state.itemId,
            type: 'function_call',
            call_id: toolCallId,
            name: toolName,
            arguments: '',
            status: 'in_progress',
          },
        }),
      ],
    };
  };

  const completeToolCallItem = ({
    events,
    state,
    toolCallId,
    toolName,
    args,
  }: {
    events: ResponseSseEvent[];
    state: ToolCallStreamState;
    toolCallId: string;
    toolName: string;
    args: string;
  }): ResponseSseEvent[] => {
    if (state.completed) {
      return events;
    }

    const item = {
      id: state.itemId,
      type: 'function_call' as const,
      call_id: toolCallId,
      name: toolName,
      arguments: args,
      status: 'completed' as const,
    };

    state.argumentsText = args;
    state.completed = true;
    outputItems.set(state.outputIndex, item);

    return [
      ...events,
      createResponseSseEvent({
        type: 'response.function_call_arguments.done',
        item_id: state.itemId,
        output_index: state.outputIndex,
        name: toolName,
        arguments: args,
      }),
      createResponseSseEvent({
        type: 'response.output_item.done',
        output_index: state.outputIndex,
        item,
      }),
    ];
  };

  const completeToolResultItem = ({
    events,
    toolResult,
  }: {
    events: ResponseSseEvent[];
    toolResult: ToolResultStreamState;
  }): ResponseSseEvent[] => {
    if (completedToolResultCallIds.has(toolResult.toolCallId)) {
      return events;
    }
    completedToolResultCallIds.add(toolResult.toolCallId);
    pendingToolResults.delete(toolResult.toolCallId);

    const outputIndex = nextOutputIndex++;
    const item = {
      id: getFunctionCallOutputItemId(toolResult.toolCallId),
      type: 'function_call_output' as const,
      call_id: toolResult.toolCallId,
      output: stringifyResponsePayload(toolResult.result),
    };
    outputItems.set(outputIndex, item);

    return [
      ...events,
      createResponseSseEvent({
        type: 'response.output_item.added',
        output_index: outputIndex,
        item,
      }),
      createResponseSseEvent({
        type: 'response.output_item.done',
        output_index: outputIndex,
        item,
      }),
    ];
  };

  return {
    get text() {
      return text;
    },

    getOutputItems({ text, status }: { text: string; status: ResponseObject['status'] }) {
      const items = new Map(outputItems);
      if (text) {
        const messageOutputIndex = textOutputIndex ?? nextOutputIndex;
        items.set(messageOutputIndex, createOutputMessage({ messageId: responseId, status, text }));
      }

      return [...items.entries()].sort(([left], [right]) => left - right).map(([, item]) => item);
    },

    consume(value: unknown): ResponseSseEvent[] {
      const textDelta = extractTextDelta(value);
      if (textDelta) {
        const { events, outputIndex } = ensureTextOutputItem();
        text += textDelta;
        return [
          ...events,
          createResponseSseEvent({
            type: 'response.output_text.delta',
            output_index: outputIndex,
            content_index: 0,
            item_id: responseId,
            delta: textDelta,
          }),
        ];
      }

      const toolCallStart = getToolCallStart(value);
      if (toolCallStart) {
        return ensureToolCallItem(toolCallStart).events;
      }

      const toolCallDelta = getToolCallDelta(value);
      if (toolCallDelta) {
        const existing = toolCalls.get(toolCallDelta.toolCallId);
        if (!existing && !toolCallDelta.toolName) {
          return [];
        }
        if (existing?.completed) {
          return [];
        }

        const ensured = ensureToolCallItem({
          toolCallId: toolCallDelta.toolCallId,
          toolName: toolCallDelta.toolName ?? existing!.name,
        });

        ensured.state.argumentsText += toolCallDelta.delta;
        ensured.state.zeroArgumentInputEnded = false;
        return [
          ...ensured.events,
          createResponseSseEvent({
            type: 'response.function_call_arguments.delta',
            item_id: ensured.state.itemId,
            output_index: ensured.state.outputIndex,
            delta: toolCallDelta.delta,
          }),
        ];
      }

      const toolCallEnd = getToolCallEnd(value);
      if (toolCallEnd) {
        const state = toolCalls.get(toolCallEnd.toolCallId);
        if (!state || state.completed) {
          return [];
        }

        state.zeroArgumentInputEnded = !state.argumentsText;
        return [];
      }

      const toolCall = getToolCall(value);
      if (toolCall) {
        const { events, state } = ensureToolCallItem(toolCall);
        const canonicalArgs = stringifyFunctionCallArguments(toolCall.args, state.argumentsText);
        if (state.completed) {
          const nextEvents = completeToolCallItem({
            events,
            state,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: canonicalArgs,
          });

          const pendingToolResult = pendingToolResults.get(toolCall.toolCallId);
          return pendingToolResult
            ? completeToolResultItem({ events: nextEvents, toolResult: pendingToolResult })
            : nextEvents;
        }

        const remainingArgsDelta = getRemainingArgumentsDelta(state.argumentsText, canonicalArgs);
        const args =
          remainingArgsDelta === null
            ? // If both strings are valid but disagree, keep the bytes already emitted
              // as deltas so arguments.done and response.output stay consistent.
              isCompleteJsonString(state.argumentsText)
              ? state.argumentsText
              : canonicalArgs
            : state.argumentsText + remainingArgsDelta;
        const nextEvents = remainingArgsDelta
          ? [
              ...events,
              createResponseSseEvent({
                type: 'response.function_call_arguments.delta',
                item_id: state.itemId,
                output_index: state.outputIndex,
                delta: remainingArgsDelta,
              }),
            ]
          : events;

        const completedEvents = completeToolCallItem({
          events: nextEvents,
          state,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args,
        });

        const pendingToolResult = pendingToolResults.get(toolCall.toolCallId);
        return pendingToolResult
          ? completeToolResultItem({ events: completedEvents, toolResult: pendingToolResult })
          : completedEvents;
      }

      const toolResult = getToolResult(value);
      if (toolResult) {
        const existingToolCallState = toolCalls.get(toolResult.toolCallId);
        if (!existingToolCallState && !toolResult.toolName) {
          return [];
        }

        const { events: toolCallEvents, state: toolCallState } = ensureToolCallItem({
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName ?? existingToolCallState!.name,
        });

        if (completedToolResultCallIds.has(toolResult.toolCallId)) {
          return [];
        }

        const events: ResponseSseEvent[] = [...toolCallEvents];
        if (!toolCallState.completed) {
          const args = stringifyFunctionCallArguments(toolResult.args, toolCallState.argumentsText || '{}');
          const hasZeroArgumentHint = toolCallState.zeroArgumentInputEnded && !toolCallState.argumentsText;
          if (
            toolResult.args === undefined &&
            !hasZeroArgumentHint &&
            (!toolCallState.argumentsText || !isCompleteJsonString(toolCallState.argumentsText))
          ) {
            pendingToolResults.set(toolResult.toolCallId, toolResult);
            return events;
          }

          events.push(
            ...completeToolCallItem({
              events: [],
              state: toolCallState,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName ?? toolCallState.name,
              args,
            }),
          );
        }

        return completeToolResultItem({ events, toolResult });
      }

      return [];
    },

    flushPendingToolResults(): ResponseSseEvent[] {
      const events: ResponseSseEvent[] = [];
      for (const toolResult of pendingToolResults.values()) {
        const toolCallState = toolCalls.get(toolResult.toolCallId);
        if (!toolCallState) {
          continue;
        }

        if (!toolCallState.completed) {
          const safeFallbackArgs = isCompleteJsonString(toolCallState.argumentsText)
            ? toolCallState.argumentsText
            : '{}';
          events.push(
            ...completeToolCallItem({
              events: [],
              state: toolCallState,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName ?? toolCallState.name,
              args: stringifyFunctionCallArguments(toolResult.args, safeFallbackArgs),
            }),
          );
        }

        events.push(...completeToolResultItem({ events: [], toolResult }));
      }

      return events;
    },

    completeText(text: string, completedItem: Extract<ResponseOutputItem, { type: 'message' }>): ResponseSseEvent[] {
      const { events, outputIndex } = ensureTextOutputItem();
      const completedTextItem = {
        ...completedItem,
        content: [createOutputTextPart(text)],
      };

      return [
        ...events,
        createResponseSseEvent({
          type: 'response.output_text.done',
          output_index: outputIndex,
          content_index: 0,
          item_id: responseId,
          text,
        }),
        createResponseSseEvent({
          type: 'response.content_part.done',
          output_index: outputIndex,
          content_index: 0,
          item_id: responseId,
          part: createOutputTextPart(text),
        }),
        createResponseSseEvent({
          type: 'response.output_item.done',
          output_index: outputIndex,
          item: completedTextItem,
        }),
      ];
    },
  };
}
