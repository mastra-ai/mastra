import { OperationNode } from './operation-node.js';
export interface FunctionNode extends OperationNode {
    readonly kind: 'FunctionNode';
    readonly func: string;
    readonly arguments: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const FunctionNode: Readonly<{
    is(node: OperationNode): node is FunctionNode;
    create(func: string, args: ReadonlyArray<OperationNode>): FunctionNode;
}>;
