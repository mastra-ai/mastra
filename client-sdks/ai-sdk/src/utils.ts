import type { ChunkType, DataChunkType, NetworkChunkType, OutputSchema } from '@mastra/core/stream';

export const isDataChunkType = (chunk: any): chunk is DataChunkType => {
  return chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type?.startsWith('data-');
};

export const isMastraTextStreamChunk = (chunk: any): chunk is ChunkType<OutputSchema> => {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'type' in chunk &&
    typeof chunk.type === 'string' &&
    [
      'text-start',
      'text-delta',
      'text-end',
      'reasoning-start',
      'reasoning-delta',
      'reasoning-end',
      'file',
      'source',
      'tool-input-start',
      'tool-input-delta',
      'tool-call-approval',
      'tool-call-suspended',
      'tool-call',
      'tool-result',
      'tool-error',
      'error',
      'start-step',
      'finish-step',
      'start',
      'finish',
      'abort',
      'tool-input-end',
      'object',
      'tripwire',
      'raw',
    ].includes(chunk.type)
  );
};

// Fields on AI SDK error classes (APICallError, InvalidPromptError,
// InvalidResponseDataError, ...) that can carry the request/response payload.
// The most dangerous is APICallError.requestBodyValues, which holds the full
// request body sent to the provider — including the agent's system prompt.
// These get stripped from the default error serialization so an unhandled
// LLM failure can't leak the system prompt back to the chat client. Callers
// that want richer diagnostics should pass their own `onError` to chatRoute /
// handleChatStream and serialize as they see fit.
const REDACTED_ERROR_FIELDS = new Set(['requestBodyValues', 'responseBody', 'responseHeaders', 'data', 'prompt']);

export function safeParseErrorObject(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }

  try {
    const stringified = JSON.stringify(obj, (key, value) => (REDACTED_ERROR_FIELDS.has(key) ? undefined : value));
    // If JSON.stringify returns "{}", fall back to String() for better representation
    if (stringified === '{}' || stringified === undefined) {
      return String(obj);
    }
    return stringified;
  } catch {
    // Fallback to String() if JSON.stringify fails (e.g., circular references)
    return String(obj);
  }
}

export const isAgentExecutionDataChunkType = (
  chunk: any,
): chunk is Omit<NetworkChunkType, 'payload'> & { payload: DataChunkType } => {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'type' in chunk &&
    chunk.type?.startsWith('agent-execution-event-') &&
    'payload' in chunk &&
    typeof chunk.payload === 'object' &&
    'type' in chunk.payload &&
    chunk.payload.type?.startsWith('data-')
  );
};

export const isWorkflowExecutionDataChunkType = (
  chunk: any,
): chunk is Omit<NetworkChunkType, 'payload'> & { payload: DataChunkType } => {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'type' in chunk &&
    chunk.type?.startsWith('workflow-execution-event-') &&
    'payload' in chunk &&
    typeof chunk.payload === 'object' &&
    'type' in chunk.payload &&
    chunk.payload.type?.startsWith('data-')
  );
};
