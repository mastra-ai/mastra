interface ParsedClickHouseError {
    message: string;
    code: string;
    type?: string;
}
/** An error that is thrown by the ClickHouse server. */
export declare class ClickHouseError extends Error {
    readonly code: string;
    readonly type: string | undefined;
    constructor({ message, code, type }: ParsedClickHouseError);
}
export declare function parseError(input: string | Error): ClickHouseError | Error;
/** Captures the current stack trace from the sync context before going async.
 *  It is necessary since the majority of the stack trace is lost when an async callback is called. */
export declare function getCurrentStackTrace(): string;
/** Having the stack trace produced by the {@link getCurrentStackTrace} function,
 *  add it to an arbitrary error stack trace. No-op if there is no additional stack trace to add.
 *  It could happen if this feature was disabled due to its performance overhead. */
export declare function enhanceStackTrace<E extends Error>(err: E, stackTrace: string | undefined): E;
export {};
