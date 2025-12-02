import { OperationNode } from './operation-node.js';
import { SimpleReferenceExpressionNode } from './simple-reference-expression-node.js';
export interface PartitionByItemNode extends OperationNode {
    readonly kind: 'PartitionByItemNode';
    readonly partitionBy: SimpleReferenceExpressionNode;
}
/**
 * @internal
 */
export declare const PartitionByItemNode: Readonly<{
    is(node: OperationNode): node is PartitionByItemNode;
    create(partitionBy: SimpleReferenceExpressionNode): PartitionByItemNode;
}>;
