/// <reference types="./postgres-dialect.d.ts" />
import { PostgresDriver } from './postgres-driver.js';
import { PostgresIntrospector } from './postgres-introspector.js';
import { PostgresQueryCompiler } from './postgres-query-compiler.js';
import { PostgresAdapter } from './postgres-adapter.js';
/**
 * PostgreSQL dialect that uses the [pg](https://node-postgres.com/) library.
 *
 * The constructor takes an instance of {@link PostgresDialectConfig}.
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `pool`
 * can be a function:
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: async () => new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 */
export class PostgresDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new PostgresDriver(this.#config);
    }
    createQueryCompiler() {
        return new PostgresQueryCompiler();
    }
    createAdapter() {
        return new PostgresAdapter();
    }
    createIntrospector(db) {
        return new PostgresIntrospector(db);
    }
}
