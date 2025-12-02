import { ConvexError, Value } from "../values/index.js";
import { FunctionFailure } from "./sync/function_result.js";
export type UdfType = "query" | "mutation" | "action" | "any";
export type LogLevel = "debug" | "info" | "warn" | "error";
/**
 * A logger that can be used to log messages. By default, this is a wrapper
 * around `console`, but can be configured to not log at all or to log somewhere
 * else.
 */
export type Logger = {
    logVerbose(...args: any[]): void;
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
};
export declare class DefaultLogger implements Logger {
    private _onLogLineFuncs;
    private _verbose;
    constructor(options: {
        verbose: boolean;
    });
    addLogLineListener(func: (level: LogLevel, ...args: any[]) => void): () => void;
    logVerbose(...args: any[]): void;
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}
export declare function instantiateDefaultLogger(options: {
    verbose: boolean;
}): Logger;
export declare function instantiateNoopLogger(options: {
    verbose: boolean;
}): Logger;
export declare function logForFunction(logger: Logger, type: "info" | "error", source: UdfType, udfPath: string, message: string | {
    errorData: Value;
}): void;
export declare function logFatalError(logger: Logger, message: string): Error;
export declare function createHybridErrorStacktrace(source: UdfType, udfPath: string, result: FunctionFailure): string;
export declare function forwardData(result: FunctionFailure, error: ConvexError<string>): ConvexError<string>;
//# sourceMappingURL=logging.d.ts.map