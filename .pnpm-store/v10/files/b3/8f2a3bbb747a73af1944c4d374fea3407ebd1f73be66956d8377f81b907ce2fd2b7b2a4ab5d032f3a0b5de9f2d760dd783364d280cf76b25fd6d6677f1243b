/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export type LogLevelString = 'debug' | 'verbose' | 'info' | 'warn' | 'error' | 'silent';
export interface LogOptions {
    level: LogLevelString;
}
export type LogCallback = (callbackParams: LogCallbackParams) => void;
export interface LogCallbackParams {
    level: LogLevelString;
    message: string;
    args: unknown[];
    type: string;
}
/**
 * A container for all of the Logger instances
 */
export declare const instances: Logger[];
/**
 * The JS SDK supports 5 log levels and also allows a user the ability to
 * silence the logs altogether.
 *
 * The order is a follows:
 * DEBUG < VERBOSE < INFO < WARN < ERROR
 *
 * All of the log types above the current log level will be captured (i.e. if
 * you set the log level to `INFO`, errors will still be logged, but `DEBUG` and
 * `VERBOSE` logs will not)
 */
export declare enum LogLevel {
    DEBUG = 0,
    VERBOSE = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    SILENT = 5
}
/**
 * We allow users the ability to pass their own log handler. We will pass the
 * type of log, the current log level, and any other arguments passed (i.e. the
 * messages that the user wants to log) to this function.
 */
export type LogHandler = (loggerInstance: Logger, logType: LogLevel, ...args: unknown[]) => void;
export declare class Logger {
    name: string;
    /**
     * Gives you an instance of a Logger to capture messages according to
     * Firebase's logging scheme.
     *
     * @param name The name that the logs will be associated with
     */
    constructor(name: string);
    /**
     * The log level of the given Logger instance.
     */
    private _logLevel;
    get logLevel(): LogLevel;
    set logLevel(val: LogLevel);
    setLogLevel(val: LogLevel | LogLevelString): void;
    /**
     * The main (internal) log handler for the Logger instance.
     * Can be set to a new function in internal package code but not by user.
     */
    private _logHandler;
    get logHandler(): LogHandler;
    set logHandler(val: LogHandler);
    /**
     * The optional, additional, user-defined log handler for the Logger instance.
     */
    private _userLogHandler;
    get userLogHandler(): LogHandler | null;
    set userLogHandler(val: LogHandler | null);
    /**
     * The functions below are all based on the `console` interface
     */
    debug(...args: unknown[]): void;
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}
export declare function setLogLevel(level: LogLevelString | LogLevel): void;
export declare function setUserLogHandler(logCallback: LogCallback | null, options?: LogOptions): void;
