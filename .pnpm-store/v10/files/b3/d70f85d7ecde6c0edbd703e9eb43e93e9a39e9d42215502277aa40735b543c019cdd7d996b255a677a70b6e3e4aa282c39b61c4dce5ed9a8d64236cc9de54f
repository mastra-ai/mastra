import { OperationNode } from './operation-node.js';
import { ConstraintNode } from './constraint-node.js';
export interface AddConstraintNode extends OperationNode {
    readonly kind: 'AddConstraintNode';
    readonly constraint: ConstraintNode;
}
/**
 * @internal
 */
export declare const AddConstraintNode: Readonly<{
    is(node: OperationNode): node is AddConstraintNode;
    create(constraint: ConstraintNode): AddConstraintNode;
}>;
