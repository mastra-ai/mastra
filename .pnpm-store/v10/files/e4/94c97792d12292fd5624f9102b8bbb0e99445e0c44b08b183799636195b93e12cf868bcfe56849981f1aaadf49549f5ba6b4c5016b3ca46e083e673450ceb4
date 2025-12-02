import { DatabaseConnection, QueryResult } from '../../driver/database-connection.js';
import { Driver, TransactionSettings } from '../../driver/driver.js';
import { MssqlDialectConfig, Tedious, TediousConnection } from './mssql-dialect-config.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
declare const PRIVATE_RESET_METHOD: unique symbol;
declare const PRIVATE_DESTROY_METHOD: unique symbol;
declare const PRIVATE_VALIDATE_METHOD: unique symbol;
export declare class MssqlDriver implements Driver {
    #private;
    constructor(config: MssqlDialectConfig);
    /**
     * Initializes the driver.
     *
     * After calling this method the driver should be usable and `acquireConnection` etc.
     * methods should be callable.
     */
    init(): Promise<void>;
    /**
     * Acquires a new connection from the pool.
     */
    acquireConnection(): Promise<DatabaseConnection>;
    /**
     * Begins a transaction.
     */
    beginTransaction(connection: MssqlConnection, settings: TransactionSettings): Promise<void>;
    /**
     * Commits a transaction.
     */
    commitTransaction(connection: MssqlConnection): Promise<void>;
    /**
     * Rolls back a transaction.
     */
    rollbackTransaction(connection: MssqlConnection): Promise<void>;
    savepoint(connection: MssqlConnection, savepointName: string): Promise<void>;
    rollbackToSavepoint(connection: MssqlConnection, savepointName: string): Promise<void>;
    /**
     * Releases a connection back to the pool.
     */
    releaseConnection(connection: MssqlConnection): Promise<void>;
    /**
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
}
declare class MssqlConnection implements DatabaseConnection {
    #private;
    constructor(connection: TediousConnection, tedious: Tedious);
    beginTransaction(settings: TransactionSettings): Promise<void>;
    commitTransaction(): Promise<void>;
    connect(): Promise<this>;
    executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>>;
    rollbackTransaction(savepointName?: string): Promise<void>;
    savepoint(savepointName: string): Promise<void>;
    streamQuery<O>(compiledQuery: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<O>>;
    [PRIVATE_DESTROY_METHOD](): Promise<void>;
    [PRIVATE_RESET_METHOD](): Promise<void>;
    [PRIVATE_VALIDATE_METHOD](): Promise<boolean>;
}
export {};
