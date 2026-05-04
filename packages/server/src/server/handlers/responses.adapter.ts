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

  return JSON.stringify(value ?? {});
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
    arguments: stringifyToolPayload(args),
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
          itemId: `${message.id}:${partIndex}:call`,
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
          itemId: `${message.id}:${partIndex}:output`,
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

/**
 * Maps the stored Mastra messages for one response turn back into OpenAI-style
 * `response.output` items, preserving tool/message ordering from the thread.
 */
export function mapMastraMessagesToResponseOutputItems({
  messages,
  outputMessageId,
  status,
  fallbackText,
}: {
  messages: MastraDBMessage[] | undefined;
  outputMessageId: string;
  status: ResponseObject['status'];
  fallbackText: string;
}): ResponseOutputItem[] {
  if (!messages?.length) {
    return [createOutputMessage({ messageId: outputMessageId, status, text: fallbackText })];
  }

  const output: ResponseOutputItem[] = [];
  const lastAssistantIndex = [...messages].map(message => message.role).lastIndexOf('assistant');
  const toolResultCallIds = collectToolResultCallIds(messages);
  const emittedCallIds = new Set<string>();
  const emittedResultCallIds = new Set<string>();

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
      output.push(
        createOutputMessage({
          messageId: messageIndex === lastAssistantIndex ? outputMessageId : message.id,
          status,
          text,
        }),
      );
    }
  }

  if (!output.some(item => item.type === 'message') && fallbackText) {
    output.push(createOutputMessage({ messageId: outputMessageId, status, text: fallbackText }));
  }

  return output;
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
