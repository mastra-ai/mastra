"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleEmptyInListsTransformer = void 0;
const operation_node_transformer_js_1 = require("../../operation-node/operation-node-transformer.js");
const primitive_value_list_node_js_1 = require("../../operation-node/primitive-value-list-node.js");
const operator_node_js_1 = require("../../operation-node/operator-node.js");
const value_list_node_js_1 = require("../../operation-node/value-list-node.js");
class HandleEmptyInListsTransformer extends operation_node_transformer_js_1.OperationNodeTransformer {
    #strategy;
    constructor(strategy) {
        super();
        this.#strategy = strategy;
    }
    transformBinaryOperation(node) {
        if (this.#isEmptyInListNode(node)) {
            return this.#strategy(node);
        }
        return node;
    }
    #isEmptyInListNode(node) {
        const { operator, rightOperand } = node;
        return ((primitive_value_list_node_js_1.PrimitiveValueListNode.is(rightOperand) ||
            value_list_node_js_1.ValueListNode.is(rightOperand)) &&
            rightOperand.values.length === 0 &&
            operator_node_js_1.OperatorNode.is(operator) &&
            (operator.operator === 'in' || operator.operator === 'not in'));
    }
}
exports.HandleEmptyInListsTransformer = HandleEmptyInListsTransformer;
