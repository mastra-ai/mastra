"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDialect = void 0;
const postgres_driver_js_1 = require("./postgres-driver.js");
const postgres_introspector_js_1 = require("./postgres-introspector.js");
const postgres_query_compiler_js_1 = require("./postgres-query-compiler.js");
const postgres_adapter_js_1 = require("./postgres-adapter.js");
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
class PostgresDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new postgres_driver_js_1.PostgresDriver(this.#config);
    }
    createQueryCompiler() {
        return new postgres_query_compiler_js_1.PostgresQueryCompiler();
    }
    createAdapter() {
        return new postgres_adapter_js_1.PostgresAdapter();
    }
    createIntrospector(db) {
        return new postgres_introspector_js_1.PostgresIntrospector(db);
    }
}
exports.PostgresDialect = PostgresDialect;
