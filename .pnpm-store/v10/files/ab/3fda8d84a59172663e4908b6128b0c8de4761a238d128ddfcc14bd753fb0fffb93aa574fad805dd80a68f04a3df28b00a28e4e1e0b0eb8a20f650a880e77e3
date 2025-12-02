import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { UniqueConstraintNode } from '../operation-node/unique-constraint-node.js';
export declare class UniqueConstraintNodeBuilder implements OperationNodeSource {
    #private;
    constructor(node: UniqueConstraintNode);
    /**
     * Adds `nulls not distinct` to the unique constraint definition
     *
     * Supported by PostgreSQL dialect only
     */
    nullsNotDistinct(): UniqueConstraintNodeBuilder;
    deferrable(): UniqueConstraintNodeBuilder;
    notDeferrable(): UniqueConstraintNodeBuilder;
    initiallyDeferred(): UniqueConstraintNodeBuilder;
    initiallyImmediate(): UniqueConstraintNodeBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): UniqueConstraintNode;
}
export type UniqueConstraintNodeBuilderCallback = (builder: UniqueConstraintNodeBuilder) => UniqueConstraintNodeBuilder;
