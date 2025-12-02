import { Kysely } from '../kysely.js';
/**
 * A `DialectAdapter` encapsulates all differences between dialects outside
 * of `Driver` and `QueryCompiler`.
 *
 * For example, some databases support transactional DDL and therefore we want
 * to run migrations inside a transaction, while other databases don't support
 * it. For that there's a `supportsTransactionalDdl` boolean in this interface.
 */
export interface DialectAdapter {
    /**
     * Whether or not this dialect supports `if not exists` in creation of tables/schemas/views/etc.
     *
     * If this is false, Kysely's internal migrations tables and schemas are created
     * without `if not exists` in migrations. This is not a problem if the dialect
     * supports transactional DDL.
     */
    readonly supportsCreateIfNotExists: boolean;
    /**
     * Whether or not this dialect supports transactional DDL.
     *
     * If this is true, migrations are executed inside a transaction.
     */
    readonly supportsTransactionalDdl: boolean;
    /**
     * Whether or not this dialect supports the `returning` in inserts
     * updates and deletes.
     */
    readonly supportsReturning: boolean;
    /**
     * Whether or not this dialect supports the `output` clause in inserts
     * updates and deletes.
     */
    readonly supportsOutput?: boolean;
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
    acquireMigrationLock(db: Kysely<any>, options: MigrationLockOptions): Promise<void>;
    /**
     * Releases the migration lock. See {@link acquireMigrationLock}.
     *
     * If `supportsTransactionalDdl` is `true` then the `db` passed to this method
     * is a transaction inside which the migrations were executed. Otherwise `db`
     * is a single connection (session) that was used to execute the migrations
     * and the `acquireMigrationLock` call.
     */
    releaseMigrationLock(db: Kysely<any>, options: MigrationLockOptions): Promise<void>;
}
export interface MigrationLockOptions {
    /**
     * The name of the migration lock table.
     */
    readonly lockTable: string;
    /**
     * The id of the only row in the migration lock table.
     */
    readonly lockRowId: string;
    /**
     * The schema in which the migration lock table lives. This is only
     * defined if the user has specified a custom schema in the migration
     * settings.
     */
    readonly lockTableSchema?: string;
}
