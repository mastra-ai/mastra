/// <reference types="./mssql-dialect.d.ts" />
import { MssqlAdapter } from './mssql-adapter.js';
import { MssqlDriver } from './mssql-driver.js';
import { MssqlIntrospector } from './mssql-introspector.js';
import { MssqlQueryCompiler } from './mssql-query-compiler.js';
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
export class MssqlDialect {
    #config;
    constructor(config) {
        this.#config = config;
    }
    createDriver() {
        return new MssqlDriver(this.#config);
    }
    createQueryCompiler() {
        return new MssqlQueryCompiler();
    }
    createAdapter() {
        return new MssqlAdapter();
    }
    createIntrospector(db) {
        return new MssqlIntrospector(db);
    }
}
