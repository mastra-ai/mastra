import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CheckConstraintNode } from '../operation-node/check-constraint-node.js';
export declare class CheckConstraintBuilder implements OperationNodeSource {
    #private;
    constructor(node: CheckConstraintNode);
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): CheckConstraintNode;
}
export type CheckConstraintBuilderCallback = (builder: CheckConstraintBuilder) => CheckConstraintBuilder;
