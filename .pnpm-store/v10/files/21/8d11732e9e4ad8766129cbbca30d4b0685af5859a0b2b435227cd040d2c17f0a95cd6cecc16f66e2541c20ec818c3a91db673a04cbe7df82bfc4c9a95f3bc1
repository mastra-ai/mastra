"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueConstraintNodeBuilder = void 0;
const unique_constraint_node_js_1 = require("../operation-node/unique-constraint-node.js");
class UniqueConstraintNodeBuilder {
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
        return new UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.cloneWith(this.#node, { nullsNotDistinct: true }));
    }
    deferrable() {
        return new UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.cloneWith(this.#node, { deferrable: true }));
    }
    notDeferrable() {
        return new UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.cloneWith(this.#node, { deferrable: false }));
    }
    initiallyDeferred() {
        return new UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: true,
        }));
    }
    initiallyImmediate() {
        return new UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.cloneWith(this.#node, {
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
exports.UniqueConstraintNodeBuilder = UniqueConstraintNodeBuilder;
