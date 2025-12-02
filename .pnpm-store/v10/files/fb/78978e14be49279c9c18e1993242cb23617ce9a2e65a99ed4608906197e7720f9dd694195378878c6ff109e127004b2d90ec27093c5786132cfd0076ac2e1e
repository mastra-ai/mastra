import type { MastraError } from '../error/index.js';
import { LogLevel } from './constants.js';
import type { BaseLogMessage, LoggerTransport } from './transport.js';
export interface IMastraLogger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    trackException(error: MastraError): void;
    getTransports(): Map<string, LoggerTransport>;
    listLogs(_transportId: string, _params?: {
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: BaseLogMessage[];
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
        logs: BaseLogMessage[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
}
export declare abstract class MastraLogger implements IMastraLogger {
    protected name: string;
    protected level: LogLevel;
    protected transports: Map<string, LoggerTransport>;
    constructor(options?: {
        name?: string;
        level?: LogLevel;
        transports?: Record<string, LoggerTransport>;
    });
    abstract debug(message: string, ...args: any[]): void;
    abstract info(message: string, ...args: any[]): void;
    abstract warn(message: string, ...args: any[]): void;
    abstract error(message: string, ...args: any[]): void;
    getTransports(): Map<string, LoggerTransport>;
    trackException(_error: MastraError): void;
    listLogs(transportId: string, params?: {
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: BaseLogMessage[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
    listLogsByRunId({ transportId, runId, fromDate, toDate, logLevel, filters, page, perPage, }: {
        transportId: string;
        runId: string;
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
    }): Promise<{
        logs: BaseLogMessage[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
    }>;
}
//# sourceMappingURL=logger.d.ts.map