"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteQueryNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const from_node_js_1 = require("./from-node.js");
const using_node_js_1 = require("./using-node.js");
const query_node_js_1 = require("./query-node.js");
/**
 * @internal
 */
exports.DeleteQueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DeleteQueryNode';
    },
    create(fromItems, withNode) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DeleteQueryNode',
            from: from_node_js_1.FromNode.create(fromItems),
            ...(withNode && { with: withNode }),
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node, items) => query_node_js_1.QueryNode.cloneWithOrderByItems(node, items),
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node) => query_node_js_1.QueryNode.cloneWithoutOrderBy(node),
    cloneWithLimit(deleteNode, limit) {
        return (0, object_utils_js_1.freeze)({
            ...deleteNode,
            limit,
        });
    },
    cloneWithoutLimit(deleteNode) {
        return (0, object_utils_js_1.freeze)({
            ...deleteNode,
            limit: undefined,
        });
    },
    cloneWithUsing(deleteNode, tables) {
        return (0, object_utils_js_1.freeze)({
            ...deleteNode,
            using: deleteNode.using !== undefined
                ? using_node_js_1.UsingNode.cloneWithTables(deleteNode.using, tables)
                : using_node_js_1.UsingNode.create(tables),
        });
    },
});
