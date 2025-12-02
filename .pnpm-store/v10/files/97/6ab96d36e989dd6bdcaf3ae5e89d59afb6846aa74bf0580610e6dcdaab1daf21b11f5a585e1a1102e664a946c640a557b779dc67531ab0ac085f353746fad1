import { OperationNode } from './operation-node.js';
import { GroupByItemNode } from './group-by-item-node.js';
export interface GroupByNode extends OperationNode {
    readonly kind: 'GroupByNode';
    readonly items: ReadonlyArray<GroupByItemNode>;
}
/**
 * @internal
 */
export declare const GroupByNode: Readonly<{
    is(node: OperationNode): node is GroupByNode;
    create(items: ReadonlyArray<GroupByItemNode>): GroupByNode;
    cloneWithItems(groupBy: GroupByNode, items: ReadonlyArray<GroupByItemNode>): GroupByNode;
}>;
