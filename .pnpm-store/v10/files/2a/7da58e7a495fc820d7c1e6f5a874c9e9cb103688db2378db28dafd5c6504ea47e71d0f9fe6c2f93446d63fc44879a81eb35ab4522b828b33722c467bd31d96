/// <reference types="./alter-table-add-foreign-key-constraint-builder.d.ts" />
import { AddConstraintNode } from '../operation-node/add-constraint-node.js';
import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { freeze } from '../util/object-utils.js';
export class AlterTableAddForeignKeyConstraintBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    onDelete(onDelete) {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.onDelete(onDelete),
        });
    }
    onUpdate(onUpdate) {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.onUpdate(onUpdate),
        });
    }
    deferrable() {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.deferrable(),
        });
    }
    notDeferrable() {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.notDeferrable(),
        });
    }
    initiallyDeferred() {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.initiallyDeferred(),
        });
    }
    initiallyImmediate() {
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder: this.#props.constraintBuilder.initiallyImmediate(),
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
        return this.#props.executor.transformQuery(AlterTableNode.cloneWithTableProps(this.#props.node, {
            addConstraint: AddConstraintNode.create(this.#props.constraintBuilder.toOperationNode()),
        }), this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
