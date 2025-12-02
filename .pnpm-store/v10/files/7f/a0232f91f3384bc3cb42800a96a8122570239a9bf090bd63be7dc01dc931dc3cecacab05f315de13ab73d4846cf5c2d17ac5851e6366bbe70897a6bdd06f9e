import { OperationNode } from './operation-node.js';
export interface LimitNode extends OperationNode {
    readonly kind: 'LimitNode';
    readonly limit: OperationNode;
}
/**
 * @internal
 */
export declare const LimitNode: Readonly<{
    is(node: OperationNode): node is LimitNode;
    create(limit: OperationNode): LimitNode;
}>;
