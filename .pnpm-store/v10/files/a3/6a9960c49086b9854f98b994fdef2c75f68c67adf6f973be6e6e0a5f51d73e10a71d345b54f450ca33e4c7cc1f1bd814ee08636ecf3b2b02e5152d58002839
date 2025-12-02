import { OperationNode } from './operation-node.js';
export interface AndNode extends OperationNode {
    readonly kind: 'AndNode';
    readonly left: OperationNode;
    readonly right: OperationNode;
}
/**
 * @internal
 */
export declare const AndNode: Readonly<{
    is(node: OperationNode): node is AndNode;
    create(left: OperationNode, right: OperationNode): AndNode;
}>;
