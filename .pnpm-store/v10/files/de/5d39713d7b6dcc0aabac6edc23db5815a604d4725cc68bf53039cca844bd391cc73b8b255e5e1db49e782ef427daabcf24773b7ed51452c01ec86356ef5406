import { Driver } from '../../driver/driver.js';
import { Kysely } from '../../kysely.js';
import { QueryCompiler } from '../../query-compiler/query-compiler.js';
import { DatabaseIntrospector } from '../database-introspector.js';
import { DialectAdapter } from '../dialect-adapter.js';
import { Dialect } from '../dialect.js';
import { MssqlDialectConfig } from './mssql-dialect-config.js';
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
export declare class MssqlDialect implements Dialect {
    #private;
    constructor(config: MssqlDialectConfig);
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
