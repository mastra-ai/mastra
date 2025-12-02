import { Kysely } from '../../kysely.js';
import { DialectAdapterBase } from '../dialect-adapter-base.js';
import { MigrationLockOptions } from '../dialect-adapter.js';
export declare class PostgresAdapter extends DialectAdapterBase {
    /**
     * Whether or not this dialect supports transactional DDL.
     *
     * If this is true, migrations are executed inside a transaction.
     */
    get supportsTransactionalDdl(): boolean;
    /**
     * Whether or not this dialect supports the `returning` in inserts
     * updates and deletes.
     */
    get supportsReturning(): boolean;
    /**
     * This method is used to acquire a lock for the migrations so that
     * it's not possible for two migration operations to run in parallel.
     *
     * Most dialects have explicit locks that can be used, like advisory locks
     * in PostgreSQL and the get_lock function in MySQL.
     *
     * If the dialect doesn't have explicit locks the {@link MigrationLockOptions.lockTable}
     * created by Kysely can be used instead. You can access it through the `options` object.
     * The lock table has two columns `id` and `is_locked` and there's only one row in the table
     * whose id is {@link MigrationLockOptions.lockRowId}. `is_locked` is an integer. Kysely
     * takes care of creating the lock table and inserting the one single row to it before this
     * method is executed. If the dialect supports schemas and the user has specified a custom
     * schema in their migration settings, the options object also contains the schema name in
     * {@link MigrationLockOptions.lockTableSchema}.
     *
     * Here's an example of how you might implement this method for a dialect that doesn't
     * have explicit locks but supports `FOR UPDATE` row locks and transactional DDL:
     *
     * ```ts
     * import { DialectAdapterBase, type MigrationLockOptions, Kysely } from 'kysely'
     *
     * export class MyAdapter extends DialectAdapterBase {
     *   override async acquireMigrationLock(
     *     db: Kysely<any>,
     *     options: MigrationLockOptions
     *   ): Promise<void> {
     *     const queryDb = options.lockTableSchema
     *       ? db.withSchema(options.lockTableSchema)
     *       : db
     *
     *     // Since our imaginary dialect supports transactional DDL and has
     *     // row locks, we can simply take a row lock here and it will guarantee
     *     // all subsequent calls to this method from other transactions will
     *     // wait until this transaction finishes.
     *     await queryDb
     *       .selectFrom(options.lockTable)
     *       .selectAll()
     *       .where('id', '=', options.lockRowId)
     *       .forUpdate()
     *       .execute()
     *   }
     *
     *   override async releaseMigrationLock() {
     *     // noop
     *   }
     * }
     * ```
     *
     * If `supportsTransactionalDdl` is `true` then the `db` passed to this method
     * is a transaction inside which the migrations will be executed. Otherwise
     * `db` is a single connection (session) that will be used to execute the
     * migrations.
     */
    acquireMigrationLock(db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
    /**
     * Releases the migration lock. See {@link acquireMigrationLock}.
     *
     * If `supportsTransactionalDdl` is `true` then the `db` passed to this method
     * is a transaction inside which the migrations were executed. Otherwise `db`
     * is a single connection (session) that was used to execute the migrations
     * and the `acquireMigrationLock` call.
     */
    releaseMigrationLock(_db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
}
