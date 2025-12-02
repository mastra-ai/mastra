"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectQueryNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const from_node_js_1 = require("./from-node.js");
const group_by_node_js_1 = require("./group-by-node.js");
const having_node_js_1 = require("./having-node.js");
const query_node_js_1 = require("./query-node.js");
/**
 * @internal
 */
exports.SelectQueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'SelectQueryNode';
    },
    create(withNode) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectQueryNode',
            ...(withNode && { with: withNode }),
        });
    },
    createFrom(fromItems, withNode) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectQueryNode',
            from: from_node_js_1.FromNode.create(fromItems),
            ...(withNode && { with: withNode }),
        });
    },
    cloneWithSelections(select, selections) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            selections: select.selections
                ? (0, object_utils_js_1.freeze)([...select.selections, ...selections])
                : (0, object_utils_js_1.freeze)(selections),
        });
    },
    cloneWithDistinctOn(select, expressions) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            distinctOn: select.distinctOn
                ? (0, object_utils_js_1.freeze)([...select.distinctOn, ...expressions])
                : (0, object_utils_js_1.freeze)(expressions),
        });
    },
    cloneWithFrontModifier(select, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            frontModifiers: select.frontModifiers
                ? (0, object_utils_js_1.freeze)([...select.frontModifiers, modifier])
                : (0, object_utils_js_1.freeze)([modifier]),
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node, items) => query_node_js_1.QueryNode.cloneWithOrderByItems(node, items),
    cloneWithGroupByItems(selectNode, items) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            groupBy: selectNode.groupBy
                ? group_by_node_js_1.GroupByNode.cloneWithItems(selectNode.groupBy, items)
                : group_by_node_js_1.GroupByNode.create(items),
        });
    },
    cloneWithLimit(selectNode, limit) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            limit,
        });
    },
    cloneWithOffset(selectNode, offset) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            offset,
        });
    },
    cloneWithFetch(selectNode, fetch) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            fetch,
        });
    },
    cloneWithHaving(selectNode, operation) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            having: selectNode.having
                ? having_node_js_1.HavingNode.cloneWithOperation(selectNode.having, 'And', operation)
                : having_node_js_1.HavingNode.create(operation),
        });
    },
    cloneWithSetOperations(selectNode, setOperations) {
        return (0, object_utils_js_1.freeze)({
            ...selectNode,
            setOperations: selectNode.setOperations
                ? (0, object_utils_js_1.freeze)([...selectNode.setOperations, ...setOperations])
                : (0, object_utils_js_1.freeze)([...setOperations]),
        });
    },
    cloneWithoutSelections(select) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            selections: [],
        });
    },
    cloneWithoutLimit(select) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            limit: undefined,
        });
    },
    cloneWithoutOffset(select) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            offset: undefined,
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node) => query_node_js_1.QueryNode.cloneWithoutOrderBy(node),
    cloneWithoutGroupBy(select) {
        return (0, object_utils_js_1.freeze)({
            ...select,
            groupBy: undefined,
        });
    },
});
