export interface LogParams {
    module: string;
    message: string;
    args?: Record<string, unknown>;
}
export type ErrorLogParams = LogParams & {
    err: Error;
};
export type WarnLogParams = LogParams & {
    err?: Error;
};
export interface Logger {
    trace(params: LogParams): void;
    debug(params: LogParams): void;
    info(params: LogParams): void;
    warn(params: WarnLogParams): void;
    error(params: ErrorLogParams): void;
}
export declare class DefaultLogger implements Logger {
    trace({ module, message, args }: LogParams): void;
    debug({ module, message, args }: LogParams): void;
    info({ module, message, args }: LogParams): void;
    warn({ module, message, args, err }: WarnLogParams): void;
    error({ module, message, args, err }: ErrorLogParams): void;
}
export type LogWriterParams<Method extends keyof Logger> = Omit<Parameters<Logger[Method]>[0], 'module'> & {
    module?: string;
};
export declare class LogWriter {
    private readonly logger;
    private readonly module;
    private readonly logLevel;
    constructor(logger: Logger, module: string, logLevel?: ClickHouseLogLevel);
    trace(params: LogWriterParams<'trace'>): void;
    debug(params: LogWriterParams<'debug'>): void;
    info(params: LogWriterParams<'info'>): void;
    warn(params: LogWriterParams<'warn'>): void;
    error(params: LogWriterParams<'error'>): void;
}
export declare enum ClickHouseLogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    OFF = 127
}
