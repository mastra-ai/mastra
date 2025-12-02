export declare class AbortError extends Error {
    constructor();
}
export declare class WatchError extends Error {
    constructor(message?: string);
}
export declare class ConnectionTimeoutError extends Error {
    constructor();
}
export declare class SocketTimeoutError extends Error {
    constructor(timeout: number);
}
export declare class ClientClosedError extends Error {
    constructor();
}
export declare class ClientOfflineError extends Error {
    constructor();
}
export declare class DisconnectsClientError extends Error {
    constructor();
}
export declare class SocketClosedUnexpectedlyError extends Error {
    constructor();
}
export declare class RootNodesUnavailableError extends Error {
    constructor();
}
export declare class ReconnectStrategyError extends Error {
    originalError: Error;
    socketError: unknown;
    constructor(originalError: Error, socketError: unknown);
}
export declare class ErrorReply extends Error {
}
export declare class SimpleError extends ErrorReply {
}
export declare class BlobError extends ErrorReply {
}
export declare class TimeoutError extends Error {
}
export declare class MultiErrorReply extends ErrorReply {
    replies: Array<ErrorReply>;
    errorIndexes: Array<number>;
    constructor(replies: Array<ErrorReply>, errorIndexes: Array<number>);
    errors(): Generator<ErrorReply, void, unknown>;
}
//# sourceMappingURL=errors.d.ts.map