import {
  ErrorCodeContentTypeNotSupported,
  ErrorCodeExtendedAgentCardNotConfigured,
  ErrorCodeParseError,
  ErrorCodeExtensionSupportRequired,
  ErrorCodeInvalidRequest,
  ErrorCodeInvalidAgentResponse,
  ErrorCodeMethodNotFound,
  ErrorCodePushNotificationNotSupported,
  ErrorCodeTaskNotCancelable,
  ErrorCodeTaskNotFound,
  ErrorCodeUnsupportedOperation,
  ErrorCodeInvalidParams,
  ErrorCodeInternalError,
  ErrorCodeVersionNotSupported,
} from './types';
import type { JSONRPCError, KnownErrorCode } from './types';

/**
 * Custom error class for A2A server operations, incorporating JSON-RPC error codes.
 */
export class MastraA2AError extends Error {
  public code: KnownErrorCode | number;
  public data?: unknown;
  public taskId?: string; // Optional task ID context

  constructor(code: KnownErrorCode | number, message: string, data?: unknown, taskId?: string) {
    super(message);
    this.name = 'MastraA2AError';
    this.code = code;
    this.data = data;
    this.taskId = taskId; // Store associated task ID if provided
  }

  /**
   * Formats the error into a standard JSON-RPC error object structure.
   */
  toJSONRPCError(): JSONRPCError<unknown> {
    const errorObject: JSONRPCError<unknown> = {
      code: this.code,
      message: this.message,
    };
    if (this.data !== undefined) {
      errorObject.data = this.data;
    }
    return errorObject;
  }

  // Static factory methods for common errors

  static parseError(message: string, data?: unknown): MastraA2AError {
    return new MastraA2AError(ErrorCodeParseError, message, data);
  }

  static invalidRequest(message: string, data?: unknown): MastraA2AError {
    return new MastraA2AError(ErrorCodeInvalidRequest, message, data);
  }

  static methodNotFound(method: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeMethodNotFound, `Method not found: ${method}`);
  }

  static invalidParams(message: string, data?: unknown): MastraA2AError {
    return new MastraA2AError(ErrorCodeInvalidParams, message, data);
  }

  static internalError(message: string, data?: unknown): MastraA2AError {
    return new MastraA2AError(ErrorCodeInternalError, message, data);
  }

  static taskNotFound(taskId: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeTaskNotFound, `Task not found: ${taskId}`, undefined, taskId);
  }

  static taskNotCancelable(taskId: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeTaskNotCancelable, `Task not cancelable: ${taskId}`, undefined, taskId);
  }

  static pushNotificationNotSupported(): MastraA2AError {
    return new MastraA2AError(ErrorCodePushNotificationNotSupported, 'Push Notification is not supported');
  }

  static unsupportedOperation(operation: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeUnsupportedOperation, `Unsupported operation: ${operation}`);
  }

  static contentTypeNotSupported(contentType: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeContentTypeNotSupported, `Content type not supported: ${contentType}`, {
      contentType,
    });
  }

  static invalidAgentResponse(message: string, data?: unknown): MastraA2AError {
    return new MastraA2AError(ErrorCodeInvalidAgentResponse, message, data);
  }

  static extendedAgentCardNotConfigured(): MastraA2AError {
    return new MastraA2AError(ErrorCodeExtendedAgentCardNotConfigured, 'Extended agent card is not configured');
  }

  static extensionSupportRequired(extension?: string): MastraA2AError {
    return new MastraA2AError(
      ErrorCodeExtensionSupportRequired,
      extension ? `Extension support required: ${extension}` : 'Extension support required',
      extension ? { extension } : undefined,
    );
  }

  static versionNotSupported(version: string): MastraA2AError {
    return new MastraA2AError(ErrorCodeVersionNotSupported, `Version not supported: ${version}`, { version });
  }
}
