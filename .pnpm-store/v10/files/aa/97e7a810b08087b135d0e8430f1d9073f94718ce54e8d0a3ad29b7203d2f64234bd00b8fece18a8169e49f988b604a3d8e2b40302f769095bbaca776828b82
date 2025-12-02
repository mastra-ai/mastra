import { OperationNode } from './operation-node.js';
export interface ValueListNode extends OperationNode {
    readonly kind: 'ValueListNode';
    readonly values: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const ValueListNode: Readonly<{
    is(node: OperationNode): node is ValueListNode;
    create(values: ReadonlyArray<OperationNode>): ValueListNode;
}>;
