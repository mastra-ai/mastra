import { OperationNode } from './operation-node.js';
import { OverNode } from './over-node.js';
import { WhereNode } from './where-node.js';
import { OrderByNode } from './order-by-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
export interface AggregateFunctionNode extends OperationNode {
    readonly kind: 'AggregateFunctionNode';
    readonly func: string;
    readonly aggregated: readonly OperationNode[];
    readonly distinct?: boolean;
    readonly orderBy?: OrderByNode;
    readonly withinGroup?: OrderByNode;
    readonly filter?: WhereNode;
    readonly over?: OverNode;
}
/**
 * @internal
 */
export declare const AggregateFunctionNode: Readonly<{
    is(node: OperationNode): node is AggregateFunctionNode;
    create(aggregateFunction: string, aggregated?: readonly OperationNode[]): AggregateFunctionNode;
    cloneWithDistinct(aggregateFunctionNode: AggregateFunctionNode): AggregateFunctionNode;
    cloneWithOrderBy(aggregateFunctionNode: AggregateFunctionNode, orderItems: ReadonlyArray<OrderByItemNode>, withinGroup?: boolean): AggregateFunctionNode;
    cloneWithFilter(aggregateFunctionNode: AggregateFunctionNode, filter: OperationNode): AggregateFunctionNode;
    cloneWithOrFilter(aggregateFunctionNode: AggregateFunctionNode, filter: OperationNode): AggregateFunctionNode;
    cloneWithOver(aggregateFunctionNode: AggregateFunctionNode, over?: OverNode): AggregateFunctionNode;
}>;
