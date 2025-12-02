import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { ArrayItemType } from './type-utils.js';
export declare const LOG_LEVELS: readonly ["query", "error"];
export type LogLevel = ArrayItemType<typeof LOG_LEVELS>;
export interface QueryLogEvent {
    readonly level: 'query';
    readonly isStream?: boolean;
    readonly query: CompiledQuery;
    readonly queryDurationMillis: number;
}
export interface ErrorLogEvent {
    readonly level: 'error';
    readonly error: unknown;
    readonly query: CompiledQuery;
    readonly queryDurationMillis: number;
}
export type LogEvent = QueryLogEvent | ErrorLogEvent;
export type Logger = (event: LogEvent) => void | Promise<void>;
export type LogConfig = ReadonlyArray<LogLevel> | Logger;
export declare class Log {
    #private;
    constructor(config: LogConfig);
    isLevelEnabled(level: LogLevel): boolean;
    query(getEvent: () => QueryLogEvent): Promise<void>;
    error(getEvent: () => ErrorLogEvent): Promise<void>;
}
