/// <reference types="./migrator.d.ts" />
import { NoopPlugin } from '../plugin/noop-plugin.js';
import { WithSchemaPlugin } from '../plugin/with-schema/with-schema-plugin.js';
import { freeze, getLast, isObject } from '../util/object-utils.js';
export const DEFAULT_MIGRATION_TABLE = 'kysely_migration';
export const DEFAULT_MIGRATION_LOCK_TABLE = 'kysely_migration_lock';
export const DEFAULT_ALLOW_UNORDERED_MIGRATIONS = false;
export const MIGRATION_LOCK_ID = 'migration_lock';
export const NO_MIGRATIONS = freeze({ __noMigrations__: true });
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
export class Migrator {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    /**
     * Returns a {@link MigrationInfo} object for each migration.
     *
     * The returned array is sorted by migration name.
     */
    async getMigrations() {
        const executedMigrations = (await this.#doesTableExists(this.#migrationTable))
            ? await this.#props.db
                .withPlugin(this.#schemaPlugin)
                .selectFrom(this.#migrationTable)
                .select(['name', 'timestamp'])
                .$narrowType()
                .execute()
            : [];
        const migrations = await this.#resolveMigrations();
        return migrations.map(({ name, ...migration }) => {
            const executed = executedMigrations.find((it) => it.name === name);
            return {
                name,
                migration,
                executedAt: executed ? new Date(executed.timestamp) : undefined,
            };
        });
    }
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
    async migrateToLatest() {
        return this.#migrate(() => ({ direction: 'Up', step: Infinity }));
    }
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
    async migrateTo(targetMigrationName) {
        return this.#migrate(({ migrations, executedMigrations, pendingMigrations, }) => {
            if (isObject(targetMigrationName) &&
                targetMigrationName.__noMigrations__ === true) {
                return { direction: 'Down', step: Infinity };
            }
            if (!migrations.find((m) => m.name === targetMigrationName)) {
                throw new Error(`migration "${targetMigrationName}" doesn't exist`);
            }
            const executedIndex = executedMigrations.indexOf(targetMigrationName);
            const pendingIndex = pendingMigrations.findIndex((m) => m.name === targetMigrationName);
            if (executedIndex !== -1) {
                return {
                    direction: 'Down',
                    step: executedMigrations.length - executedIndex - 1,
                };
            }
            else if (pendingIndex !== -1) {
                return { direction: 'Up', step: pendingIndex + 1 };
            }
            else {
                throw new Error(`migration "${targetMigrationName}" isn't executed or pending`);
            }
        });
    }
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
    async migrateUp() {
        return this.#migrate(() => ({ direction: 'Up', step: 1 }));
    }
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
    async migrateDown() {
        return this.#migrate(() => ({ direction: 'Down', step: 1 }));
    }
    async #migrate(getMigrationDirectionAndStep) {
        try {
            await this.#ensureMigrationTablesExists();
            return await this.#runMigrations(getMigrationDirectionAndStep);
        }
        catch (error) {
            if (error instanceof MigrationResultSetError) {
                return error.resultSet;
            }
            return { error };
        }
    }
    get #migrationTableSchema() {
        return this.#props.migrationTableSchema;
    }
    get #migrationTable() {
        return this.#props.migrationTableName ?? DEFAULT_MIGRATION_TABLE;
    }
    get #migrationLockTable() {
        return this.#props.migrationLockTableName ?? DEFAULT_MIGRATION_LOCK_TABLE;
    }
    get #allowUnorderedMigrations() {
        return (this.#props.allowUnorderedMigrations ?? DEFAULT_ALLOW_UNORDERED_MIGRATIONS);
    }
    get #schemaPlugin() {
        if (this.#migrationTableSchema) {
            return new WithSchemaPlugin(this.#migrationTableSchema);
        }
        return new NoopPlugin();
    }
    async #ensureMigrationTablesExists() {
        await this.#ensureMigrationTableSchemaExists();
        await this.#ensureMigrationTableExists();
        await this.#ensureMigrationLockTableExists();
        await this.#ensureLockRowExists();
    }
    async #ensureMigrationTableSchemaExists() {
        if (!this.#migrationTableSchema) {
            // Use default schema. Nothing to do.
            return;
        }
        if (!(await this.#doesSchemaExists())) {
            try {
                await this.#createIfNotExists(this.#props.db.schema.createSchema(this.#migrationTableSchema));
            }
            catch (error) {
                // At least on PostgreSQL, `if not exists` doesn't guarantee the `create schema`
                // query doesn't throw if the schema already exits. That's why we check if
                // the schema exist here and ignore the error if it does.
                if (!(await this.#doesSchemaExists())) {
                    throw error;
                }
            }
        }
    }
    async #ensureMigrationTableExists() {
        if (!(await this.#doesTableExists(this.#migrationTable))) {
            try {
                if (this.#migrationTableSchema) {
                    await this.#createIfNotExists(this.#props.db.schema.createSchema(this.#migrationTableSchema));
                }
                await this.#createIfNotExists(this.#props.db.schema
                    .withPlugin(this.#schemaPlugin)
                    .createTable(this.#migrationTable)
                    .addColumn('name', 'varchar(255)', (col) => col.notNull().primaryKey())
                    // The migration run time as ISO string. This is not a real date type as we
                    // can't know which data type is supported by all future dialects.
                    .addColumn('timestamp', 'varchar(255)', (col) => col.notNull()));
            }
            catch (error) {
                // At least on PostgreSQL, `if not exists` doesn't guarantee the `create table`
                // query doesn't throw if the table already exits. That's why we check if
                // the table exist here and ignore the error if it does.
                if (!(await this.#doesTableExists(this.#migrationTable))) {
                    throw error;
                }
            }
        }
    }
    async #ensureMigrationLockTableExists() {
        if (!(await this.#doesTableExists(this.#migrationLockTable))) {
            try {
                await this.#createIfNotExists(this.#props.db.schema
                    .withPlugin(this.#schemaPlugin)
                    .createTable(this.#migrationLockTable)
                    .addColumn('id', 'varchar(255)', (col) => col.notNull().primaryKey())
                    .addColumn('is_locked', 'integer', (col) => col.notNull().defaultTo(0)));
            }
            catch (error) {
                // At least on PostgreSQL, `if not exists` doesn't guarantee the `create table`
                // query doesn't throw if the table already exits. That's why we check if
                // the table exist here and ignore the error if it does.
                if (!(await this.#doesTableExists(this.#migrationLockTable))) {
                    throw error;
                }
            }
        }
    }
    async #ensureLockRowExists() {
        if (!(await this.#doesLockRowExists())) {
            try {
                await this.#props.db
                    .withPlugin(this.#schemaPlugin)
                    .insertInto(this.#migrationLockTable)
                    .values({ id: MIGRATION_LOCK_ID, is_locked: 0 })
                    .execute();
            }
            catch (error) {
                if (!(await this.#doesLockRowExists())) {
                    throw error;
                }
            }
        }
    }
    async #doesSchemaExists() {
        const schemas = await this.#props.db.introspection.getSchemas();
        return schemas.some((it) => it.name === this.#migrationTableSchema);
    }
    async #doesTableExists(tableName) {
        const schema = this.#migrationTableSchema;
        const tables = await this.#props.db.introspection.getTables({
            withInternalKyselyTables: true,
        });
        return tables.some((it) => it.name === tableName && (!schema || it.schema === schema));
    }
    async #doesLockRowExists() {
        const lockRow = await this.#props.db
            .withPlugin(this.#schemaPlugin)
            .selectFrom(this.#migrationLockTable)
            .where('id', '=', MIGRATION_LOCK_ID)
            .select('id')
            .executeTakeFirst();
        return !!lockRow;
    }
    async #runMigrations(getMigrationDirectionAndStep) {
        const adapter = this.#props.db.getExecutor().adapter;
        const lockOptions = freeze({
            lockTable: this.#props.migrationLockTableName ?? DEFAULT_MIGRATION_LOCK_TABLE,
            lockRowId: MIGRATION_LOCK_ID,
            lockTableSchema: this.#props.migrationTableSchema,
        });
        const run = async (db) => {
            try {
                await adapter.acquireMigrationLock(db, lockOptions);
                const state = await this.#getState(db);
                if (state.migrations.length === 0) {
                    return { results: [] };
                }
                const { direction, step } = getMigrationDirectionAndStep(state);
                if (step <= 0) {
                    return { results: [] };
                }
                if (direction === 'Down') {
                    return await this.#migrateDown(db, state, step);
                }
                else if (direction === 'Up') {
                    return await this.#migrateUp(db, state, step);
                }
                return { results: [] };
            }
            finally {
                await adapter.releaseMigrationLock(db, lockOptions);
            }
        };
        if (adapter.supportsTransactionalDdl && !this.#props.disableTransactions) {
            return this.#props.db.transaction().execute(run);
        }
        else {
            return this.#props.db.connection().execute(run);
        }
    }
    async #getState(db) {
        const migrations = await this.#resolveMigrations();
        const executedMigrations = await this.#getExecutedMigrations(db);
        this.#ensureNoMissingMigrations(migrations, executedMigrations);
        if (!this.#allowUnorderedMigrations) {
            this.#ensureMigrationsInOrder(migrations, executedMigrations);
        }
        const pendingMigrations = this.#getPendingMigrations(migrations, executedMigrations);
        return freeze({
            migrations,
            executedMigrations,
            lastMigration: getLast(executedMigrations),
            pendingMigrations,
        });
    }
    #getPendingMigrations(migrations, executedMigrations) {
        return migrations.filter((migration) => {
            return !executedMigrations.includes(migration.name);
        });
    }
    async #resolveMigrations() {
        const allMigrations = await this.#props.provider.getMigrations();
        return Object.keys(allMigrations)
            .sort()
            .map((name) => ({
            ...allMigrations[name],
            name,
        }));
    }
    async #getExecutedMigrations(db) {
        const executedMigrations = await db
            .withPlugin(this.#schemaPlugin)
            .selectFrom(this.#migrationTable)
            .select(['name', 'timestamp'])
            .$narrowType()
            .execute();
        const nameComparator = this.#props.nameComparator || ((a, b) => a.localeCompare(b));
        return (executedMigrations
            // https://github.com/kysely-org/kysely/issues/843
            .sort((a, b) => {
            if (a.timestamp === b.timestamp) {
                return nameComparator(a.name, b.name);
            }
            return (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        })
            .map((it) => it.name));
    }
    #ensureNoMissingMigrations(migrations, executedMigrations) {
        // Ensure all executed migrations exist in the `migrations` list.
        for (const executed of executedMigrations) {
            if (!migrations.some((it) => it.name === executed)) {
                throw new Error(`corrupted migrations: previously executed migration ${executed} is missing`);
            }
        }
    }
    #ensureMigrationsInOrder(migrations, executedMigrations) {
        // Ensure the executed migrations are the first ones in the migration list.
        for (let i = 0; i < executedMigrations.length; ++i) {
            if (migrations[i].name !== executedMigrations[i]) {
                throw new Error(`corrupted migrations: expected previously executed migration ${executedMigrations[i]} to be at index ${i} but ${migrations[i].name} was found in its place. New migrations must always have a name that comes alphabetically after the last executed migration.`);
            }
        }
    }
    async #migrateDown(db, state, step) {
        const migrationsToRollback = state.executedMigrations
            .slice()
            .reverse()
            .slice(0, step)
            .map((name) => {
            return state.migrations.find((it) => it.name === name);
        });
        const results = migrationsToRollback.map((migration) => {
            return {
                migrationName: migration.name,
                direction: 'Down',
                status: 'NotExecuted',
            };
        });
        for (let i = 0; i < results.length; ++i) {
            const migration = migrationsToRollback[i];
            try {
                if (migration.down) {
                    await migration.down(db);
                    await db
                        .withPlugin(this.#schemaPlugin)
                        .deleteFrom(this.#migrationTable)
                        .where('name', '=', migration.name)
                        .execute();
                    results[i] = {
                        migrationName: migration.name,
                        direction: 'Down',
                        status: 'Success',
                    };
                }
            }
            catch (error) {
                results[i] = {
                    migrationName: migration.name,
                    direction: 'Down',
                    status: 'Error',
                };
                throw new MigrationResultSetError({
                    error,
                    results,
                });
            }
        }
        return { results };
    }
    async #migrateUp(db, state, step) {
        const migrationsToRun = state.pendingMigrations.slice(0, step);
        const results = migrationsToRun.map((migration) => {
            return {
                migrationName: migration.name,
                direction: 'Up',
                status: 'NotExecuted',
            };
        });
        for (let i = 0; i < results.length; i++) {
            const migration = state.pendingMigrations[i];
            try {
                await migration.up(db);
                await db
                    .withPlugin(this.#schemaPlugin)
                    .insertInto(this.#migrationTable)
                    .values({
                    name: migration.name,
                    timestamp: new Date().toISOString(),
                })
                    .execute();
                results[i] = {
                    migrationName: migration.name,
                    direction: 'Up',
                    status: 'Success',
                };
            }
            catch (error) {
                results[i] = {
                    migrationName: migration.name,
                    direction: 'Up',
                    status: 'Error',
                };
                throw new MigrationResultSetError({
                    error,
                    results,
                });
            }
        }
        return { results };
    }
    async #createIfNotExists(qb) {
        if (this.#props.db.getExecutor().adapter.supportsCreateIfNotExists) {
            qb = qb.ifNotExists();
        }
        await qb.execute();
    }
}
class MigrationResultSetError extends Error {
    #resultSet;
    constructor(result) {
        super();
        this.#resultSet = result;
    }
    get resultSet() {
        return this.#resultSet;
    }
}
