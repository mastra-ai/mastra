import { OperationNode } from './operation-node.js';
import { ColumnNode } from './column-node.js';
export interface RenameColumnNode extends OperationNode {
    readonly kind: 'RenameColumnNode';
    readonly column: ColumnNode;
    readonly renameTo: ColumnNode;
}
/**
 * @internal
 */
export declare const RenameColumnNode: Readonly<{
    is(node: OperationNode): node is RenameColumnNode;
    create(column: string, newColumn: string): RenameColumnNode;
}>;
