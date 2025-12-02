import type { MastraError } from '../error/index.js';
import type { LogLevel } from './constants.js';
import type { IMastraLogger } from './logger.js';
import type { LoggerTransport } from './transport.js';
export declare class MultiLogger implements IMastraLogger {
    private loggers;
    constructor(loggers: IMastraLogger[]);
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    trackException(error: MastraError): void;
    getTransports(): Map<string, LoggerTransport>;
    listLogs(transportId: string, params?: {
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        returnPaginationResults?: boolean;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: import("./transport").BaseLogMessage[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
    listLogsByRunId(args: {
        transportId: string;
        runId: string;
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: import("./transport").BaseLogMessage[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
}
//# sourceMappingURL=multi-logger.d.ts.map