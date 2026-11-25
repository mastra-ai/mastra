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
    ([
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
      'tool-call-resumed',
      'tool-call',
      'tool-result',
      'tool-error',
      'tool-output-denied',
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
    ].includes(chunk.type) ||
      chunk.type.startsWith('background-task-'))
  );
};

// The default error serialization streamed to chat clients is an allow-list:
// only these fields, and only when they hold primitive values, reach the
// client. Everything else on an error stays on the server — `stack` (absolute
// file paths, usernames, code layout), APICallError.requestBodyValues (the
// agent's system prompt), response bodies/headers, `url`, and any field a
// provider or library adds later. Callers that want richer diagnostics should
// pass their own `onError` to chatRoute / handleChatStream, which receives the
// original error unchanged.
//
// `type`, `status` and `param` cover provider error bodies that reach the stream
// as plain objects: Anthropic `{ type: 'overloaded_error', message }`, OpenAI
// `{ message, type, param, code }`, Google `{ code, message, status }`.
// A nested `error` (OpenAI Responses `{ type: 'error', error: { ... } }`, or a
// thrown `{ error: 'quota exceeded' }`) is kept as a string or picked like `cause`.
const SAFE_ERROR_FIELDS = [
  'name',
  'message',
  'code',
  'id',
  'domain',
  'category',
  'statusCode',
  'isRetryable',
  'type',
  'status',
  'param',
] as const;
const NESTED_ERROR_FIELDS = ['cause', 'error'] as const;
const MAX_CAUSE_DEPTH = 3;

function pickSafeErrorFields(error: object, depth: number): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const field of SAFE_ERROR_FIELDS) {
    const value = (error as Record<string, unknown>)[field];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[field] = value;
    }
  }
  for (const field of NESTED_ERROR_FIELDS) {
    const nested = (error as Record<string, unknown>)[field];
    if (field === 'error' && typeof nested === 'string') {
      safe[field] = nested;
    } else if (typeof nested === 'object' && nested !== null && depth < MAX_CAUSE_DEPTH) {
      const safeNested = pickSafeErrorFields(nested, depth + 1);
      if (Object.keys(safeNested).length > 0) safe[field] = safeNested;
    }
  }
  return safe;
}

export function safeParseErrorObject(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }

  try {
    const safe = pickSafeErrorFields(obj, 0);
    // A bare Error (nothing safe beyond name/message, no cause) keeps its
    // familiar `Name: message` rendering. Fields like `cause` and `code` can be
    // non-enumerable, so check the picked fields rather than Object.keys().
    if (
      obj instanceof Error &&
      typeof (obj as { toJSON?: unknown }).toJSON !== 'function' &&
      Object.keys(safe).every(key => key === 'name' || key === 'message')
    ) {
      return `${obj.name}: ${obj.message}`;
    }
    return Object.keys(safe).length > 0 ? JSON.stringify(safe) : 'Unknown error';
  } catch {
    return 'Unknown error';
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

export const toUIDataChunk = ({ type, data, id, transient }: DataChunkType): DataChunkType => ({
  type,
  data,
  ...(id !== undefined && { id }),
  ...(transient !== undefined && { transient }),
});
