import { OperationNode } from './operation-node.js';
import { ColumnNode } from './column-node.js';
import { TableNode } from './table-node.js';
import { SelectAllNode } from './select-all-node.js';
export interface ReferenceNode extends OperationNode {
    readonly kind: 'ReferenceNode';
    readonly column: ColumnNode | SelectAllNode;
    readonly table?: TableNode;
}
/**
 * @internal
 */
export declare const ReferenceNode: Readonly<{
    is(node: OperationNode): node is ReferenceNode;
    create(column: ColumnNode, table?: TableNode): ReferenceNode;
    createSelectAll(table: TableNode): ReferenceNode;
}>;
