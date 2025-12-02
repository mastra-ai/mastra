import { InsertQueryNode } from './insert-query-node.js';
import { SelectQueryNode } from './select-query-node.js';
import { UpdateQueryNode } from './update-query-node.js';
import { DeleteQueryNode } from './delete-query-node.js';
import { WhereNode } from './where-node.js';
import { JoinNode } from './join-node.js';
import { SelectionNode } from './selection-node.js';
import { ReturningNode } from './returning-node.js';
import { OperationNode } from './operation-node.js';
import { ExplainNode } from './explain-node.js';
import { ExplainFormat } from '../util/explainable.js';
import { Expression } from '../expression/expression.js';
import { MergeQueryNode } from './merge-query-node.js';
import { TopNode } from './top-node.js';
import { OutputNode } from './output-node.js';
import { OrderByNode } from './order-by-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
export type QueryNode = SelectQueryNode | InsertQueryNode | UpdateQueryNode | DeleteQueryNode | MergeQueryNode;
type HasJoins = {
    joins?: ReadonlyArray<JoinNode>;
};
type HasWhere = {
    where?: WhereNode;
};
type HasReturning = {
    returning?: ReturningNode;
};
type HasExplain = {
    explain?: ExplainNode;
};
type HasTop = {
    top?: TopNode;
};
type HasOutput = {
    output?: OutputNode;
};
type HasEndModifiers = {
    endModifiers?: ReadonlyArray<OperationNode>;
};
type HasOrderBy = {
    orderBy?: OrderByNode;
};
/**
 * @internal
 */
export declare const QueryNode: Readonly<{
    is(node: OperationNode): node is QueryNode;
    cloneWithEndModifier<T extends HasEndModifiers>(node: T, modifier: OperationNode): T;
    cloneWithWhere<T extends HasWhere>(node: T, operation: OperationNode): T;
    cloneWithJoin<T extends HasJoins>(node: T, join: JoinNode): T;
    cloneWithReturning<T extends HasReturning>(node: T, selections: ReadonlyArray<SelectionNode>): T;
    cloneWithoutReturning<T extends HasReturning>(node: T): T;
    cloneWithoutWhere<T extends HasWhere>(node: T): T;
    cloneWithExplain<T extends HasExplain>(node: T, format: ExplainFormat | undefined, options: Expression<any> | undefined): T;
    cloneWithTop<T extends HasTop>(node: T, top: TopNode): T;
    cloneWithOutput<T extends HasOutput>(node: T, selections: ReadonlyArray<SelectionNode>): T;
    cloneWithOrderByItems<T extends HasOrderBy>(node: T, items: ReadonlyArray<OrderByItemNode>): T;
    cloneWithoutOrderBy<T extends HasOrderBy>(node: T): T;
}>;
export {};
