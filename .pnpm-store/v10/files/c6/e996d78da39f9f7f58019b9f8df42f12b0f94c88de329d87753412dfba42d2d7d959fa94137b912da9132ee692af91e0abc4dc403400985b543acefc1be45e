import { JSONPathLegNode } from './json-path-leg-node.js';
import { OperationNode } from './operation-node.js';
import { OperatorNode } from './operator-node.js';
export interface JSONPathNode extends OperationNode {
    readonly kind: 'JSONPathNode';
    readonly inOperator?: OperatorNode;
    readonly pathLegs: ReadonlyArray<JSONPathLegNode>;
}
/**
 * @internal
 */
export declare const JSONPathNode: Readonly<{
    is(node: OperationNode): node is JSONPathNode;
    create(inOperator?: OperatorNode): JSONPathNode;
    cloneWithLeg(jsonPathNode: JSONPathNode, pathLeg: JSONPathLegNode): JSONPathNode;
}>;
