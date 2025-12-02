"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregateFunctionNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const where_node_js_1 = require("./where-node.js");
const order_by_node_js_1 = require("./order-by-node.js");
/**
 * @internal
 */
exports.AggregateFunctionNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'AggregateFunctionNode';
    },
    create(aggregateFunction, aggregated = []) {
        return (0, object_utils_js_1.freeze)({
            kind: 'AggregateFunctionNode',
            func: aggregateFunction,
            aggregated,
        });
    },
    cloneWithDistinct(aggregateFunctionNode) {
        return (0, object_utils_js_1.freeze)({
            ...aggregateFunctionNode,
            distinct: true,
        });
    },
    cloneWithOrderBy(aggregateFunctionNode, orderItems, withinGroup = false) {
        const prop = withinGroup ? 'withinGroup' : 'orderBy';
        return (0, object_utils_js_1.freeze)({
            ...aggregateFunctionNode,
            [prop]: aggregateFunctionNode[prop]
                ? order_by_node_js_1.OrderByNode.cloneWithItems(aggregateFunctionNode[prop], orderItems)
                : order_by_node_js_1.OrderByNode.create(orderItems),
        });
    },
    cloneWithFilter(aggregateFunctionNode, filter) {
        return (0, object_utils_js_1.freeze)({
            ...aggregateFunctionNode,
            filter: aggregateFunctionNode.filter
                ? where_node_js_1.WhereNode.cloneWithOperation(aggregateFunctionNode.filter, 'And', filter)
                : where_node_js_1.WhereNode.create(filter),
        });
    },
    cloneWithOrFilter(aggregateFunctionNode, filter) {
        return (0, object_utils_js_1.freeze)({
            ...aggregateFunctionNode,
            filter: aggregateFunctionNode.filter
                ? where_node_js_1.WhereNode.cloneWithOperation(aggregateFunctionNode.filter, 'Or', filter)
                : where_node_js_1.WhereNode.create(filter),
        });
    },
    cloneWithOver(aggregateFunctionNode, over) {
        return (0, object_utils_js_1.freeze)({
            ...aggregateFunctionNode,
            over,
        });
    },
});
