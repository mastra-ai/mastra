import { OperationNode } from './operation-node.js';
export interface UnaryOperationNode extends OperationNode {
    readonly kind: 'UnaryOperationNode';
    readonly operator: OperationNode;
    readonly operand: OperationNode;
}
/**
 * @internal
 */
export declare const UnaryOperationNode: Readonly<{
    is(node: OperationNode): node is UnaryOperationNode;
    create(operator: OperationNode, operand: OperationNode): UnaryOperationNode;
}>;
