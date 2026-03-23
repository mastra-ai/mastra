import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ResponseInputMessage, ResponseObject, ResponseTool } from '../schemas/responses';
import type { StoredResponseMatch, ProviderMetadataLike, UsageLike } from './responses.storage';

export type InputMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function normalizeMessageContent(content: ResponseInputMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map(part => part.text).join('');
}

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

function getToolKey(toolCallId: string | null, messageId: string, partIndex: number) {
  return toolCallId ?? `${messageId}:${partIndex}`;
}

/**
 * Collects tool invocations/results from response messages into a compact response-friendly shape.
 */
export function extractResponseTools(messages: MastraDBMessage[] | undefined): ResponseTool[] {
  if (!messages?.length) {
    return [];
  }

  const tools = new Map<string, ResponseTool>();

  for (const message of messages) {
    const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];

    for (const [partIndex, part] of parts.entries()) {
      if (!isRecord(part) || part.type !== 'tool-invocation' || !isRecord(part.toolInvocation)) {
        continue;
      }

      const invocation = part.toolInvocation;
      const toolCallId = typeof invocation.toolCallId === 'string' ? invocation.toolCallId : null;
      const key = getToolKey(toolCallId, message.id, partIndex);
      const existingTool = tools.get(key);

      tools.set(key, {
        type: 'tool',
        toolCallId,
        toolName: typeof invocation.toolName === 'string' ? invocation.toolName : (existingTool?.toolName ?? null),
        state: typeof invocation.state === 'string' ? invocation.state : (existingTool?.state ?? null),
        args: invocation.args ?? existingTool?.args,
        result: invocation.result ?? existingTool?.result,
      });
    }
  }

  return [...tools.values()];
}

/**
 * Creates a stable assistant-message-backed response identifier.
 */
export function createMessageId() {
  return `msg_${randomUUID()}`;
}

/**
 * Normalizes incoming Responses API input into plain text messages for agent execution.
 */
export function normalizeInputToMessages(input: ResponseInputMessage[] | string): InputMessage[] {
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
 * Builds a completed response object from the final response state.
 */
export function buildResponseObject({
  responseId,
  outputMessageId,
  model,
  createdAt,
  completedAt,
  status,
  text,
  usage,
  instructions,
  previousResponseId,
  providerOptions,
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
  previousResponseId?: string;
  providerOptions?: ProviderMetadataLike;
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
    output: [
      {
        id: outputMessageId,
        type: 'message',
        role: 'assistant',
        status: status === 'completed' ? 'completed' : 'incomplete',
        content: [createOutputTextPart(text)],
      },
    ],
    usage: toResponseUsage(usage),
    error: null,
    incomplete_details: null,
    instructions: instructions ?? null,
    previous_response_id: previousResponseId ?? null,
    providerOptions,
    tools: extractResponseTools(messages),
    store,
  };
}

/**
 * Builds the initial in-progress response object emitted at stream start.
 */
export function buildCreatedResponseObject({
  responseId,
  model,
  createdAt,
  instructions,
  previousResponseId,
  store,
}: {
  responseId: string;
  model: string;
  createdAt: number;
  instructions?: string;
  previousResponseId?: string;
  store: boolean;
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
    previous_response_id: previousResponseId ?? null,
    tools: [],
    store,
  };
}

/**
 * Reconstructs a stored response object from the assistant message that owns the turn.
 */
export function buildStoredResponseObject(match: StoredResponseMatch): ResponseObject {
  return {
    id: match.message.id,
    object: 'response',
    created_at: match.metadata.createdAt,
    completed_at: match.metadata.completedAt,
    model: match.metadata.model,
    status: match.metadata.status,
    output: [
      {
        id: match.message.id,
        type: 'message',
        role: 'assistant',
        status: match.metadata.status === 'completed' ? 'completed' : 'incomplete',
        content: [createOutputTextPart(getMessageText(match.message))],
      },
    ],
    usage: match.metadata.usage,
    error: null,
    incomplete_details: null,
    instructions: match.metadata.instructions ?? null,
    previous_response_id: match.metadata.previousResponseId ?? null,
    providerOptions: match.metadata.providerOptions,
    tools: extractResponseTools(match.messages),
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

  if (chunk.type === 'text-delta' && typeof chunk.payload?.text === 'string') {
    return chunk.payload.text;
  }

  if (chunk.type === 'text-delta' && typeof chunk.textDelta === 'string') {
    return chunk.textDelta;
  }

  if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
    return chunk.text;
  }

  return null;
}
