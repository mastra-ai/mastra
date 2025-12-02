"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseValueExpressionOrList = parseValueExpressionOrList;
exports.parseValueExpression = parseValueExpression;
exports.isSafeImmediateValue = isSafeImmediateValue;
exports.parseSafeImmediateValue = parseSafeImmediateValue;
const primitive_value_list_node_js_1 = require("../operation-node/primitive-value-list-node.js");
const value_list_node_js_1 = require("../operation-node/value-list-node.js");
const value_node_js_1 = require("../operation-node/value-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const expression_parser_js_1 = require("./expression-parser.js");
function parseValueExpressionOrList(arg) {
    if ((0, object_utils_js_1.isReadonlyArray)(arg)) {
        return parseValueExpressionList(arg);
    }
    return parseValueExpression(arg);
}
function parseValueExpression(exp) {
    if ((0, expression_parser_js_1.isExpressionOrFactory)(exp)) {
        return (0, expression_parser_js_1.parseExpression)(exp);
    }
    return value_node_js_1.ValueNode.create(exp);
}
function isSafeImmediateValue(value) {
    return (0, object_utils_js_1.isNumber)(value) || (0, object_utils_js_1.isBoolean)(value) || (0, object_utils_js_1.isNull)(value);
}
function parseSafeImmediateValue(value) {
    if (!isSafeImmediateValue(value)) {
        throw new Error(`unsafe immediate value ${JSON.stringify(value)}`);
    }
    return value_node_js_1.ValueNode.createImmediate(value);
}
function parseValueExpressionList(arg) {
    if (arg.some(expression_parser_js_1.isExpressionOrFactory)) {
        return value_list_node_js_1.ValueListNode.create(arg.map((it) => parseValueExpression(it)));
    }
    return primitive_value_list_node_js_1.PrimitiveValueListNode.create(arg);
}
