"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExists = parseExists;
exports.parseNotExists = parseNotExists;
exports.parseUnaryOperation = parseUnaryOperation;
const operator_node_js_1 = require("../operation-node/operator-node.js");
const unary_operation_node_js_1 = require("../operation-node/unary-operation-node.js");
const reference_parser_js_1 = require("./reference-parser.js");
function parseExists(operand) {
    return parseUnaryOperation('exists', operand);
}
function parseNotExists(operand) {
    return parseUnaryOperation('not exists', operand);
}
function parseUnaryOperation(operator, operand) {
    return unary_operation_node_js_1.UnaryOperationNode.create(operator_node_js_1.OperatorNode.create(operator), (0, reference_parser_js_1.parseReferenceExpression)(operand));
}
