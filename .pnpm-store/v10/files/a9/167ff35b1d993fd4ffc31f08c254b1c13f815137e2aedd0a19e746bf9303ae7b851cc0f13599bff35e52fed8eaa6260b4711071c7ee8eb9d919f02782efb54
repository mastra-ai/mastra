/// <reference types="./primary-key-constraint-builder.d.ts" />
import { PrimaryKeyConstraintNode } from '../operation-node/primary-key-constraint-node.js';
export class PrimaryKeyConstraintBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    deferrable() {
        return new PrimaryKeyConstraintBuilder(PrimaryKeyConstraintNode.cloneWith(this.#node, { deferrable: true }));
    }
    notDeferrable() {
        return new PrimaryKeyConstraintBuilder(PrimaryKeyConstraintNode.cloneWith(this.#node, { deferrable: false }));
    }
    initiallyDeferred() {
        return new PrimaryKeyConstraintBuilder(PrimaryKeyConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: true,
        }));
    }
    initiallyImmediate() {
        return new PrimaryKeyConstraintBuilder(PrimaryKeyConstraintNode.cloneWith(this.#node, {
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
