import { FromNode } from './from-node.js';
import { GroupByItemNode } from './group-by-item-node.js';
import { GroupByNode } from './group-by-node.js';
import { HavingNode } from './having-node.js';
import { JoinNode } from './join-node.js';
import { LimitNode } from './limit-node.js';
import { OffsetNode } from './offset-node.js';
import { OperationNode } from './operation-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
import { OrderByNode } from './order-by-node.js';
import { SelectionNode } from './selection-node.js';
import { WhereNode } from './where-node.js';
import { WithNode } from './with-node.js';
import { SelectModifierNode } from './select-modifier-node.js';
import { ExplainNode } from './explain-node.js';
import { SetOperationNode } from './set-operation-node.js';
import { FetchNode } from './fetch-node.js';
import { TopNode } from './top-node.js';
export interface SelectQueryNode extends OperationNode {
    readonly kind: 'SelectQueryNode';
    readonly from?: FromNode;
    readonly selections?: ReadonlyArray<SelectionNode>;
    readonly distinctOn?: ReadonlyArray<OperationNode>;
    readonly joins?: ReadonlyArray<JoinNode>;
    readonly groupBy?: GroupByNode;
    readonly orderBy?: OrderByNode;
    readonly where?: WhereNode;
    readonly frontModifiers?: ReadonlyArray<SelectModifierNode>;
    readonly endModifiers?: ReadonlyArray<SelectModifierNode>;
    readonly limit?: LimitNode;
    readonly offset?: OffsetNode;
    readonly with?: WithNode;
    readonly having?: HavingNode;
    readonly explain?: ExplainNode;
    readonly setOperations?: ReadonlyArray<SetOperationNode>;
    readonly fetch?: FetchNode;
    readonly top?: TopNode;
}
/**
 * @internal
 */
export declare const SelectQueryNode: Readonly<{
    is(node: OperationNode): node is SelectQueryNode;
    create(withNode?: WithNode): SelectQueryNode;
    createFrom(fromItems: ReadonlyArray<OperationNode>, withNode?: WithNode): SelectQueryNode;
    cloneWithSelections(select: SelectQueryNode, selections: ReadonlyArray<SelectionNode>): SelectQueryNode;
    cloneWithDistinctOn(select: SelectQueryNode, expressions: ReadonlyArray<OperationNode>): SelectQueryNode;
    cloneWithFrontModifier(select: SelectQueryNode, modifier: SelectModifierNode): SelectQueryNode;
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node: SelectQueryNode, items: ReadonlyArray<OrderByItemNode>) => SelectQueryNode;
    cloneWithGroupByItems(selectNode: SelectQueryNode, items: ReadonlyArray<GroupByItemNode>): SelectQueryNode;
    cloneWithLimit(selectNode: SelectQueryNode, limit: LimitNode): SelectQueryNode;
    cloneWithOffset(selectNode: SelectQueryNode, offset: OffsetNode): SelectQueryNode;
    cloneWithFetch(selectNode: SelectQueryNode, fetch: FetchNode): SelectQueryNode;
    cloneWithHaving(selectNode: SelectQueryNode, operation: OperationNode): SelectQueryNode;
    cloneWithSetOperations(selectNode: SelectQueryNode, setOperations: ReadonlyArray<SetOperationNode>): SelectQueryNode;
    cloneWithoutSelections(select: SelectQueryNode): SelectQueryNode;
    cloneWithoutLimit(select: SelectQueryNode): SelectQueryNode;
    cloneWithoutOffset(select: SelectQueryNode): SelectQueryNode;
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node: SelectQueryNode) => SelectQueryNode;
    cloneWithoutGroupBy(select: SelectQueryNode): SelectQueryNode;
}>;
