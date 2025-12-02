import { AliasNode } from './alias-node.js';
import { OperationNode } from './operation-node.js';
import { SelectAllNode } from './select-all-node.js';
import { SimpleReferenceExpressionNode } from './simple-reference-expression-node.js';
import { TableNode } from './table-node.js';
type SelectionNodeChild = SimpleReferenceExpressionNode | AliasNode | SelectAllNode;
export interface SelectionNode extends OperationNode {
    readonly kind: 'SelectionNode';
    readonly selection: SelectionNodeChild;
}
/**
 * @internal
 */
export declare const SelectionNode: Readonly<{
    is(node: OperationNode): node is SelectionNode;
    create(selection: SelectionNodeChild): SelectionNode;
    createSelectAll(): SelectionNode;
    createSelectAllFromTable(table: TableNode): SelectionNode;
}>;
export {};
