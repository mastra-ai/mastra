import { Driver } from '../../driver/driver.js';
import { Kysely } from '../../kysely.js';
import { QueryCompiler } from '../../query-compiler/query-compiler.js';
import { Dialect } from '../dialect.js';
import { DatabaseIntrospector } from '../database-introspector.js';
import { DialectAdapter } from '../dialect-adapter.js';
import { SqliteDialectConfig } from './sqlite-dialect-config.js';
/**
 * SQLite dialect that uses the [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) library.
 *
 * The constructor takes an instance of {@link SqliteDialectConfig}.
 *
 * ```ts
 * import Database from 'better-sqlite3'
 *
 * new SqliteDialect({
 *   database: new Database('db.sqlite')
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `database`
 * can be a function:
 *
 * ```ts
 * import Database from 'better-sqlite3'
 *
 * new SqliteDialect({
 *   database: async () => new Database('db.sqlite')
 * })
 * ```
 */
export declare class SqliteDialect implements Dialect {
    #private;
    constructor(config: SqliteDialectConfig);
    /**
     * Creates a driver for the dialect.
     */
    createDriver(): Driver;
    /**
     * Creates a query compiler for the dialect.
     */
    createQueryCompiler(): QueryCompiler;
    /**
     * Creates an adapter for the dialect.
     */
    createAdapter(): DialectAdapter;
    /**
     * Creates a database introspector that can be used to get database metadata
     * such as the table names and column names of those tables.
     *
     * `db` never has any plugins installed. It's created using
     * {@link Kysely.withoutPlugins}.
     */
    createIntrospector(db: Kysely<any>): DatabaseIntrospector;
}
