import { DatabaseConnection, QueryResult } from '../../driver/database-connection.js';
import { Driver, TransactionSettings } from '../../driver/driver.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
import { QueryCompiler } from '../../query-compiler/query-compiler.js';
import { PostgresCursorConstructor, PostgresDialectConfig, PostgresPoolClient } from './postgres-dialect-config.js';
declare const PRIVATE_RELEASE_METHOD: unique symbol;
export declare class PostgresDriver implements Driver {
    #private;
    constructor(config: PostgresDialectConfig);
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
    beginTransaction(connection: DatabaseConnection, settings: TransactionSettings): Promise<void>;
    /**
     * Commits a transaction.
     */
    commitTransaction(connection: DatabaseConnection): Promise<void>;
    /**
     * Rolls back a transaction.
     */
    rollbackTransaction(connection: DatabaseConnection): Promise<void>;
    savepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    rollbackToSavepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    releaseSavepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    /**
     * Releases a connection back to the pool.
     */
    releaseConnection(connection: PostgresConnection): Promise<void>;
    /**
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
}
interface PostgresConnectionOptions {
    cursor: PostgresCursorConstructor | null;
}
declare class PostgresConnection implements DatabaseConnection {
    #private;
    constructor(client: PostgresPoolClient, options: PostgresConnectionOptions);
    executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>>;
    streamQuery<O>(compiledQuery: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<O>>;
    [PRIVATE_RELEASE_METHOD](): void;
}
export {};
