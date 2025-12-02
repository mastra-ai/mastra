"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryNode = void 0;
const insert_query_node_js_1 = require("./insert-query-node.js");
const select_query_node_js_1 = require("./select-query-node.js");
const update_query_node_js_1 = require("./update-query-node.js");
const delete_query_node_js_1 = require("./delete-query-node.js");
const where_node_js_1 = require("./where-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const returning_node_js_1 = require("./returning-node.js");
const explain_node_js_1 = require("./explain-node.js");
const merge_query_node_js_1 = require("./merge-query-node.js");
const output_node_js_1 = require("./output-node.js");
const order_by_node_js_1 = require("./order-by-node.js");
/**
 * @internal
 */
exports.QueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return (select_query_node_js_1.SelectQueryNode.is(node) ||
            insert_query_node_js_1.InsertQueryNode.is(node) ||
            update_query_node_js_1.UpdateQueryNode.is(node) ||
            delete_query_node_js_1.DeleteQueryNode.is(node) ||
            merge_query_node_js_1.MergeQueryNode.is(node));
    },
    cloneWithEndModifier(node, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            endModifiers: node.endModifiers
                ? (0, object_utils_js_1.freeze)([...node.endModifiers, modifier])
                : (0, object_utils_js_1.freeze)([modifier]),
        });
    },
    cloneWithWhere(node, operation) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            where: node.where
                ? where_node_js_1.WhereNode.cloneWithOperation(node.where, 'And', operation)
                : where_node_js_1.WhereNode.create(operation),
        });
    },
    cloneWithJoin(node, join) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            joins: node.joins ? (0, object_utils_js_1.freeze)([...node.joins, join]) : (0, object_utils_js_1.freeze)([join]),
        });
    },
    cloneWithReturning(node, selections) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            returning: node.returning
                ? returning_node_js_1.ReturningNode.cloneWithSelections(node.returning, selections)
                : returning_node_js_1.ReturningNode.create(selections),
        });
    },
    cloneWithoutReturning(node) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            returning: undefined,
        });
    },
    cloneWithoutWhere(node) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            where: undefined,
        });
    },
    cloneWithExplain(node, format, options) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            explain: explain_node_js_1.ExplainNode.create(format, options?.toOperationNode()),
        });
    },
    cloneWithTop(node, top) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            top,
        });
    },
    cloneWithOutput(node, selections) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            output: node.output
                ? output_node_js_1.OutputNode.cloneWithSelections(node.output, selections)
                : output_node_js_1.OutputNode.create(selections),
        });
    },
    cloneWithOrderByItems(node, items) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            orderBy: node.orderBy
                ? order_by_node_js_1.OrderByNode.cloneWithItems(node.orderBy, items)
                : order_by_node_js_1.OrderByNode.create(items),
        });
    },
    cloneWithoutOrderBy(node) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            orderBy: undefined,
        });
    },
});
