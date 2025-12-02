import { QueryCompiler } from '../query-compiler/query-compiler.js';
import { ArrayItemType } from '../util/type-utils.js';
import { DatabaseConnection } from './database-connection.js';
/**
 * A Driver creates and releases {@link DatabaseConnection | database connections}
 * and is also responsible for connection pooling (if the dialect supports pooling).
 */
export interface Driver {
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
    /**
     * Establishses a new savepoint within a transaction.
     */
    savepoint?(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    /**
     * Rolls back to a savepoint within a transaction.
     */
    rollbackToSavepoint?(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    /**
     * Releases a savepoint within a transaction.
     */
    releaseSavepoint?(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    /**
     * Releases a connection back to the pool.
     */
    releaseConnection(connection: DatabaseConnection): Promise<void>;
    /**
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
}
export interface TransactionSettings {
    readonly accessMode?: AccessMode;
    readonly isolationLevel?: IsolationLevel;
}
export declare const TRANSACTION_ACCESS_MODES: readonly ["read only", "read write"];
export type AccessMode = ArrayItemType<typeof TRANSACTION_ACCESS_MODES>;
export declare const TRANSACTION_ISOLATION_LEVELS: readonly ["read uncommitted", "read committed", "repeatable read", "serializable", "snapshot"];
export type IsolationLevel = ArrayItemType<typeof TRANSACTION_ISOLATION_LEVELS>;
export declare function validateTransactionSettings(settings: TransactionSettings): void;
