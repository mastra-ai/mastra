import { OperationNode } from './operation-node.js';
export interface OnNode extends OperationNode {
    readonly kind: 'OnNode';
    readonly on: OperationNode;
}
/**
 * @internal
 */
export declare const OnNode: Readonly<{
    is(node: OperationNode): node is OnNode;
    create(filter: OperationNode): OnNode;
    cloneWithOperation(onNode: OnNode, operator: "And" | "Or", operation: OperationNode): OnNode;
}>;
