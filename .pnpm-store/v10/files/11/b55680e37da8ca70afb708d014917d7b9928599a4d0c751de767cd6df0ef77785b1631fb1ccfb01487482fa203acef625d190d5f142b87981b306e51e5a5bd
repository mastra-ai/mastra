import { ColumnUpdateNode } from './column-update-node.js';
import { JoinNode } from './join-node.js';
import { OperationNode } from './operation-node.js';
import { ReturningNode } from './returning-node.js';
import { WhereNode } from './where-node.js';
import { WithNode } from './with-node.js';
import { FromNode } from './from-node.js';
import { ExplainNode } from './explain-node.js';
import { LimitNode } from './limit-node.js';
import { TopNode } from './top-node.js';
import { OutputNode } from './output-node.js';
import { OrderByNode } from './order-by-node.js';
export interface UpdateQueryNode extends OperationNode {
    readonly kind: 'UpdateQueryNode';
    readonly table?: OperationNode;
    readonly from?: FromNode;
    readonly joins?: ReadonlyArray<JoinNode>;
    readonly where?: WhereNode;
    readonly updates?: ReadonlyArray<ColumnUpdateNode>;
    readonly returning?: ReturningNode;
    readonly with?: WithNode;
    readonly explain?: ExplainNode;
    readonly endModifiers?: ReadonlyArray<OperationNode>;
    readonly limit?: LimitNode;
    readonly top?: TopNode;
    readonly output?: OutputNode;
    readonly orderBy?: OrderByNode;
}
/**
 * @internal
 */
export declare const UpdateQueryNode: Readonly<{
    is(node: OperationNode): node is UpdateQueryNode;
    create(tables: ReadonlyArray<OperationNode>, withNode?: WithNode): UpdateQueryNode;
    createWithoutTable(): UpdateQueryNode;
    cloneWithFromItems(updateQuery: UpdateQueryNode, fromItems: ReadonlyArray<OperationNode>): UpdateQueryNode;
    cloneWithUpdates(updateQuery: UpdateQueryNode, updates: ReadonlyArray<ColumnUpdateNode>): UpdateQueryNode;
    cloneWithLimit(updateQuery: UpdateQueryNode, limit: LimitNode): UpdateQueryNode;
}>;
