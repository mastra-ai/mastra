import { OperationNode } from './operation-node.js';
export interface BinaryOperationNode extends OperationNode {
    readonly kind: 'BinaryOperationNode';
    readonly leftOperand: OperationNode;
    readonly operator: OperationNode;
    readonly rightOperand: OperationNode;
}
/**
 * @internal
 */
export declare const BinaryOperationNode: Readonly<{
    is(node: OperationNode): node is BinaryOperationNode;
    create(leftOperand: OperationNode, operator: OperationNode, rightOperand: OperationNode): BinaryOperationNode;
}>;
