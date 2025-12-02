import { OperationNode } from './operation-node.js';
export interface OffsetNode extends OperationNode {
    readonly kind: 'OffsetNode';
    readonly offset: OperationNode;
}
/**
 * @internal
 */
export declare const OffsetNode: Readonly<{
    is(node: OperationNode): node is OffsetNode;
    create(offset: OperationNode): OffsetNode;
}>;
