import { DropTypeNode } from '../operation-node/drop-type-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
export declare class DropTypeBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: DropTypeBuilderProps);
    ifExists(): DropTypeBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): DropTypeNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface DropTypeBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: DropTypeNode;
}
