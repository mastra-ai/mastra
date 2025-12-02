"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlDialect = void 0;
const mysql_driver_js_1 = require("./mysql-driver.js");
const mysql_query_compiler_js_1 = require("./mysql-query-compiler.js");
const mysql_introspector_js_1 = require("./mysql-introspector.js");
const mysql_adapter_js_1 = require("./mysql-adapter.js");
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
class MysqlDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new mysql_driver_js_1.MysqlDriver(this.#config);
    }
    createQueryCompiler() {
        return new mysql_query_compiler_js_1.MysqlQueryCompiler();
    }
    createAdapter() {
        return new mysql_adapter_js_1.MysqlAdapter();
    }
    createIntrospector(db) {
        return new mysql_introspector_js_1.MysqlIntrospector(db);
    }
}
exports.MysqlDialect = MysqlDialect;
