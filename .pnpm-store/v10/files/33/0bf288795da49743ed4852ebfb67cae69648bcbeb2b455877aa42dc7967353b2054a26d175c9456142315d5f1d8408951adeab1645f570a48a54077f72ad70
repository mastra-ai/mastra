import { QueryResult } from '../driver/database-connection.js';
import { RootOperationNode } from '../query-compiler/query-compiler.js';
import { QueryId } from '../util/query-id.js';
import { UnknownRow } from '../util/type-utils.js';
export interface KyselyPlugin {
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
export interface PluginTransformQueryArgs {
    readonly queryId: QueryId;
    readonly node: RootOperationNode;
}
export interface PluginTransformResultArgs {
    readonly queryId: QueryId;
    readonly result: QueryResult<UnknownRow>;
}
