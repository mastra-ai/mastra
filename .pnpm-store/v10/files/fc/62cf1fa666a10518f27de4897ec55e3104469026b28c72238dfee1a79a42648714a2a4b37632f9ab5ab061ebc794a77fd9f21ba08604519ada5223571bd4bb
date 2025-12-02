import type { JSONRPCError, KnownErrorCode } from './types.js';
/**
 * Custom error class for A2A server operations, incorporating JSON-RPC error codes.
 */
export declare class MastraA2AError extends Error {
    code: KnownErrorCode | number;
    data?: unknown;
    taskId?: string;
    constructor(code: KnownErrorCode | number, message: string, data?: unknown, taskId?: string);
    /**
     * Formats the error into a standard JSON-RPC error object structure.
     */
    toJSONRPCError(): JSONRPCError<unknown>;
    static parseError(message: string, data?: unknown): MastraA2AError;
    static invalidRequest(message: string, data?: unknown): MastraA2AError;
    static methodNotFound(method: string): MastraA2AError;
    static invalidParams(message: string, data?: unknown): MastraA2AError;
    static internalError(message: string, data?: unknown): MastraA2AError;
    static taskNotFound(taskId: string): MastraA2AError;
    static taskNotCancelable(taskId: string): MastraA2AError;
    static pushNotificationNotSupported(): MastraA2AError;
    static unsupportedOperation(operation: string): MastraA2AError;
}
//# sourceMappingURL=error.d.ts.map