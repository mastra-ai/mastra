import { OperationNode } from './operation-node.js';
export interface OutputNode extends OperationNode {
    readonly kind: 'OutputNode';
    readonly selections: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const OutputNode: Readonly<{
    is(node: OperationNode): node is OutputNode;
    create(selections: ReadonlyArray<OperationNode>): OutputNode;
    cloneWithSelections(output: OutputNode, selections: ReadonlyArray<OperationNode>): OutputNode;
}>;
