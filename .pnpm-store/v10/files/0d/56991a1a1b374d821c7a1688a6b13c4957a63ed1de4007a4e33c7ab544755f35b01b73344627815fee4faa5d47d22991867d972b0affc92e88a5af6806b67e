import { Kysely } from '../kysely.js';
export declare const DEFAULT_MIGRATION_TABLE = "kysely_migration";
export declare const DEFAULT_MIGRATION_LOCK_TABLE = "kysely_migration_lock";
export declare const DEFAULT_ALLOW_UNORDERED_MIGRATIONS = false;
export declare const MIGRATION_LOCK_ID = "migration_lock";
export declare const NO_MIGRATIONS: NoMigrations;
export interface Migration {
    up(db: Kysely<any>): Promise<void>;
    /**
     * An optional down method.
     *
     * If you don't provide a down method, the migration is skipped when
     * migrating down.
     */
    down?(db: Kysely<any>): Promise<void>;
}
/**
 * A class for running migrations.
 *
 * ### Example
 *
 * This example uses the {@link FileMigrationProvider} that reads migrations
 * files from a single folder. You can easily implement your own
 * {@link MigrationProvider} if you want to provide migrations some
 * other way.
 *
 * ```ts
 * import { promises as fs } from 'node:fs'
 * import path from 'node:path'
 * import * as Sqlite from 'better-sqlite3'
 * import {
 *   FileMigrationProvider,
 *   Kysely,
 *   Migrator,
 *   SqliteDialect
 * } from 'kysely'
 *
 * const db = new Kysely<any>({
 *   dialect: new SqliteDialect({
 *     database: Sqlite(':memory:')
 *   })
 * })
 *
 * const migrator = new Migrator({
 *   db,
 *   provider: new FileMigrationProvider({
 *     fs,
 *     // Path to the folder that contains all your migrations.
 *     migrationFolder: 'some/path/to/migrations',
 *     path,
 *   })
 * })
 * ```
 */
