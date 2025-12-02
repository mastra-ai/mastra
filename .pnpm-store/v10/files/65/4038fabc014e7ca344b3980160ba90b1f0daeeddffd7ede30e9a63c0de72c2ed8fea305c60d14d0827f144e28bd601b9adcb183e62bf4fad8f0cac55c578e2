import { OperationNode } from './operation-node.js';
export interface TupleNode extends OperationNode {
    readonly kind: 'TupleNode';
    readonly values: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const TupleNode: Readonly<{
    is(node: OperationNode): node is TupleNode;
    create(values: ReadonlyArray<OperationNode>): TupleNode;
}>;
