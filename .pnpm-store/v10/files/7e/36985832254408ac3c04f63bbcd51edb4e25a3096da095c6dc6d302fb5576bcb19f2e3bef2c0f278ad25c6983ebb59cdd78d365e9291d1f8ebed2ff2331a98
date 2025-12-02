import { OperationNode } from './operation-node.js';
export interface AliasNode extends OperationNode {
    readonly kind: 'AliasNode';
    readonly node: OperationNode;
    readonly alias: OperationNode;
}
/**
 * @internal
 */
export declare const AliasNode: Readonly<{
    is(node: OperationNode): node is AliasNode;
    create(node: OperationNode, alias: OperationNode): AliasNode;
}>;
