import { OperationNode } from './operation-node.js';
import { IdentifierNode } from './identifier-node.js';
export interface CheckConstraintNode extends OperationNode {
    readonly kind: 'CheckConstraintNode';
    readonly expression: OperationNode;
    readonly name?: IdentifierNode;
}
/**
 * @internal
 */
export declare const CheckConstraintNode: Readonly<{
    is(node: OperationNode): node is CheckConstraintNode;
    create(expression: OperationNode, constraintName?: string): CheckConstraintNode;
}>;
