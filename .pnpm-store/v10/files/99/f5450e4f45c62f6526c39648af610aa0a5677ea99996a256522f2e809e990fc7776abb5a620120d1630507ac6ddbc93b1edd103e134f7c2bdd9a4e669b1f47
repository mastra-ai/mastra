"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseValueBinaryOperationOrExpression = parseValueBinaryOperationOrExpression;
exports.parseValueBinaryOperation = parseValueBinaryOperation;
exports.parseReferentialBinaryOperation = parseReferentialBinaryOperation;
exports.parseFilterObject = parseFilterObject;
exports.parseFilterList = parseFilterList;
const binary_operation_node_js_1 = require("../operation-node/binary-operation-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const operator_node_js_1 = require("../operation-node/operator-node.js");
const reference_parser_js_1 = require("./reference-parser.js");
const value_parser_js_1 = require("./value-parser.js");
const value_node_js_1 = require("../operation-node/value-node.js");
const and_node_js_1 = require("../operation-node/and-node.js");
const parens_node_js_1 = require("../operation-node/parens-node.js");
const or_node_js_1 = require("../operation-node/or-node.js");
function parseValueBinaryOperationOrExpression(args) {
    if (args.length === 3) {
        return parseValueBinaryOperation(args[0], args[1], args[2]);
    }
    else if (args.length === 1) {
        return (0, value_parser_js_1.parseValueExpression)(args[0]);
    }
    throw new Error(`invalid arguments: ${JSON.stringify(args)}`);
}
function parseValueBinaryOperation(left, operator, right) {
    if (isIsOperator(operator) && needsIsOperator(right)) {
        return binary_operation_node_js_1.BinaryOperationNode.create((0, reference_parser_js_1.parseReferenceExpression)(left), parseOperator(operator), value_node_js_1.ValueNode.createImmediate(right));
    }
    return binary_operation_node_js_1.BinaryOperationNode.create((0, reference_parser_js_1.parseReferenceExpression)(left), parseOperator(operator), (0, value_parser_js_1.parseValueExpressionOrList)(right));
}
function parseReferentialBinaryOperation(left, operator, right) {
    return binary_operation_node_js_1.BinaryOperationNode.create((0, reference_parser_js_1.parseReferenceExpression)(left), parseOperator(operator), (0, reference_parser_js_1.parseReferenceExpression)(right));
}
function parseFilterObject(obj, combinator) {
    return parseFilterList(Object.entries(obj)
        .filter(([, v]) => !(0, object_utils_js_1.isUndefined)(v))
        .map(([k, v]) => parseValueBinaryOperation(k, needsIsOperator(v) ? 'is' : '=', v)), combinator);
}
function parseFilterList(list, combinator, withParens = true) {
    const combine = combinator === 'and' ? and_node_js_1.AndNode.create : or_node_js_1.OrNode.create;
    if (list.length === 0) {
        return binary_operation_node_js_1.BinaryOperationNode.create(value_node_js_1.ValueNode.createImmediate(1), operator_node_js_1.OperatorNode.create('='), value_node_js_1.ValueNode.createImmediate(combinator === 'and' ? 1 : 0));
    }
    let node = toOperationNode(list[0]);
    for (let i = 1; i < list.length; ++i) {
        node = combine(node, toOperationNode(list[i]));
    }
    if (list.length > 1 && withParens) {
        return parens_node_js_1.ParensNode.create(node);
    }
    return node;
}
function isIsOperator(operator) {
    return operator === 'is' || operator === 'is not';
}
function needsIsOperator(value) {
    return (0, object_utils_js_1.isNull)(value) || (0, object_utils_js_1.isBoolean)(value);
}
function parseOperator(operator) {
    if ((0, object_utils_js_1.isString)(operator) && operator_node_js_1.OPERATORS.includes(operator)) {
        return operator_node_js_1.OperatorNode.create(operator);
    }
    if ((0, operation_node_source_js_1.isOperationNodeSource)(operator)) {
        return operator.toOperationNode();
    }
    throw new Error(`invalid operator ${JSON.stringify(operator)}`);
}
function toOperationNode(nodeOrSource) {
    return (0, operation_node_source_js_1.isOperationNodeSource)(nodeOrSource)
        ? nodeOrSource.toOperationNode()
        : nodeOrSource;
}
