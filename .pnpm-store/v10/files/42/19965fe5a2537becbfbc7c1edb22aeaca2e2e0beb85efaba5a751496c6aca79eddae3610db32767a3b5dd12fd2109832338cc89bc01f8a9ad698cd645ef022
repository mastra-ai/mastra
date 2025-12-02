import { OperationNode } from './operation-node.js';
export interface OrActionNode extends OperationNode {
    readonly kind: 'OrActionNode';
    readonly action: string;
}
/**
 * @internal
 */
export declare const OrActionNode: Readonly<{
    is(node: OperationNode): node is OrActionNode;
    create(action: string): OrActionNode;
}>;
