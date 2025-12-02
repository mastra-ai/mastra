import { OperationNode } from './operation-node.js';
export interface ListNode extends OperationNode {
    readonly kind: 'ListNode';
    readonly items: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const ListNode: Readonly<{
    is(node: OperationNode): node is ListNode;
    create(items: ReadonlyArray<OperationNode>): ListNode;
}>;