export declare class Migrator {
    #private;
    constructor(props: MigratorProps);
    /**
     * Returns a {@link MigrationInfo} object for each migration.
     *
     * The returned array is sorted by migration name.
     */
    getMigrations(): Promise<ReadonlyArray<MigrationInfo>>;
    /**
     * Runs all migrations that have not yet been run.
     *
     * This method returns a {@link MigrationResultSet} instance and _never_ throws.
     * {@link MigrationResultSet.error} holds the error if something went wrong.
     * {@link MigrationResultSet.results} contains information about which migrations
     * were executed and which failed. See the examples below.
     *
     * This method goes through all possible migrations provided by the provider and runs the
     * ones whose names come alphabetically after the last migration that has been run. If the
     * list of executed migrations doesn't match the beginning of the list of possible migrations
     * an error is returned.
     *
     * ### Examples
     *
     * ```ts
     * import { promises as fs } from 'node:fs'
     * import path from 'node:path'
     * import * as Sqlite from 'better-sqlite3'
     * import { FileMigrationProvider, Migrator } from 'kysely'
     *
     * const migrator = new Migrator({
     *   db,
     *   provider: new FileMigrationProvider({
     *     fs,
     *     migrationFolder: 'some/path/to/migrations',
     *     path,
     *   })
     * })
     *
     * const { error, results } = await migrator.migrateToLatest()
     *
     * results?.forEach((it) => {
     *   if (it.status === 'Success') {
     *     console.log(`migration "${it.migrationName}" was executed successfully`)
     *   } else if (it.status === 'Error') {
     *     console.error(`failed to execute migration "${it.migrationName}"`)
     *   }
     * })
     *
     * if (error) {
     *   console.error('failed to run `migrateToLatest`')
     *   console.error(error)
     * }
     * ```
     */
    migrateToLatest(): Promise<MigrationResultSet>;
    /**
     * Migrate up/down to a specific migration.
     *
     * This method returns a {@link MigrationResultSet} instance and _never_ throws.
     * {@link MigrationResultSet.error} holds the error if something went wrong.
     * {@link MigrationResultSet.results} contains information about which migrations
     * were executed and which failed.
     *
     * ### Examples
     *
     * ```ts
     * import { promises as fs } from 'node:fs'
     * import path from 'node:path'
     * import { FileMigrationProvider, Migrator } from 'kysely'
     *
     * const migrator = new Migrator({
     *   db,
     *   provider: new FileMigrationProvider({
     *     fs,
     *     // Path to the folder that contains all your migrations.
     *     migrationFolder: 'some/path/to/migrations',
     *     path,
     *   })
     * })
     *
     * await migrator.migrateTo('some_migration')
     * ```
     *
     * If you specify the name of the first migration, this method migrates
     * down to the first migration, but doesn't run the `down` method of
     * the first migration. In case you want to migrate all the way down,
     * you can use a special constant `NO_MIGRATIONS`:
     *
     * ```ts
     * import { promises as fs } from 'node:fs'
     * import path from 'node:path'
     * import { FileMigrationProvider, Migrator, NO_MIGRATIONS } from 'kysely'
     *
     * const migrator = new Migrator({
     *   db,
     *   provider: new FileMigrationProvider({
     *     fs,
     *     // Path to the folder that contains all your migrations.
     *     migrationFolder: 'some/path/to/migrations',
     *     path,
     *   })
     * })
     *
     * await migrator.migrateTo(NO_MIGRATIONS)
     * ```
     */
    migrateTo(targetMigrationName: string | NoMigrations): Promise<MigrationResultSet>;
    /**
     * Migrate one step up.
     *
     * This method returns a {@link MigrationResultSet} instance and _never_ throws.
     * {@link MigrationResultSet.error} holds the error if something went wrong.
     * {@link MigrationResultSet.results} contains information about which migrations
     * were executed and which failed.
     *
     * ### Examples
     *
     * ```ts
     * import { promises as fs } from 'node:fs'
     * import path from 'node:path'
     * import { FileMigrationProvider, Migrator } from 'kysely'
     *
     * const migrator = new Migrator({
     *   db,
     *   provider: new FileMigrationProvider({
     *     fs,
     *     // Path to the folder that contains all your migrations.
     *     migrationFolder: 'some/path/to/migrations',
     *     path,
     *   })
     * })
     *
     * await migrator.migrateUp()
     * ```
     */
    migrateUp(): Promise<MigrationResultSet>;
    /**
     * Migrate one step down.
     *
     * This method returns a {@link MigrationResultSet} instance and _never_ throws.
     * {@link MigrationResultSet.error} holds the error if something went wrong.
     * {@link MigrationResultSet.results} contains information about which migrations
     * were executed and which failed.
     *
     * ### Examples
     *
     * ```ts
     * import { promises as fs } from 'node:fs'
     * import path from 'node:path'
     * import { FileMigrationProvider, Migrator } from 'kysely'
     *
     * const migrator = new Migrator({
     *   db,
     *   provider: new FileMigrationProvider({
     *     fs,
     *     // Path to the folder that contains all your migrations.
     *     migrationFolder: 'some/path/to/migrations',
     *     path,
     *   })
     * })
     *
     * await migrator.migrateDown()
     * ```
     */
    migrateDown(): Promise<MigrationResultSet>;
}
export interface MigratorProps {
    readonly db: Kysely<any>;
    readonly provider: MigrationProvider;
    /**
     * The name of the internal migration table. Defaults to `kysely_migration`.
     *
     * If you do specify this, you need to ALWAYS use the same value. Kysely doesn't
     * support changing the table on the fly. If you run the migrator even once with a
     * table name X and then change the table name to Y, kysely will create a new empty
     * migration table and attempt to run the migrations again, which will obviously
     * fail.
     *
     * If you do specify this, ALWAYS ALWAYS use the same value from the beginning of
     * the project, to the end of time or prepare to manually migrate the migration
     * tables.
     */
    readonly migrationTableName?: string;
    /**
     * The name of the internal migration lock table. Defaults to `kysely_migration_lock`.
     *
     * If you do specify this, you need to ALWAYS use the same value. Kysely doesn't
     * support changing the table on the fly. If you run the migrator even once with a
     * table name X and then change the table name to Y, kysely will create a new empty
     * lock table.
     *
     * If you do specify this, ALWAYS ALWAYS use the same value from the beginning of
     * the project, to the end of time or prepare to manually migrate the migration
     * tables.
     */
    readonly migrationLockTableName?: string;
    /**
     * The schema of the internal migration tables. Defaults to the default schema
     * on dialects that support schemas.
     *
     * If you do specify this, you need to ALWAYS use the same value. Kysely doesn't
     * support changing the schema on the fly. If you run the migrator even once with a
     * schema name X and then change the schema name to Y, kysely will create a new empty
     * migration tables in the new schema and attempt to run the migrations again, which
     * will obviously fail.
     *
     * If you do specify this, ALWAYS ALWAYS use the same value from the beginning of
     * the project, to the end of time or prepare to manually migrate the migration
     * tables.
     *
     * This only works on postgres.
     */
    readonly migrationTableSchema?: string;
    /**
     * Enforces whether or not migrations must be run in alpha-numeric order.
     *
     * When false, migrations must be run in their exact alpha-numeric order.
     * This is checked against the migrations already run in the database
     * (`migrationTableName`). This ensures your migrations are always run in
     * the same order and is the safest option.
     *
     * When true, migrations are still run in alpha-numeric order, but
     * the order is not checked against already-run migrations in the database.
     * Kysely will simply run all migrations that haven't run yet, in alpha-numeric
     * order.
     */
    readonly allowUnorderedMigrations?: boolean;
    /**
     * A function that compares migration names, used when sorting migrations in
     * ascending order.
     *
     * Default is `name0.localeCompare(name1)`.
     */
    readonly nameComparator?: (name0: string, name1: string) => number;
    /**
     * When `true`, don't run migrations in transactions even if the dialect supports transactional DDL.
     *
     * Default is `false`.
     *
     * This is useful when some migrations include queries that would fail otherwise.
     */
    readonly disableTransactions?: boolean;
}
/**
 * All migration methods ({@link Migrator.migrateTo | migrateTo},
 * {@link Migrator.migrateToLatest | migrateToLatest} etc.) never
 * throw but return this object instead.
 */
