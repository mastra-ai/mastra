import { DatabaseConnection } from './database-connection.js';
import { Driver } from './driver.js';
/**
 * A driver that does absolutely nothing.
 *
 * You can use this to create Kysely instances solely for building queries
 *
 * ### Examples
 *
 * This example creates a Kysely instance for building postgres queries:
 *
 * ```ts
 * import {
 *   DummyDriver,
 *   Kysely,
 *   PostgresAdapter,
 *   PostgresIntrospector,
 *   PostgresQueryCompiler
 * } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: {
 *     createAdapter: () => new PostgresAdapter(),
 *     createDriver: () => new DummyDriver(),
 *     createIntrospector: (db: Kysely<any>) => new PostgresIntrospector(db),
 *     createQueryCompiler: () => new PostgresQueryCompiler(),
 *   },
 * })
 * ```
 *
 * You can use it to build a query and compile it to SQL but trying to
 * execute the query will throw an error.
 *
 * ```ts
 * const { sql } = db.selectFrom('person').selectAll().compile()
 * console.log(sql) // select * from "person"
 * ```
 */
export declare class DummyDriver implements Driver {
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
    beginTransaction(): Promise<void>;
    /**
     * Commits a transaction.
     */
    commitTransaction(): Promise<void>;
    /**
     * Rolls back a transaction.
     */
    rollbackTransaction(): Promise<void>;
    /**
     * Releases a connection back to the pool.
     */
    releaseConnection(): Promise<void>;
    /**
     * Destroys the driver and releases all resources.
     */
    destroy(): Promise<void>;
    releaseSavepoint(): Promise<void>;
    rollbackToSavepoint(): Promise<void>;
    savepoint(): Promise<void>;
}
