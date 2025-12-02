import { OperationNode } from './operation-node.js';
/**
 * This node is basically just a performance optimization over the normal ValueListNode.
 * The queries often contain large arrays of primitive values (for example in a `where in` list)
 * and we don't want to create a ValueNode for each item in those lists.
 */
export interface PrimitiveValueListNode extends OperationNode {
    readonly kind: 'PrimitiveValueListNode';
    readonly values: ReadonlyArray<unknown>;
}
/**
 * @internal
 */
export declare const PrimitiveValueListNode: Readonly<{
    is(node: OperationNode): node is PrimitiveValueListNode;
    create(values: ReadonlyArray<unknown>): PrimitiveValueListNode;
}>;
