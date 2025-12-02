import { OperationNode } from './operation-node.js';
import { IdentifierNode } from './identifier-node.js';
export interface RenameConstraintNode extends OperationNode {
    readonly kind: 'RenameConstraintNode';
    readonly oldName: IdentifierNode;
    readonly newName: IdentifierNode;
}
/**
 * @internal
 */
export declare const RenameConstraintNode: Readonly<{
    is(node: OperationNode): node is RenameConstraintNode;
    create(oldName: string, newName: string): RenameConstraintNode;
}>;
