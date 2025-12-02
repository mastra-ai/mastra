import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
import { RefreshMaterializedViewNode } from '../operation-node/refresh-materialized-view-node.js';
export declare class RefreshMaterializedViewBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: RefreshMaterializedViewBuilderProps);
    /**
     * Adds the "concurrently" modifier.
     *
     * Use this to refresh the view without locking out concurrent selects on the materialized view.
     *
     * WARNING!
     * This cannot be used with the "with no data" modifier.
     */
    concurrently(): RefreshMaterializedViewBuilder;
    /**
     * Adds the "with data" modifier.
     *
     * If specified (or defaults) the backing query is executed to provide the new data, and the materialized view is left in a scannable state
     */
    withData(): RefreshMaterializedViewBuilder;
    /**
     * Adds the "with no data" modifier.
     *
     * If specified, no new data is generated and the materialized view is left in an unscannable state.
     *
     * WARNING!
     * This cannot be used with the "concurrently" modifier.
     */
    withNoData(): RefreshMaterializedViewBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): RefreshMaterializedViewNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface RefreshMaterializedViewBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: RefreshMaterializedViewNode;
}