export interface MigrationResultSet {
    /**
     * This is defined if something went wrong.
     *
     * An error may have occurred in one of the migrations in which case the
     * {@link results} list contains an item with `status === 'Error'` to
     * indicate which migration failed.
     *
     * An error may also have occurred before Kysely was able to figure out
     * which migrations should be executed, in which case the {@link results}
     * list is undefined.
     */
    readonly error?: unknown;
    /**
     * {@link MigrationResult} for each individual migration that was supposed
     * to be executed by the operation.
     *
     * If all went well, each result's `status` is `Success`. If some migration
     * failed, the failed migration's result's `status` is `Error` and all
     * results after that one have `status` ´NotExecuted`.
     *
     * This property can be undefined if an error occurred before Kysely was
     * able to figure out which migrations should be executed.
     *
     * If this list is empty, there were no migrations to execute.
     */
    readonly results?: MigrationResult[];
}
type MigrationDirection = 'Up' | 'Down';
export interface MigrationResult {
    readonly migrationName: string;
    /**
     * The direction in which this migration was executed.
     */
    readonly direction: MigrationDirection;
    /**
     * The execution status.
     *
     *  - `Success` means the migration was successfully executed. Note that
     *    if any of the later migrations in the {@link MigrationResultSet.results}
     *    list failed (have status `Error`) AND the dialect supports transactional
     *    DDL, even the successfull migrations were rolled back.
     *
     *  - `Error` means the migration failed. In this case the
     *    {@link MigrationResultSet.error} contains the error.
     *
     *  - `NotExecuted` means that the migration was supposed to be executed
     *    but wasn't because an earlier migration failed.
     */
    readonly status: 'Success' | 'Error' | 'NotExecuted';
}
export interface MigrationProvider {
    /**
     * Returns all migrations, old and new.
     *
     * For example if you have your migrations in a folder as separate files,
     * you can implement this method to return all migration in that folder
     * as {@link Migration} objects.
     *
     * Kysely already has a built-in {@link FileMigrationProvider} for node.js
     * that does exactly that.
     *
     * The keys of the returned object are migration names and values are the
     * migrations. The order of the migrations is determined by the alphabetical
     * order of the migration names. The items in the object don't need to be
     * sorted, they are sorted by Kysely.
     */
    getMigrations(): Promise<Record<string, Migration>>;
}
/**
 * Type for the {@link NO_MIGRATIONS} constant. Never create one of these.
 */
export interface NoMigrations {
    readonly __noMigrations__: true;
}
export interface MigrationInfo {
    /**
     * Name of the migration.
     */
    name: string;
    /**
     * The actual migration.
     */
    migration: Migration;
    /**
     * When was the migration executed.
     *
     * If this is undefined, the migration hasn't been executed yet.
     */
    executedAt?: Date;
}
export {};
