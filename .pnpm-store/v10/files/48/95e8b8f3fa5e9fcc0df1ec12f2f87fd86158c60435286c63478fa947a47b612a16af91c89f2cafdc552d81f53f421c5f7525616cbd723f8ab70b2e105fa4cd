import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OnModifyForeignAction } from '../operation-node/references-node.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { Compilable } from '../util/compilable.js';
import { QueryId } from '../util/query-id.js';
import { ForeignKeyConstraintBuilder, ForeignKeyConstraintBuilderInterface } from './foreign-key-constraint-builder.js';
export declare class AlterTableAddForeignKeyConstraintBuilder implements ForeignKeyConstraintBuilderInterface<AlterTableAddForeignKeyConstraintBuilder>, OperationNodeSource, Compilable {
    #private;
    constructor(props: AlterTableAddForeignKeyConstraintBuilderProps);
    onDelete(onDelete: OnModifyForeignAction): AlterTableAddForeignKeyConstraintBuilder;
    onUpdate(onUpdate: OnModifyForeignAction): AlterTableAddForeignKeyConstraintBuilder;
    deferrable(): AlterTableAddForeignKeyConstraintBuilder;
    notDeferrable(): AlterTableAddForeignKeyConstraintBuilder;
    initiallyDeferred(): AlterTableAddForeignKeyConstraintBuilder;
    initiallyImmediate(): AlterTableAddForeignKeyConstraintBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): AlterTableNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface AlterTableAddForeignKeyConstraintBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: AlterTableNode;
    readonly constraintBuilder: ForeignKeyConstraintBuilder;
}
