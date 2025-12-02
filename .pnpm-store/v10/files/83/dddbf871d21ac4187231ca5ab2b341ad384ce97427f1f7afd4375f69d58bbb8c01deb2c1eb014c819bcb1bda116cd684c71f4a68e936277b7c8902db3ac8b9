"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSchemaBuilder = void 0;
const create_schema_node_js_1 = require("../operation-node/create-schema-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
class CreateSchemaBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    ifNotExists() {
        return new CreateSchemaBuilder({
            ...this.#props,
            node: create_schema_node_js_1.CreateSchemaNode.cloneWith(this.#props.node, { ifNotExists: true }),
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
exports.CreateSchemaBuilder = CreateSchemaBuilder;
