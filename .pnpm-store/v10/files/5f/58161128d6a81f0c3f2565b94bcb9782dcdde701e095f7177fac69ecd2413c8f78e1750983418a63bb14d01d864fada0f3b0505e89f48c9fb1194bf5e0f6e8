import { OperationNode } from './operation-node.js';
export interface GroupByItemNode extends OperationNode {
    readonly kind: 'GroupByItemNode';
    readonly groupBy: OperationNode;
}
/**
 * @internal
 */
export declare const GroupByItemNode: Readonly<{
    is(node: OperationNode): node is GroupByItemNode;
    create(groupBy: OperationNode): GroupByItemNode;
}>;
