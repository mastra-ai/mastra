/// <reference types="./mysql-dialect.d.ts" />
import { MysqlDriver } from './mysql-driver.js';
import { MysqlQueryCompiler } from './mysql-query-compiler.js';
import { MysqlIntrospector } from './mysql-introspector.js';
import { MysqlAdapter } from './mysql-adapter.js';
/**
 * MySQL dialect that uses the [mysql2](https://github.com/sidorares/node-mysql2#readme) library.
 *
 * The constructor takes an instance of {@link MysqlDialectConfig}.
 *
 * ```ts
 * import { createPool } from 'mysql2'
 *
 * new MysqlDialect({
 *   pool: createPool({
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
 * import { createPool } from 'mysql2'
 *
 * new MysqlDialect({
 *   pool: async () => createPool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 */
export class MysqlDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new MysqlDriver(this.#config);
    }
    createQueryCompiler() {
        return new MysqlQueryCompiler();
    }
    createAdapter() {
        return new MysqlAdapter();
    }
    createIntrospector(db) {
        return new MysqlIntrospector(db);
    }
}
