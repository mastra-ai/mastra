"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableExecutor = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
class AlterTableExecutor {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
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
exports.AlterTableExecutor = AlterTableExecutor;
