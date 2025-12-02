import { OperationNode } from './operation-node.js';
export interface ParensNode extends OperationNode {
    readonly kind: 'ParensNode';
    readonly node: OperationNode;
}
/**
 * @internal
 */
export declare const ParensNode: Readonly<{
    is(node: OperationNode): node is ParensNode;
    create(node: OperationNode): ParensNode;
}>;
