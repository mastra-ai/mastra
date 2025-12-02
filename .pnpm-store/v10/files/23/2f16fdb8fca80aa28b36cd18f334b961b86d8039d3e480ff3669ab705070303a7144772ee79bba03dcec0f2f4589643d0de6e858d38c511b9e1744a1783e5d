import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { PrimaryKeyConstraintNode } from '../operation-node/primary-key-constraint-node.js';
export declare class PrimaryKeyConstraintBuilder implements OperationNodeSource {
    #private;
    constructor(node: PrimaryKeyConstraintNode);
    deferrable(): PrimaryKeyConstraintBuilder;
    notDeferrable(): PrimaryKeyConstraintBuilder;
    initiallyDeferred(): PrimaryKeyConstraintBuilder;
    initiallyImmediate(): PrimaryKeyConstraintBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): PrimaryKeyConstraintNode;
}
export type PrimaryKeyConstraintBuilderCallback = (builder: PrimaryKeyConstraintBuilder) => PrimaryKeyConstraintBuilder;
