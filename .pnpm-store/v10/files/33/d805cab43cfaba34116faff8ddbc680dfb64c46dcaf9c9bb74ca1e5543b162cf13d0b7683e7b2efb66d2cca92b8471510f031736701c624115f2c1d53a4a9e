import { OperationNode } from './operation-node.js';
export interface OrNode extends OperationNode {
    readonly kind: 'OrNode';
    readonly left: OperationNode;
    readonly right: OperationNode;
}
/**
 * @internal
 */
export declare const OrNode: Readonly<{
    is(node: OperationNode): node is OrNode;
    create(left: OperationNode, right: OperationNode): OrNode;
}>;
