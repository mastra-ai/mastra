import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
import { CreateTypeNode } from '../operation-node/create-type-node.js';
export declare class CreateTypeBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: CreateTypeBuilderProps);
    toOperationNode(): CreateTypeNode;
    /**
     * Creates an anum type.
     *
     * ### Examples
     *
     * ```ts
     * db.schema.createType('species').asEnum(['cat', 'dog', 'frog'])
     * ```
     */
    asEnum(values: readonly string[]): CreateTypeBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface CreateTypeBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: CreateTypeNode;
}
