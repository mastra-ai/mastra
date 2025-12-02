import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export interface ColumnNode extends OperationNode {
    readonly kind: 'ColumnNode';
    readonly column: IdentifierNode;
}
/**
 * @internal
 */
export declare const ColumnNode: Readonly<{
    is(node: OperationNode): node is ColumnNode;
    create(column: string): ColumnNode;
}>;
