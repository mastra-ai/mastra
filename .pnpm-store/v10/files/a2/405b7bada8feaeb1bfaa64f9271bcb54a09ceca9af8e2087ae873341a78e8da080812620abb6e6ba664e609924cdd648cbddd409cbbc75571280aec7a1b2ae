"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableDropConstraintBuilder = void 0;
const alter_table_node_js_1 = require("../operation-node/alter-table-node.js");
const drop_constraint_node_js_1 = require("../operation-node/drop-constraint-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
class AlterTableDropConstraintBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    ifExists() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: drop_constraint_node_js_1.DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
                    ifExists: true,
                }),
            }),
        });
    }
    cascade() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: drop_constraint_node_js_1.DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
                    modifier: 'cascade',
                }),
            }),
        });
    }
    restrict() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: drop_constraint_node_js_1.DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
                    modifier: 'restrict',
                }),
            }),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.node, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
exports.AlterTableDropConstraintBuilder = AlterTableDropConstraintBuilder;
