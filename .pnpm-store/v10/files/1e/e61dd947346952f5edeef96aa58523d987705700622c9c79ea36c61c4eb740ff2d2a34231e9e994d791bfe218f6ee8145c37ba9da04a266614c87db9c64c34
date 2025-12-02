"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverBuilder = void 0;
const over_node_js_1 = require("../operation-node/over-node.js");
const query_node_js_1 = require("../operation-node/query-node.js");
const order_by_parser_js_1 = require("../parser/order-by-parser.js");
const partition_by_parser_js_1 = require("../parser/partition-by-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class OverBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    orderBy(...args) {
        return new OverBuilder({
            overNode: over_node_js_1.OverNode.cloneWithOrderByItems(this.#props.overNode, (0, order_by_parser_js_1.parseOrderBy)(args)),
        });
    }
    clearOrderBy() {
        return new OverBuilder({
            overNode: query_node_js_1.QueryNode.cloneWithoutOrderBy(this.#props.overNode),
        });
    }
    partitionBy(partitionBy) {
        return new OverBuilder({
            overNode: over_node_js_1.OverNode.cloneWithPartitionByItems(this.#props.overNode, (0, partition_by_parser_js_1.parsePartitionBy)(partitionBy)),
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
        return this.#props.overNode;
    }
}
exports.OverBuilder = OverBuilder;
