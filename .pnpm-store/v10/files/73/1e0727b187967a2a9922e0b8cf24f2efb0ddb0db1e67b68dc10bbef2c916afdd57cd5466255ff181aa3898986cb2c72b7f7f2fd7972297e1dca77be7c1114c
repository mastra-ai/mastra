import { OperationNode } from './operation-node.js';
export interface WhereNode extends OperationNode {
    readonly kind: 'WhereNode';
    readonly where: OperationNode;
}
/**
 * @internal
 */
export declare const WhereNode: Readonly<{
    is(node: OperationNode): node is WhereNode;
    create(filter: OperationNode): WhereNode;
    cloneWithOperation(whereNode: WhereNode, operator: "And" | "Or", operation: OperationNode): WhereNode;
}>;
