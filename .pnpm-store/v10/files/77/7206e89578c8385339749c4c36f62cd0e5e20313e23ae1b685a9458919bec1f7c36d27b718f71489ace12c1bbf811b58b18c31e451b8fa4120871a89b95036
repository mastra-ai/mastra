import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { Compilable } from '../util/compilable.js';
import { QueryId } from '../util/query-id.js';
export declare class AlterTableExecutor implements OperationNodeSource, Compilable {
    #private;
    constructor(props: AlterTableExecutorProps);
    toOperationNode(): AlterTableNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface AlterTableExecutorProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: AlterTableNode;
}
