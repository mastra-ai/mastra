/// <reference types="./drop-type-builder.d.ts" />
import { DropTypeNode } from '../operation-node/drop-type-node.js';
import { freeze } from '../util/object-utils.js';
export class DropTypeBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    ifExists() {
        return new DropTypeBuilder({
            ...this.#props,
            node: DropTypeNode.cloneWith(this.#props.node, {
                ifExists: true,
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
