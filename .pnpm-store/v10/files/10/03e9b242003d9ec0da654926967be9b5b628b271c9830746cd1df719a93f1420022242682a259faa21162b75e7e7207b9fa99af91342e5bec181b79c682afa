"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryKeyConstraintBuilder = void 0;
const primary_key_constraint_node_js_1 = require("../operation-node/primary-key-constraint-node.js");
class PrimaryKeyConstraintBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    deferrable() {
        return new PrimaryKeyConstraintBuilder(primary_key_constraint_node_js_1.PrimaryKeyConstraintNode.cloneWith(this.#node, { deferrable: true }));
    }
    notDeferrable() {
        return new PrimaryKeyConstraintBuilder(primary_key_constraint_node_js_1.PrimaryKeyConstraintNode.cloneWith(this.#node, { deferrable: false }));
    }
    initiallyDeferred() {
        return new PrimaryKeyConstraintBuilder(primary_key_constraint_node_js_1.PrimaryKeyConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: true,
        }));
    }
    initiallyImmediate() {
        return new PrimaryKeyConstraintBuilder(primary_key_constraint_node_js_1.PrimaryKeyConstraintNode.cloneWith(this.#node, {
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
exports.PrimaryKeyConstraintBuilder = PrimaryKeyConstraintBuilder;
