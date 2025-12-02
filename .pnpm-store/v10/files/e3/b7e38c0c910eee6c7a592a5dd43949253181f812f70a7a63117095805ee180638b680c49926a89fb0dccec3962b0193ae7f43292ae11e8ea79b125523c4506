import { OperationNode } from './operation-node.js';
import { ColumnNode } from './column-node.js';
export interface DropColumnNode extends OperationNode {
    readonly kind: 'DropColumnNode';
    readonly column: ColumnNode;
}
/**
 * @internal
 */
export declare const DropColumnNode: Readonly<{
    is(node: OperationNode): node is DropColumnNode;
    create(column: string): DropColumnNode;
}>;
