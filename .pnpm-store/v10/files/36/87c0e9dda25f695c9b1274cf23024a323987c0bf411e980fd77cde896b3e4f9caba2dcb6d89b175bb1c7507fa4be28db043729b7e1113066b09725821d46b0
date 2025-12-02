import { OperationNode } from './operation-node.js';
export interface MatchedNode extends OperationNode {
    readonly kind: 'MatchedNode';
    readonly not: boolean;
    readonly bySource: boolean;
}
/**
 * @internal
 */
export declare const MatchedNode: Readonly<{
    is(node: OperationNode): node is MatchedNode;
    create(not: boolean, bySource?: boolean): MatchedNode;
}>;
