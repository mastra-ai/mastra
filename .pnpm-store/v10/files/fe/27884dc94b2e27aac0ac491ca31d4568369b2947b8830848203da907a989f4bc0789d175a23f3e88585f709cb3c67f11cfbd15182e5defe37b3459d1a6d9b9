import { OperationNode } from './operation-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
export interface OrderByNode extends OperationNode {
    readonly kind: 'OrderByNode';
    readonly items: ReadonlyArray<OrderByItemNode>;
}
/**
 * @internal
 */
export declare const OrderByNode: Readonly<{
    is(node: OperationNode): node is OrderByNode;
    create(items: ReadonlyArray<OrderByItemNode>): OrderByNode;
    cloneWithItems(orderBy: OrderByNode, items: ReadonlyArray<OrderByItemNode>): OrderByNode;
}>;
