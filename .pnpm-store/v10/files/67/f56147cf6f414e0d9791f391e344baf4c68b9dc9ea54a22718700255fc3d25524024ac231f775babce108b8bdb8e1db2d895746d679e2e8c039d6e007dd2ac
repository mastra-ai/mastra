"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateQueryNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const from_node_js_1 = require("./from-node.js");
const list_node_js_1 = require("./list-node.js");
/**
 * @internal
 */
exports.UpdateQueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'UpdateQueryNode';
    },
    create(tables, withNode) {
        return (0, object_utils_js_1.freeze)({
            kind: 'UpdateQueryNode',
            // For backwards compatibility, use the raw table node when there's only one table
            // and don't rename the property to something like `tables`.
            table: tables.length === 1 ? tables[0] : list_node_js_1.ListNode.create(tables),
            ...(withNode && { with: withNode }),
        });
    },
    createWithoutTable() {
        return (0, object_utils_js_1.freeze)({
            kind: 'UpdateQueryNode',
        });
    },
    cloneWithFromItems(updateQuery, fromItems) {
        return (0, object_utils_js_1.freeze)({
            ...updateQuery,
            from: updateQuery.from
                ? from_node_js_1.FromNode.cloneWithFroms(updateQuery.from, fromItems)
                : from_node_js_1.FromNode.create(fromItems),
        });
    },
    cloneWithUpdates(updateQuery, updates) {
        return (0, object_utils_js_1.freeze)({
            ...updateQuery,
            updates: updateQuery.updates
                ? (0, object_utils_js_1.freeze)([...updateQuery.updates, ...updates])
                : updates,
        });
    },
    cloneWithLimit(updateQuery, limit) {
        return (0, object_utils_js_1.freeze)({
            ...updateQuery,
            limit,
        });
    },
});
