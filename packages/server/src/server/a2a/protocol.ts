import { MastraA2AError } from '@mastra/core/a2a';

import type { JSONRPCError, JSONRPCResponse } from '@mastra/core/a2a';
import type { CoreMessage } from '@mastra/core/llm';
import type { IMastraLogger } from '@mastra/core/logger';
import type { A2AWireMessage, A2AWirePart } from './wire-types';

export function normalizeError(
  error: any,
  reqId: number | string | null,
  taskId?: string,
  logger?: IMastraLogger,
): JSONRPCResponse<null, unknown> {
  let a2aError: MastraA2AError;
  if (error instanceof MastraA2AError) {
    a2aError = error;
  } else if (error instanceof Error) {
    // Generic JS error
    a2aError = MastraA2AError.internalError(error.message, { stack: error.stack });
  } else {
    // Unknown error type
    a2aError = MastraA2AError.internalError('An unknown error occurred.', error);
  }

  // Ensure Task ID context is present if possible
  if (taskId && !a2aError.taskId) {
    a2aError.taskId = taskId;
  }

  logger?.error(`Error processing request (Task: ${a2aError.taskId ?? 'N/A'}, ReqID: ${reqId ?? 'N/A'}):`, a2aError);

  return createErrorResponse(reqId, a2aError.toJSONRPCError());
}

export function createErrorResponse(
  id: number | string | null,
  error: JSONRPCError<unknown>,
): JSONRPCResponse<null, unknown> {
  // For errors, ID should be the same as request ID, or null if that couldn't be determined
  return {
    jsonrpc: '2.0',
    id: id, // Can be null if request ID was invalid/missing
    error: error,
  };
}

export function createSuccessResponse<T>(id: number | string | null, result: T): JSONRPCResponse<T> {
  if (!id) {
    // This shouldn't happen for methods that expect a response, but safeguard
    throw MastraA2AError.internalError('Cannot create success response for null ID.');
  }

  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  };
}

export function convertToCoreMessage(message: A2AWireMessage): CoreMessage {
  return {
    role: message.role === 'ROLE_USER' ? 'user' : 'assistant',
    content: message.parts.map(part => convertToCoreMessagePart(part)),
  };
}

function convertToCoreMessagePart(part: A2AWirePart) {
  // v1 wire parts are discriminated by which content key is present
  // (`text` | `raw` | `url` | `data`) rather than a `kind` field.
  if ('text' in part) {
    return {
      type: 'text',
      text: part.text,
    } as const;
  }
  if ('url' in part) {
    return {
      type: 'file',
      data: new URL(part.url),
      mimeType: part.mediaType!,
    } as const;
  }
  if ('raw' in part) {
    return {
      type: 'file',
      data: part.raw,
      mimeType: part.mediaType!,
    } as const;
  }
  // Data parts have no CoreMessage equivalent.
  throw new Error('Data parts are not supported in core messages');
}
