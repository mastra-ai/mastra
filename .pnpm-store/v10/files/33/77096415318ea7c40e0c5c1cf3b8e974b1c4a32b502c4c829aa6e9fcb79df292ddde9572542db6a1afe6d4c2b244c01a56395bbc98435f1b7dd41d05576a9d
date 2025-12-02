"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDialect = void 0;
const sqlite_driver_js_1 = require("./sqlite-driver.js");
const sqlite_query_compiler_js_1 = require("./sqlite-query-compiler.js");
const sqlite_introspector_js_1 = require("./sqlite-introspector.js");
const sqlite_adapter_js_1 = require("./sqlite-adapter.js");
const object_utils_js_1 = require("../../util/object-utils.js");
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
class SqliteDialect {
    #config;
    constructor(config) {
        this.#config = (0, object_utils_js_1.freeze)({ ...config });
    }
    createDriver() {
        return new sqlite_driver_js_1.SqliteDriver(this.#config);
    }
    createQueryCompiler() {
        return new sqlite_query_compiler_js_1.SqliteQueryCompiler();
    }
    createAdapter() {
        return new sqlite_adapter_js_1.SqliteAdapter();
    }
    createIntrospector(db) {
        return new sqlite_introspector_js_1.SqliteIntrospector(db);
    }
}
exports.SqliteDialect = SqliteDialect;
