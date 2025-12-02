import { OperationNode } from './operation-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
import { OrderByNode } from './order-by-node.js';
import { PartitionByItemNode } from './partition-by-item-node.js';
import { PartitionByNode } from './partition-by-node.js';
export interface OverNode extends OperationNode {
    readonly kind: 'OverNode';
    readonly orderBy?: OrderByNode;
    readonly partitionBy?: PartitionByNode;
}
/**
 * @internal
 */
export declare const OverNode: Readonly<{
    is(node: OperationNode): node is OverNode;
    create(): OverNode;
    cloneWithOrderByItems(overNode: OverNode, items: ReadonlyArray<OrderByItemNode>): OverNode;
    cloneWithPartitionByItems(overNode: OverNode, items: ReadonlyArray<PartitionByItemNode>): OverNode;
}>;
