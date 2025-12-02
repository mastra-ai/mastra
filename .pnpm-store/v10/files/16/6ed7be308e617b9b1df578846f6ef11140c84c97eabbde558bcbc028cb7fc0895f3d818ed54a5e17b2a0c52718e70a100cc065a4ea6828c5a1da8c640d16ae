import { OperationNode } from './operation-node.js';
export interface FromNode extends OperationNode {
    readonly kind: 'FromNode';
    readonly froms: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const FromNode: Readonly<{
    is(node: OperationNode): node is FromNode;
    create(froms: ReadonlyArray<OperationNode>): FromNode;
    cloneWithFroms(from: FromNode, froms: ReadonlyArray<OperationNode>): FromNode;
}>;
