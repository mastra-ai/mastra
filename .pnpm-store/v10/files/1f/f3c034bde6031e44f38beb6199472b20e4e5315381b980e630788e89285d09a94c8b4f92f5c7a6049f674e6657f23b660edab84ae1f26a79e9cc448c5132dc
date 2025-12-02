import { FromNode } from './from-node.js';
import { JoinNode } from './join-node.js';
import { OperationNode } from './operation-node.js';
import { ReturningNode } from './returning-node.js';
import { WhereNode } from './where-node.js';
import { WithNode } from './with-node.js';
import { LimitNode } from './limit-node.js';
import { OrderByNode } from './order-by-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
import { ExplainNode } from './explain-node.js';
import { UsingNode } from './using-node.js';
import { TopNode } from './top-node.js';
import { OutputNode } from './output-node.js';
export interface DeleteQueryNode extends OperationNode {
    readonly kind: 'DeleteQueryNode';
    readonly from: FromNode;
    readonly using?: UsingNode;
    readonly joins?: ReadonlyArray<JoinNode>;
    readonly where?: WhereNode;
    readonly returning?: ReturningNode;
    readonly with?: WithNode;
    readonly orderBy?: OrderByNode;
    readonly limit?: LimitNode;
    readonly explain?: ExplainNode;
    readonly endModifiers?: ReadonlyArray<OperationNode>;
    readonly top?: TopNode;
    readonly output?: OutputNode;
}
/**
 * @internal
 */
export declare const DeleteQueryNode: Readonly<{
    is(node: OperationNode): node is DeleteQueryNode;
    create(fromItems: OperationNode[], withNode?: WithNode): DeleteQueryNode;
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node: DeleteQueryNode, items: ReadonlyArray<OrderByItemNode>) => DeleteQueryNode;
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node: DeleteQueryNode) => DeleteQueryNode;
    cloneWithLimit(deleteNode: DeleteQueryNode, limit: LimitNode): DeleteQueryNode;
    cloneWithoutLimit(deleteNode: DeleteQueryNode): DeleteQueryNode;
    cloneWithUsing(deleteNode: DeleteQueryNode, tables: OperationNode[]): DeleteQueryNode;
}>;
