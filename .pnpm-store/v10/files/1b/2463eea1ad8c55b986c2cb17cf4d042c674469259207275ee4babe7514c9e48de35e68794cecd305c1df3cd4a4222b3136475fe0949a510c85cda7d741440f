import { OperationNode } from './operation-node.js';
import { OperatorNode } from './operator-node.js';
import { ValueNode } from './value-node.js';
export interface JSONOperatorChainNode extends OperationNode {
    readonly kind: 'JSONOperatorChainNode';
    readonly operator: OperatorNode;
    readonly values: readonly ValueNode[];
}
/**
 * @internal
 */
export declare const JSONOperatorChainNode: Readonly<{
    is(node: OperationNode): node is JSONOperatorChainNode;
    create(operator: OperatorNode): JSONOperatorChainNode;
    cloneWithValue(node: JSONOperatorChainNode, value: ValueNode): JSONOperatorChainNode;
}>;
