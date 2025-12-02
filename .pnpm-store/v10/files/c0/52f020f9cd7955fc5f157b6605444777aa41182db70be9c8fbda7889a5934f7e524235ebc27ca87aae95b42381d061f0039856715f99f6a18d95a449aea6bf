import { JSONOperatorChainNode } from './json-operator-chain-node.js';
import { JSONPathNode } from './json-path-node.js';
import { OperationNode } from './operation-node.js';
import { ReferenceNode } from './reference-node.js';
export interface JSONReferenceNode extends OperationNode {
    readonly kind: 'JSONReferenceNode';
    readonly reference: ReferenceNode;
    readonly traversal: JSONPathNode | JSONOperatorChainNode;
}
/**
 * @internal
 */
export declare const JSONReferenceNode: Readonly<{
    is(node: OperationNode): node is JSONReferenceNode;
    create(reference: ReferenceNode, traversal: JSONPathNode | JSONOperatorChainNode): JSONReferenceNode;
    cloneWithTraversal(node: JSONReferenceNode, traversal: JSONPathNode | JSONOperatorChainNode): JSONReferenceNode;
}>;
