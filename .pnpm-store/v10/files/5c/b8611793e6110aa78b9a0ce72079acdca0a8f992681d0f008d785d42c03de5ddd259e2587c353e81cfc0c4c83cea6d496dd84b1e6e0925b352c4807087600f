/// <reference types="./alter-table-executor.d.ts" />
import { freeze } from '../util/object-utils.js';
export class AlterTableExecutor {
    #props;
    constructor(props) {
        this.#props = freeze(props);
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
