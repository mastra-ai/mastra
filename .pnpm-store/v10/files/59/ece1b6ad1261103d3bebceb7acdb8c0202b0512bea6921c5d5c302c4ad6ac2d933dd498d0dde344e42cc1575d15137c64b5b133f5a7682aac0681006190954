/// <reference types="./alter-table-drop-constraint-builder.d.ts" />
import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { DropConstraintNode } from '../operation-node/drop-constraint-node.js';
import { freeze } from '../util/object-utils.js';
export class AlterTableDropConstraintBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    ifExists() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
                    ifExists: true,
                }),
            }),
        });
    }
    cascade() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
                    modifier: 'cascade',
                }),
            }),
        });
    }
    restrict() {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: DropConstraintNode.cloneWith(this.#props.node.dropConstraint, {
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
