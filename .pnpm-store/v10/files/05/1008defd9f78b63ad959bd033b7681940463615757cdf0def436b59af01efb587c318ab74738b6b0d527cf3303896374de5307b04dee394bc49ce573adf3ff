import { ColumnNode } from './column-node.js';
import { ColumnUpdateNode } from './column-update-node.js';
import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
import { WhereNode } from './where-node.js';
export type OnConflictNodeProps = Omit<OnConflictNode, 'kind' | 'indexWhere' | 'updateWhere'>;
export interface OnConflictNode extends OperationNode {
    readonly kind: 'OnConflictNode';
    readonly columns?: ReadonlyArray<ColumnNode>;
    readonly constraint?: IdentifierNode;
    readonly indexExpression?: OperationNode;
    readonly indexWhere?: WhereNode;
    readonly updates?: ReadonlyArray<ColumnUpdateNode>;
    readonly updateWhere?: WhereNode;
    readonly doNothing?: boolean;
}
/**
 * @internal
 */
export declare const OnConflictNode: Readonly<{
    is(node: OperationNode): node is OnConflictNode;
    create(): OnConflictNode;
    cloneWith(node: OnConflictNode, props: OnConflictNodeProps): OnConflictNode;
    cloneWithIndexWhere(node: OnConflictNode, operation: OperationNode): OnConflictNode;
    cloneWithIndexOrWhere(node: OnConflictNode, operation: OperationNode): OnConflictNode;
    cloneWithUpdateWhere(node: OnConflictNode, operation: OperationNode): OnConflictNode;
    cloneWithUpdateOrWhere(node: OnConflictNode, operation: OperationNode): OnConflictNode;
    cloneWithoutIndexWhere(node: OnConflictNode): OnConflictNode;
    cloneWithoutUpdateWhere(node: OnConflictNode): OnConflictNode;
}>;
