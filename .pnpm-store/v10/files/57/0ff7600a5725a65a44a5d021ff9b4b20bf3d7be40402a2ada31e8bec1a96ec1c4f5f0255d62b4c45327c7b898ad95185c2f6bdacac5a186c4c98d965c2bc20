import { OperationNode } from './operation-node.js';
import { IdentifierNode } from './identifier-node.js';
export type DropConstraintNodeProps = Omit<DropConstraintNode, 'kind' | 'constraintName'>;
export interface DropConstraintNode extends OperationNode {
    readonly kind: 'DropConstraintNode';
    readonly constraintName: IdentifierNode;
    readonly ifExists?: boolean;
    readonly modifier?: 'cascade' | 'restrict';
}
/**
 * @internal
 */
export declare const DropConstraintNode: Readonly<{
    is(node: OperationNode): node is DropConstraintNode;
    create(constraintName: string): DropConstraintNode;
    cloneWith(dropConstraint: DropConstraintNode, props: DropConstraintNodeProps): DropConstraintNode;
}>;
