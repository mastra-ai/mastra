import { OperationNode } from './operation-node.js';
export interface ColumnUpdateNode extends OperationNode {
    readonly kind: 'ColumnUpdateNode';
    readonly column: OperationNode;
    readonly value: OperationNode;
}
/**
 * @internal
 */
export declare const ColumnUpdateNode: Readonly<{
    is(node: OperationNode): node is ColumnUpdateNode;
    create(column: OperationNode, value: OperationNode): ColumnUpdateNode;
}>;
