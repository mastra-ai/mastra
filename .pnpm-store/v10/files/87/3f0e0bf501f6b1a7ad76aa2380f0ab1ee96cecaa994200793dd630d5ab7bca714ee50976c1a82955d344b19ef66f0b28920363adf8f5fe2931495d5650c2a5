import type { JSONRPCMessage, Message, Task } from '@a2a-js/sdk';
/**
 * Represents a JSON-RPC error object.
 */
export interface JSONRPCError<Data = unknown | null, Code = number> {
    /**
     * A number indicating the error type that occurred.
     */
    code: Code;
    /**
     * A string providing a short description of the error.
     */
    message: string;
    /**
     * Optional additional data about the error.
     * @default null
     */
    data?: Data;
}
/**
 * Represents a JSON-RPC response object.
 */
export interface JSONRPCResponse<R = unknown | null, E = unknown | null> extends JSONRPCMessage {
    /**
     * The result of the method invocation. Required on success.
     * Should be null or omitted if an error occurred.
     * @default null
     */
    result?: R;
    /**
     * An error object if an error occurred during the request. Required on failure.
     * Should be null or omitted if the request was successful.
     * @default null
     */
    error?: JSONRPCError<E> | null;
}
export interface TaskContext {
    /**
     * The current state of the task when the handler is invoked or resumed.
     * Note: This is a snapshot. For the absolute latest state during async operations,
     * the handler might need to reload the task via the store.
     */
    task: Task;
    /**
     * The specific user message that triggered this handler invocation or resumption.
     */
    userMessage: Message;
    /**
     * Function to check if cancellation has been requested for this task.
     * Handlers should ideally check this periodically during long-running operations.
     * @returns {boolean} True if cancellation has been requested, false otherwise.
     */
    isCancelled(): boolean;
    /**
     * The message history associated with the task up to the point the handler is invoked.
     * Optional, as history might not always be available or relevant.
     */
    history?: Message[];
}
/** Error code for JSON Parse Error (-32700). Invalid JSON was received by the server. */
export declare const ErrorCodeParseError = -32700;
export type ErrorCodeParseError = typeof ErrorCodeParseError;
/** Error code for Invalid Request (-32600). The JSON sent is not a valid Request object. */
export declare const ErrorCodeInvalidRequest = -32600;
export type ErrorCodeInvalidRequest = typeof ErrorCodeInvalidRequest;
/** Error code for Method Not Found (-32601). The method does not exist / is not available. */
export declare const ErrorCodeMethodNotFound = -32601;
export type ErrorCodeMethodNotFound = typeof ErrorCodeMethodNotFound;
/** Error code for Invalid Params (-32602). Invalid method parameter(s). */
export declare const ErrorCodeInvalidParams = -32602;
export type ErrorCodeInvalidParams = typeof ErrorCodeInvalidParams;
/** Error code for Internal Error (-32603). Internal JSON-RPC error. */
export declare const ErrorCodeInternalError = -32603;
export type ErrorCodeInternalError = typeof ErrorCodeInternalError;
/** Error code for Task Not Found (-32001). The specified task was not found. */
export declare const ErrorCodeTaskNotFound = -32001;
export type ErrorCodeTaskNotFound = typeof ErrorCodeTaskNotFound;
/** Error code for Task Not Cancelable (-32002). The specified task cannot be canceled. */
export declare const ErrorCodeTaskNotCancelable = -32002;
export type ErrorCodeTaskNotCancelable = typeof ErrorCodeTaskNotCancelable;
/** Error code for Push Notification Not Supported (-32003). Push Notifications are not supported for this operation or agent. */
export declare const ErrorCodePushNotificationNotSupported = -32003;
export type ErrorCodePushNotificationNotSupported = typeof ErrorCodePushNotificationNotSupported;
/** Error code for Unsupported Operation (-32004). The requested operation is not supported by the agent. */
export declare const ErrorCodeUnsupportedOperation = -32004;
export type ErrorCodeUnsupportedOperation = typeof ErrorCodeUnsupportedOperation;
/**
 * Union of all well-known A2A and standard JSON-RPC error codes defined in this schema.
 * Use this type for checking against specific error codes. A server might theoretically
 * use other codes within the valid JSON-RPC ranges.
 */
export type KnownErrorCode = typeof ErrorCodeParseError | typeof ErrorCodeInvalidRequest | typeof ErrorCodeMethodNotFound | typeof ErrorCodeInvalidParams | typeof ErrorCodeInternalError | typeof ErrorCodeTaskNotFound | typeof ErrorCodeTaskNotCancelable | typeof ErrorCodePushNotificationNotSupported | typeof ErrorCodeUnsupportedOperation;
//# sourceMappingURL=types.d.ts.map