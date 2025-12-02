"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOrderByDirection = isOrderByDirection;
exports.parseOrderBy = parseOrderBy;
exports.parseOrderByItem = parseOrderByItem;
const dynamic_reference_builder_js_1 = require("../dynamic/dynamic-reference-builder.js");
const expression_js_1 = require("../expression/expression.js");
const order_by_item_node_js_1 = require("../operation-node/order-by-item-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const order_by_item_builder_js_1 = require("../query-builder/order-by-item-builder.js");
const log_once_js_1 = require("../util/log-once.js");
const expression_parser_js_1 = require("./expression-parser.js");
const reference_parser_js_1 = require("./reference-parser.js");
function isOrderByDirection(thing) {
    return thing === 'asc' || thing === 'desc';
}
function parseOrderBy(args) {
    if (args.length === 2) {
        return [parseOrderByItem(args[0], args[1])];
    }
    if (args.length === 1) {
        const [orderBy] = args;
        if (Array.isArray(orderBy)) {
            (0, log_once_js_1.logOnce)('orderBy(array) is deprecated, use multiple orderBy calls instead.');
            return orderBy.map((item) => parseOrderByItem(item));
        }
        return [parseOrderByItem(orderBy)];
    }
    throw new Error(`Invalid number of arguments at order by! expected 1-2, received ${args.length}`);
}
function parseOrderByItem(expr, modifiers) {
    const parsedRef = parseOrderByExpression(expr);
    if (order_by_item_node_js_1.OrderByItemNode.is(parsedRef)) {
        if (modifiers) {
            throw new Error('Cannot specify direction twice!');
        }
        return parsedRef;
    }
    return parseOrderByWithModifiers(parsedRef, modifiers);
}
function parseOrderByExpression(expr) {
    if ((0, expression_parser_js_1.isExpressionOrFactory)(expr)) {
        return (0, expression_parser_js_1.parseExpression)(expr);
    }
    if ((0, dynamic_reference_builder_js_1.isDynamicReferenceBuilder)(expr)) {
        return expr.toOperationNode();
    }
    const [ref, direction] = expr.split(' ');
    if (direction) {
        (0, log_once_js_1.logOnce)("`orderBy('column asc')` is deprecated. Use `orderBy('column', 'asc')` instead.");
        return parseOrderByWithModifiers((0, reference_parser_js_1.parseStringReference)(ref), direction);
    }
    return (0, reference_parser_js_1.parseStringReference)(expr);
}
function parseOrderByWithModifiers(expr, modifiers) {
    if (typeof modifiers === 'string') {
        if (!isOrderByDirection(modifiers)) {
            throw new Error(`Invalid order by direction: ${modifiers}`);
        }
        return order_by_item_node_js_1.OrderByItemNode.create(expr, raw_node_js_1.RawNode.createWithSql(modifiers));
    }
    if ((0, expression_js_1.isExpression)(modifiers)) {
        (0, log_once_js_1.logOnce)("`orderBy(..., expr)` is deprecated. Use `orderBy(..., 'asc')` or `orderBy(..., (ob) => ...)` instead.");
        return order_by_item_node_js_1.OrderByItemNode.create(expr, modifiers.toOperationNode());
    }
    const node = order_by_item_node_js_1.OrderByItemNode.create(expr);
    if (!modifiers) {
        return node;
    }
    return modifiers(new order_by_item_builder_js_1.OrderByItemBuilder({ node })).toOperationNode();
}
