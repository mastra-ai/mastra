import { DropIndexNode } from '../operation-node/drop-index-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
export declare class DropIndexBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: DropIndexBuilderProps);
    /**
     * Specifies the table the index was created for. This is not needed
     * in all dialects.
     */
    on(table: string): DropIndexBuilder;
    ifExists(): DropIndexBuilder;
    cascade(): DropIndexBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): DropIndexNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface DropIndexBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: DropIndexNode;
}
