"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const order_by_node_js_1 = require("./order-by-node.js");
const partition_by_node_js_1 = require("./partition-by-node.js");
/**
 * @internal
 */
exports.OverNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OverNode';
    },
    create() {
        return (0, object_utils_js_1.freeze)({
            kind: 'OverNode',
        });
    },
    cloneWithOrderByItems(overNode, items) {
        return (0, object_utils_js_1.freeze)({
            ...overNode,
            orderBy: overNode.orderBy
                ? order_by_node_js_1.OrderByNode.cloneWithItems(overNode.orderBy, items)
                : order_by_node_js_1.OrderByNode.create(items),
        });
    },
    cloneWithPartitionByItems(overNode, items) {
        return (0, object_utils_js_1.freeze)({
            ...overNode,
            partitionBy: overNode.partitionBy
                ? partition_by_node_js_1.PartitionByNode.cloneWithItems(overNode.partitionBy, items)
                : partition_by_node_js_1.PartitionByNode.create(items),
        });
    },
});
