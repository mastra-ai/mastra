import { CollateNode } from './collate-node.js';
import { OperationNode } from './operation-node.js';
export type OrderByItemNodeProps = Omit<OrderByItemNode, 'kind' | 'orderBy'>;
export interface OrderByItemNode extends OperationNode {
    readonly kind: 'OrderByItemNode';
    readonly orderBy: OperationNode;
    readonly direction?: OperationNode;
    readonly nulls?: 'first' | 'last';
    readonly collation?: CollateNode;
}
/**
 * @internal
 */
export declare const OrderByItemNode: Readonly<{
    is(node: OperationNode): node is OrderByItemNode;
    create(orderBy: OperationNode, direction?: OperationNode): OrderByItemNode;
    cloneWith(node: OrderByItemNode, props: OrderByItemNodeProps): OrderByItemNode;
}>;
