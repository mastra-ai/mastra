import { QueryResult } from '../../driver/database-connection.js';
import { RootOperationNode } from '../../query-compiler/query-compiler.js';
import { UnknownRow } from '../../util/type-utils.js';
import { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs } from '../kysely-plugin.js';
export interface ParseJSONResultsPluginOptions {
    /**
     * When `'in-place'`, arrays' and objects' values are parsed in-place. This is
     * the most time and space efficient option.
     *
     * This can result in runtime errors if some objects/arrays are readonly.
     *
     * When `'create'`, new arrays and objects are created to avoid such errors.
     *
     * Defaults to `'in-place'`.
     */
    objectStrategy?: ObjectStrategy;
}
type ObjectStrategy = 'in-place' | 'create';
/**
 * Parses JSON strings in query results into JSON objects.
 *
 * This plugin can be useful with dialects that don't automatically parse
 * JSON into objects and arrays but return JSON strings instead.
 *
 * To apply this plugin globally, pass an instance of it to the `plugins` option
 * when creating a new `Kysely` instance:
 *
 * ```ts
 * import * as Sqlite from 'better-sqlite3'
 * import { Kysely, ParseJSONResultsPlugin, SqliteDialect } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [new ParseJSONResultsPlugin()],
 * })
 * ```
 *
 * To apply this plugin to a single query:
 *
 * ```ts
 * import { ParseJSONResultsPlugin } from 'kysely'
 * import { jsonArrayFrom } from 'kysely/helpers/sqlite'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     'first_name',
 *     'last_name',
 *     jsonArrayFrom(
 *       eb.selectFrom('pet')
 *         .whereRef('owner_id', '=', 'person.id')
 *         .select(['name', 'species'])
 *     ).as('pets')
 *   ])
 *   .withPlugin(new ParseJSONResultsPlugin())
 *   .execute()
 * ```
 */
export declare class ParseJSONResultsPlugin implements KyselyPlugin {
    #private;
    readonly opt: ParseJSONResultsPluginOptions;
    constructor(opt?: ParseJSONResultsPluginOptions);
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
}
export {};
