/// <reference types="./drop-schema-builder.d.ts" />
import { DropSchemaNode } from '../operation-node/drop-schema-node.js';
import { freeze } from '../util/object-utils.js';
export class DropSchemaBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    ifExists() {
        return new DropSchemaBuilder({
            ...this.#props,
            node: DropSchemaNode.cloneWith(this.#props.node, {
                ifExists: true,
            }),
        });
    }
    cascade() {
        return new DropSchemaBuilder({
            ...this.#props,
            node: DropSchemaNode.cloneWith(this.#props.node, {
                cascade: true,
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
