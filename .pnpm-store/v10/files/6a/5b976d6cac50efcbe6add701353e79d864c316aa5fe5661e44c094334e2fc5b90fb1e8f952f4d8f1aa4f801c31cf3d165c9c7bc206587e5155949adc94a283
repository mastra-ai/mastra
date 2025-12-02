import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
import { CreateViewNode } from '../operation-node/create-view-node.js';
import { RawBuilder } from '../raw-builder/raw-builder.js';
import { SelectQueryBuilder } from '../query-builder/select-query-builder.js';
export declare class CreateViewBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: CreateViewBuilderProps);
    /**
     * Adds the "temporary" modifier.
     *
     * Use this to create a temporary view.
     */
    temporary(): CreateViewBuilder;
    materialized(): CreateViewBuilder;
    /**
     * Only implemented on some dialects like SQLite. On most dialects, use {@link orReplace}.
     */
    ifNotExists(): CreateViewBuilder;
    orReplace(): CreateViewBuilder;
    columns(columns: string[]): CreateViewBuilder;
    /**
     * Sets the select query or a `values` statement that creates the view.
     *
     * WARNING!
     * Some dialects don't support parameterized queries in DDL statements and therefore
     * the query or raw {@link sql } expression passed here is interpolated into a single
     * string opening an SQL injection vulnerability. DO NOT pass unchecked user input
     * into the query or raw expression passed to this method!
     */
    as(query: SelectQueryBuilder<any, any, any> | RawBuilder<any>): CreateViewBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): CreateViewNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface CreateViewBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: CreateViewNode;
}
