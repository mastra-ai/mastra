import { ForeignKeyConstraintNode } from '../operation-node/foreign-key-constraint-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OnModifyForeignAction } from '../operation-node/references-node.js';
export interface ForeignKeyConstraintBuilderInterface<R> {
    onDelete(onDelete: OnModifyForeignAction): R;
    onUpdate(onUpdate: OnModifyForeignAction): R;
    deferrable(): R;
    notDeferrable(): R;
    initiallyDeferred(): R;
    initiallyImmediate(): R;
}
export declare class ForeignKeyConstraintBuilder implements ForeignKeyConstraintBuilderInterface<ForeignKeyConstraintBuilder>, OperationNodeSource {
    #private;
    constructor(node: ForeignKeyConstraintNode);
    onDelete(onDelete: OnModifyForeignAction): ForeignKeyConstraintBuilder;
    onUpdate(onUpdate: OnModifyForeignAction): ForeignKeyConstraintBuilder;
    deferrable(): ForeignKeyConstraintBuilder;
    notDeferrable(): ForeignKeyConstraintBuilder;
    initiallyDeferred(): ForeignKeyConstraintBuilder;
    initiallyImmediate(): ForeignKeyConstraintBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): ForeignKeyConstraintNode;
}
export type ForeignKeyConstraintBuilderCallback = (builder: ForeignKeyConstraintBuilder) => ForeignKeyConstraintBuilder;
