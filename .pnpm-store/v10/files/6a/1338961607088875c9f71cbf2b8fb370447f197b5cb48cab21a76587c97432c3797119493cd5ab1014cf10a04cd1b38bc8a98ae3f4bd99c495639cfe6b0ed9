import { QueryCompiler } from '../query-compiler/query-compiler.js';
import { Log } from '../util/log.js';
import { DatabaseConnection } from './database-connection.js';
import { Driver, TransactionSettings } from './driver.js';
/**
 * A small wrapper around {@link Driver} that makes sure the driver is
 * initialized before it is used, only initialized and destroyed
 * once etc.
 */
export declare class RuntimeDriver implements Driver {
    #private;
    constructor(driver: Driver, log: Log);
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
     * Releases a connection back to the pool.
     */
    releaseConnection(connection: DatabaseConnection): Promise<void>;
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
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
}
