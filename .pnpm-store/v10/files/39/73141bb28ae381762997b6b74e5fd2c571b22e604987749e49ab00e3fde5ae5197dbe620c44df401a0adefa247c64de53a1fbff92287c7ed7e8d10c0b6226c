import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { Compilable } from '../util/compilable.js';
import { QueryId } from '../util/query-id.js';
export declare class AlterTableDropConstraintBuilder implements OperationNodeSource, Compilable {
    #private;
    constructor(props: AlterTableDropConstraintBuilderProps);
    ifExists(): AlterTableDropConstraintBuilder;
    cascade(): AlterTableDropConstraintBuilder;
    restrict(): AlterTableDropConstraintBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): AlterTableNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface AlterTableDropConstraintBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: AlterTableNode;
}
