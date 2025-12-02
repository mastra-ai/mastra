"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExpression = parseExpression;
exports.parseAliasedExpression = parseAliasedExpression;
exports.isExpressionOrFactory = isExpressionOrFactory;
const expression_js_1 = require("../expression/expression.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const expression_builder_js_1 = require("../expression/expression-builder.js");
const object_utils_js_1 = require("../util/object-utils.js");
function parseExpression(exp) {
    if ((0, operation_node_source_js_1.isOperationNodeSource)(exp)) {
        return exp.toOperationNode();
    }
    else if ((0, object_utils_js_1.isFunction)(exp)) {
        return exp((0, expression_builder_js_1.expressionBuilder)()).toOperationNode();
    }
    throw new Error(`invalid expression: ${JSON.stringify(exp)}`);
}
function parseAliasedExpression(exp) {
    if ((0, operation_node_source_js_1.isOperationNodeSource)(exp)) {
        return exp.toOperationNode();
    }
    else if ((0, object_utils_js_1.isFunction)(exp)) {
        return exp((0, expression_builder_js_1.expressionBuilder)()).toOperationNode();
    }
    throw new Error(`invalid aliased expression: ${JSON.stringify(exp)}`);
}
function isExpressionOrFactory(obj) {
    return (0, expression_js_1.isExpression)(obj) || (0, expression_js_1.isAliasedExpression)(obj) || (0, object_utils_js_1.isFunction)(obj);
}
