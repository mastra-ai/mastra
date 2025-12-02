import { AliasNode } from './alias-node.js';
import { JoinNode } from './join-node.js';
import { OperationNode } from './operation-node.js';
import { OutputNode } from './output-node.js';
import { ReturningNode } from './returning-node.js';
import { TableNode } from './table-node.js';
import { TopNode } from './top-node.js';
import { WhenNode } from './when-node.js';
import { WithNode } from './with-node.js';
export interface MergeQueryNode extends OperationNode {
    readonly kind: 'MergeQueryNode';
    readonly into: TableNode | AliasNode;
    readonly using?: JoinNode;
    readonly whens?: ReadonlyArray<WhenNode>;
    readonly with?: WithNode;
    readonly top?: TopNode;
    readonly returning?: ReturningNode;
    readonly output?: OutputNode;
    readonly endModifiers?: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const MergeQueryNode: Readonly<{
    is(node: OperationNode): node is MergeQueryNode;
    create(into: TableNode | AliasNode, withNode?: WithNode): MergeQueryNode;
    cloneWithUsing(mergeNode: MergeQueryNode, using: JoinNode): MergeQueryNode;
    cloneWithWhen(mergeNode: MergeQueryNode, when: WhenNode): MergeQueryNode;
    cloneWithThen(mergeNode: MergeQueryNode, then: OperationNode): MergeQueryNode;
}>;
