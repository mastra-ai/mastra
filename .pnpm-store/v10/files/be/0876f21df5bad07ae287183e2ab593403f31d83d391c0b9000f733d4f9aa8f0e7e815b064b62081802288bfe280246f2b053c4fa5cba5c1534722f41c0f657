import { OperationNode } from './operation-node.js';
export interface HavingNode extends OperationNode {
    readonly kind: 'HavingNode';
    readonly having: OperationNode;
}
/**
 * @internal
 */
export declare const HavingNode: Readonly<{
    is(node: OperationNode): node is HavingNode;
    create(filter: OperationNode): HavingNode;
    cloneWithOperation(havingNode: HavingNode, operator: "And" | "Or", operation: OperationNode): HavingNode;
}>;
