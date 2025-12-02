"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropIndexBuilder = void 0;
const drop_index_node_js_1 = require("../operation-node/drop-index-node.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class DropIndexBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Specifies the table the index was created for. This is not needed
     * in all dialects.
     */
    on(table) {
        return new DropIndexBuilder({
            ...this.#props,
            node: drop_index_node_js_1.DropIndexNode.cloneWith(this.#props.node, {
                table: (0, table_parser_js_1.parseTable)(table),
            }),
        });
    }
    ifExists() {
        return new DropIndexBuilder({
            ...this.#props,
            node: drop_index_node_js_1.DropIndexNode.cloneWith(this.#props.node, {
                ifExists: true,
            }),
        });
    }
    cascade() {
        return new DropIndexBuilder({
            ...this.#props,
            node: drop_index_node_js_1.DropIndexNode.cloneWith(this.#props.node, {
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
exports.DropIndexBuilder = DropIndexBuilder;
