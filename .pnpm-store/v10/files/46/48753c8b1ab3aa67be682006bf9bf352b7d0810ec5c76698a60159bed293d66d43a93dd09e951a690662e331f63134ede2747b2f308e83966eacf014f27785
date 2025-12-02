/// <reference types="./sqlite-dialect.d.ts" />
import { SqliteDriver } from './sqlite-driver.js';
import { SqliteQueryCompiler } from './sqlite-query-compiler.js';
import { SqliteIntrospector } from './sqlite-introspector.js';
import { SqliteAdapter } from './sqlite-adapter.js';
import { freeze } from '../../util/object-utils.js';
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
export class SqliteDialect {
    #config;
    constructor(config) {
        this.#config = freeze({ ...config });
    }
    createDriver() {
        return new SqliteDriver(this.#config);
    }
    createQueryCompiler() {
        return new SqliteQueryCompiler();
    }
    createAdapter() {
        return new SqliteAdapter();
    }
    createIntrospector(db) {
        return new SqliteIntrospector(db);
    }
}
