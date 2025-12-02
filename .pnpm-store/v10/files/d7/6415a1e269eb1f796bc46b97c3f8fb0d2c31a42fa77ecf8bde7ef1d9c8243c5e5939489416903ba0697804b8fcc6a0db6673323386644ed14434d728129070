import { OperationNode } from './operation-node.js';
export interface CastNode extends OperationNode {
    readonly kind: 'CastNode';
    readonly expression: OperationNode;
    readonly dataType: OperationNode;
}
/**
 * @internal
 */
export declare const CastNode: Readonly<{
    is(node: OperationNode): node is CastNode;
    create(expression: OperationNode, dataType: OperationNode): CastNode;
}>;
