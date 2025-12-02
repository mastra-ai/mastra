"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTypeBuilder = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const create_type_node_js_1 = require("../operation-node/create-type-node.js");
class CreateTypeBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.node, this.#props.queryId);
    }
    /**
     * Creates an anum type.
     *
     * ### Examples
     *
     * ```ts
     * db.schema.createType('species').asEnum(['cat', 'dog', 'frog'])
     * ```
     */
    asEnum(values) {
        return new CreateTypeBuilder({
            ...this.#props,
            node: create_type_node_js_1.CreateTypeNode.cloneWithEnum(this.#props.node, values),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
exports.CreateTypeBuilder = CreateTypeBuilder;
