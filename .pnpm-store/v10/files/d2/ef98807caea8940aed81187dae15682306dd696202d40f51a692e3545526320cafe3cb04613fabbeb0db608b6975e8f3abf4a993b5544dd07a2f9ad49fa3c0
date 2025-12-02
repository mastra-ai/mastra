"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForeignKeyConstraintBuilder = void 0;
const foreign_key_constraint_node_js_1 = require("../operation-node/foreign-key-constraint-node.js");
const on_modify_action_parser_js_1 = require("../parser/on-modify-action-parser.js");
class ForeignKeyConstraintBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    onDelete(onDelete) {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, {
            onDelete: (0, on_modify_action_parser_js_1.parseOnModifyForeignAction)(onDelete),
        }));
    }
    onUpdate(onUpdate) {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, {
            onUpdate: (0, on_modify_action_parser_js_1.parseOnModifyForeignAction)(onUpdate),
        }));
    }
    deferrable() {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, { deferrable: true }));
    }
    notDeferrable() {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, { deferrable: false }));
    }
    initiallyDeferred() {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, {
            initiallyDeferred: true,
        }));
    }
    initiallyImmediate() {
        return new ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.cloneWith(this.#node, {
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
exports.ForeignKeyConstraintBuilder = ForeignKeyConstraintBuilder;
