import { PartitionByItemNode } from './partition-by-item-node.js';
import { OperationNode } from './operation-node.js';
export interface PartitionByNode extends OperationNode {
    readonly kind: 'PartitionByNode';
    readonly items: ReadonlyArray<PartitionByItemNode>;
}
/**
 * @internal
 */
export declare const PartitionByNode: Readonly<{
    is(node: OperationNode): node is PartitionByNode;
    create(items: ReadonlyArray<PartitionByItemNode>): PartitionByNode;
    cloneWithItems(partitionBy: PartitionByNode, items: ReadonlyArray<PartitionByItemNode>): PartitionByNode;
}>;
