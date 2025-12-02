import { DatabaseConnection } from '../../driver/database-connection.js';
import { Driver } from '../../driver/driver.js';
import { QueryCompiler } from '../../query-compiler/query-compiler.js';
import { SqliteDialectConfig } from './sqlite-dialect-config.js';
export declare class SqliteDriver implements Driver {
    #private;
    constructor(config: SqliteDialectConfig);
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
    beginTransaction(connection: DatabaseConnection): Promise<void>;
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
    releaseConnection(): Promise<void>;
    /**
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
}
