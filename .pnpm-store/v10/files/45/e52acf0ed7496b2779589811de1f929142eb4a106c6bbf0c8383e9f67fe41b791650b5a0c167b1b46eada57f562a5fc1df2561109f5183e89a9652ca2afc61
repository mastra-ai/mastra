/// <reference types="./drop-index-builder.d.ts" />
import { DropIndexNode } from '../operation-node/drop-index-node.js';
import { parseTable } from '../parser/table-parser.js';
import { freeze } from '../util/object-utils.js';
export class DropIndexBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    /**
     * Specifies the table the index was created for. This is not needed
     * in all dialects.
     */
    on(table) {
        return new DropIndexBuilder({
            ...this.#props,
            node: DropIndexNode.cloneWith(this.#props.node, {
                table: parseTable(table),
            }),
        });
    }
    ifExists() {
        return new DropIndexBuilder({
            ...this.#props,
            node: DropIndexNode.cloneWith(this.#props.node, {
                ifExists: true,
            }),
        });
    }
    cascade() {
        return new DropIndexBuilder({
            ...this.#props,
            node: DropIndexNode.cloneWith(this.#props.node, {
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
