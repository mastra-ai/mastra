import { A2AError } from '@mastra/core/a2a';

import type { JSONRPCError, JSONRPCResponse, Message, Part } from '@mastra/core/a2a';
import type { CoreMessage } from '@mastra/core/llm';
import type { IMastraLogger } from '@mastra/core/logger';

export function normalizeError(
  error: any,
  reqId: number | string | null,
  taskId?: string,
  logger?: IMastraLogger,
): JSONRPCResponse<null, unknown> {
  let a2aError: A2AError;
  if (error instanceof A2AError) {
    a2aError = error;
  } else if (error instanceof Error) {
    // Generic JS error
    a2aError = A2AError.internalError(error.message, { stack: error.stack });
  } else {
    // Unknown error type
    a2aError = A2AError.internalError('An unknown error occurred.', error);
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
    throw A2AError.internalError('Cannot create success response for null ID.');
  }

  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  };
}

export function convertToCoreMessage(message: Message): CoreMessage {
  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.parts.map(msg => convertToCoreMessagePart(msg)),
  };
}

function convertToCoreMessagePart(part: Part) {
  switch (part.type) {
    case 'text':
      return {
        type: 'text',
        text: part.text,
      } as const;
    case 'file':
      return {
        type: 'file',
        data: new URL(part.file.uri!),
        mimeType: part.file.mimeType!,
      } as const;
    case 'data':
      throw new Error('Data parts are not supported in core messages');
  }
}
