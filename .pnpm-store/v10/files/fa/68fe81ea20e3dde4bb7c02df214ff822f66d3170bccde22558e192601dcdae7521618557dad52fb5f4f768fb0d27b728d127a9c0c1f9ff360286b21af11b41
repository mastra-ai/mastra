import { QueryResult } from '../../driver/database-connection.js';
import { RootOperationNode } from '../../query-compiler/query-compiler.js';
import { UnknownRow } from '../../util/type-utils.js';
import { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs } from '../kysely-plugin.js';
export interface CamelCasePluginOptions {
    /**
     * If true, camelCase is transformed into upper case SNAKE_CASE.
     * For example `fooBar => FOO_BAR` and `FOO_BAR => fooBar`
     *
     * Defaults to false.
     */
    upperCase?: boolean;
    /**
     * If true, an underscore is added before each digit when converting
     * camelCase to snake_case. For example `foo12Bar => foo_12_bar` and
     * `foo_12_bar => foo12Bar`
     *
     * Defaults to false.
     */
    underscoreBeforeDigits?: boolean;
    /**
     * If true, an underscore is added between consecutive upper case
     * letters when converting from camelCase to snake_case. For example
     * `fooBAR => foo_b_a_r` and `foo_b_a_r => fooBAR`.
     *
     * Defaults to false.
     */
    underscoreBetweenUppercaseLetters?: boolean;
    /**
     * If true, nested object's keys will not be converted to camel case.
     *
     * Defaults to false.
     */
    maintainNestedObjectKeys?: boolean;
}
/**
 * A plugin that converts snake_case identifiers in the database into
 * camelCase in the JavaScript side.
 *
 * For example let's assume we have a table called `person_table`
 * with columns `first_name` and `last_name` in the database. When
 * using `CamelCasePlugin` we would setup Kysely like this:
 *
 * ```ts
 * import * as Sqlite from 'better-sqlite3'
 * import { CamelCasePlugin, Kysely, SqliteDialect } from 'kysely'
 *
 * interface CamelCasedDatabase {
 *   userMetadata: {
 *     firstName: string
 *     lastName: string
 *   }
 * }
 *
 * const db = new Kysely<CamelCasedDatabase>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [new CamelCasePlugin()],
 * })
 *
 * const person = await db.selectFrom('userMetadata')
 *   .where('firstName', '=', 'Arnold')
 *   .select(['firstName', 'lastName'])
 *   .executeTakeFirst()
 *
 * if (person) {
 *   console.log(person.firstName)
 * }
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select "first_name", "last_name" from "user_metadata" where "first_name" = ?
 * ```
 *
 * As you can see from the example, __everything__ needs to be defined
 * in camelCase in the TypeScript code: table names, columns, schemas,
 * __everything__. When using the `CamelCasePlugin` Kysely works as if
 * the database was defined in camelCase.
 *
 * There are various options you can give to the plugin to modify
 * the way identifiers are converted. See {@link CamelCasePluginOptions}.
 * If those options are not enough, you can override this plugin's
 * `snakeCase` and `camelCase` methods to make the conversion exactly
 * the way you like:
 *
 * ```ts
 * class MyCamelCasePlugin extends CamelCasePlugin {
 *   protected override snakeCase(str: string): string {
 *     // ...
 *
 *     return str
 *   }
 *
 *   protected override camelCase(str: string): string {
 *     // ...
 *
 *     return str
 *   }
 * }
 * ```
 */
export declare class CamelCasePlugin implements KyselyPlugin {
    #private;
    readonly opt: CamelCasePluginOptions;
    constructor(opt?: CamelCasePluginOptions);
    /**
     * This is called for each query before it is executed. You can modify the query by
     * transforming its {@link OperationNode} tree provided in {@link PluginTransformQueryArgs.node | args.node}
     * and returning the transformed tree. You'd usually want to use an {@link OperationNodeTransformer}
     * for this.
     *
     * If you need to pass some query-related data between this method and `transformResult` you
     * can use a `WeakMap` with {@link PluginTransformQueryArgs.queryId | args.queryId} as the key:
     *
     * ```ts
     * import type {
     *   KyselyPlugin,
     *   QueryResult,
     *   RootOperationNode,
     *   UnknownRow
     * } from 'kysely'
     *
     * interface MyData {
     *   // ...
     * }
     * const data = new WeakMap<any, MyData>()
     *
     * const plugin = {
     *   transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
     *     const something: MyData = {}
     *
     *     // ...
     *
     *     data.set(args.queryId, something)
     *
     *     // ...
     *
     *     return args.node
     *   },
     *
     *   async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
     *     // ...
     *
     *     const something = data.get(args.queryId)
     *
     *     // ...
     *
     *     return args.result
     *   }
     * } satisfies KyselyPlugin
     * ```
     *
     * You should use a `WeakMap` instead of a `Map` or some other strong references because `transformQuery`
     * is not always matched by a call to `transformResult` which would leave orphaned items in the map
     * and cause a memory leak.
     */
    transformQuery(args: PluginTransformQueryArgs): RootOperationNode;
    /**
     * This method is called for each query after it has been executed. The result
     * of the query can be accessed through {@link PluginTransformResultArgs.result | args.result}.
     * You can modify the result and return the modifier result.
     */
    transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>>;
    protected mapRow(row: UnknownRow): UnknownRow;
    protected snakeCase(str: string): string;
    protected camelCase(str: string): string;
}
