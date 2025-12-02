/// <reference types="./unique-constraint-builder.d.ts" />
import { UniqueConstraintNode } from '../operation-node/unique-constraint-node.js';
export class UniqueConstraintNodeBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /**
     * Adds `nulls not distinct` to the unique constraint definition
     *
     * Supported by PostgreSQL dialect only
     */
    nullsNotDistinct() {
        return new UniqueConstraintNodeBuilder(UniqueConstraintNode.cloneWith(this.#node, { nullsNotDistinct: true }));
    }
    deferrable() {
        return new UniqueConstraintNodeBuilder(UniqueConstraintNode.cloneWith(this.#node, { deferrable: true }));
    }
    notDeferrable() {
        return new UniqueConstraintNodeBuilder(UniqueConstraintNode.cloneWith(this.#node, { deferrable: false }));
    }
    initiallyDeferred() {
        return new UniqueConstraintNodeBuilder(UniqueConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: true,
        }));
    }
    initiallyImmediate() {
        return new UniqueConstraintNodeBuilder(UniqueConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: false,
        }));
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#node;
    }
}
