import { OperationNode } from './operation-node.js';
export interface ValueNode extends OperationNode {
    readonly kind: 'ValueNode';
    readonly value: unknown;
    readonly immediate?: boolean;
}
/**
 * @internal
 */
export declare const ValueNode: Readonly<{
    is(node: OperationNode): node is ValueNode;
    create(value: unknown): ValueNode;
    createImmediate(value: unknown): ValueNode;
}>;
