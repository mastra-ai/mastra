"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlDialect = void 0;
const mssql_adapter_js_1 = require("./mssql-adapter.js");
const mssql_driver_js_1 = require("./mssql-driver.js");
const mssql_introspector_js_1 = require("./mssql-introspector.js");
const mssql_query_compiler_js_1 = require("./mssql-query-compiler.js");
/**
 * MS SQL Server dialect that uses the [tedious](https://tediousjs.github.io/tedious)
 * library.
 *
 * The constructor takes an instance of {@link MssqlDialectConfig}.
 *
 * ```ts
 * import * as Tedious from 'tedious'
 * import * as Tarn from 'tarn'
 *
 * const dialect = new MssqlDialect({
 *   tarn: {
 *     ...Tarn,
 *     options: {
 *       min: 0,
 *       max: 10,
 *     },
 *   },
 *   tedious: {
 *     ...Tedious,
 *     connectionFactory: () => new Tedious.Connection({
 *       authentication: {
 *         options: {
 *           password: 'password',
 *           userName: 'username',
 *         },
 *         type: 'default',
 *       },
 *       options: {
 *         database: 'some_db',
 *         port: 1433,
 *         trustServerCertificate: true,
 *       },
 *       server: 'localhost',
 *     }),
 *   },
 * })
 * ```
 */
class MssqlDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new mssql_driver_js_1.MssqlDriver(this.#config);
    }
    createQueryCompiler() {
        return new mssql_query_compiler_js_1.MssqlQueryCompiler();
    }
    createAdapter() {
        return new mssql_adapter_js_1.MssqlAdapter();
    }
    createIntrospector(db) {
        return new mssql_introspector_js_1.MssqlIntrospector(db);
    }
}
exports.MssqlDialect = MssqlDialect;
