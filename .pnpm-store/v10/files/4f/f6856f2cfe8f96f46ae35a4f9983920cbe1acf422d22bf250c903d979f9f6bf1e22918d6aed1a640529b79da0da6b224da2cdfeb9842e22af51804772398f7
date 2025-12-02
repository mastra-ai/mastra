import { OperationNode } from './operation-node.js';
export interface WhenNode extends OperationNode {
    readonly kind: 'WhenNode';
    readonly condition: OperationNode;
    readonly result?: OperationNode;
}
/**
 * @internal
 */
export declare const WhenNode: Readonly<{
    is(node: OperationNode): node is WhenNode;
    create(condition: OperationNode): WhenNode;
    cloneWithResult(whenNode: WhenNode, result: OperationNode): WhenNode;
}>;
