"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropSchemaBuilder = void 0;
const drop_schema_node_js_1 = require("../operation-node/drop-schema-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
class DropSchemaBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    ifExists() {
        return new DropSchemaBuilder({
            ...this.#props,
            node: drop_schema_node_js_1.DropSchemaNode.cloneWith(this.#props.node, {
                ifExists: true,
            }),
        });
    }
    cascade() {
        return new DropSchemaBuilder({
            ...this.#props,
            node: drop_schema_node_js_1.DropSchemaNode.cloneWith(this.#props.node, {
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
exports.DropSchemaBuilder = DropSchemaBuilder;
