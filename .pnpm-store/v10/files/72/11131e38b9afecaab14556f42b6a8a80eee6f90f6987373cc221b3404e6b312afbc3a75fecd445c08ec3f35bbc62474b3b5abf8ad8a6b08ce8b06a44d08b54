import { LogLevel } from './constants.js';
import { MastraLogger } from './logger.js';
import type { LoggerTransport } from './transport.js';
export declare const createLogger: (options: {
    name?: string;
    level?: LogLevel;
    transports?: Record<string, LoggerTransport>;
}) => ConsoleLogger;
export declare class ConsoleLogger extends MastraLogger {
    constructor(options?: {
        name?: string;
        level?: LogLevel;
    });
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    listLogs(_transportId: string, _params?: {
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: never[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
    listLogsByRunId(_args: {
        transportId: string;
        runId: string;
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: never[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
}
//# sourceMappingURL=default-logger.d.ts.map