/// <reference types="./drop-view-builder.d.ts" />
import { freeze } from '../util/object-utils.js';
import { DropViewNode } from '../operation-node/drop-view-node.js';
export class DropViewBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    materialized() {
        return new DropViewBuilder({
            ...this.#props,
            node: DropViewNode.cloneWith(this.#props.node, {
                materialized: true,
            }),
        });
    }
    ifExists() {
        return new DropViewBuilder({
            ...this.#props,
            node: DropViewNode.cloneWith(this.#props.node, {
                ifExists: true,
            }),
        });
    }
    cascade() {
        return new DropViewBuilder({
            ...this.#props,
            node: DropViewNode.cloneWith(this.#props.node, {
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
