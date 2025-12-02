/// <reference types="./create-schema-builder.d.ts" />
import { CreateSchemaNode } from '../operation-node/create-schema-node.js';
import { freeze } from '../util/object-utils.js';
export class CreateSchemaBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    ifNotExists() {
        return new CreateSchemaBuilder({
            ...this.#props,
            node: CreateSchemaNode.cloneWith(this.#props.node, { ifNotExists: true }),
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
