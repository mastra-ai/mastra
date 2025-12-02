import { OnNode } from './on-node.js';
import { OperationNode } from './operation-node.js';
export type JoinType = 'InnerJoin' | 'LeftJoin' | 'RightJoin' | 'FullJoin' | 'CrossJoin' | 'LateralInnerJoin' | 'LateralLeftJoin' | 'LateralCrossJoin' | 'Using' | 'OuterApply' | 'CrossApply';
export interface JoinNode extends OperationNode {
    readonly kind: 'JoinNode';
    readonly joinType: JoinType;
    readonly table: OperationNode;
    readonly on?: OnNode;
}
/**
 * @internal
 */
export declare const JoinNode: Readonly<{
    is(node: OperationNode): node is JoinNode;
    create(joinType: JoinType, table: OperationNode): JoinNode;
    createWithOn(joinType: JoinType, table: OperationNode, on: OperationNode): JoinNode;
    cloneWithOn(joinNode: JoinNode, operation: OperationNode): JoinNode;
}>;
