/// <reference types="./handle-empty-in-lists-transformer.d.ts" />
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
import { PrimitiveValueListNode } from '../../operation-node/primitive-value-list-node.js';
import { OperatorNode } from '../../operation-node/operator-node.js';
import { ValueListNode } from '../../operation-node/value-list-node.js';
export class HandleEmptyInListsTransformer extends OperationNodeTransformer {
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
        return ((PrimitiveValueListNode.is(rightOperand) ||
            ValueListNode.is(rightOperand)) &&
            rightOperand.values.length === 0 &&
            OperatorNode.is(operator) &&
            (operator.operator === 'in' || operator.operator === 'not in'));
    }
}
