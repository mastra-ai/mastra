import { OperationNode } from './operation-node.js';
export interface RawNode extends OperationNode {
    readonly kind: 'RawNode';
    readonly sqlFragments: ReadonlyArray<string>;
    readonly parameters: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const RawNode: Readonly<{
    is(node: OperationNode): node is RawNode;
    create(sqlFragments: ReadonlyArray<string>, parameters: ReadonlyArray<OperationNode>): RawNode;
    createWithSql(sql: string): RawNode;
    createWithChild(child: OperationNode): RawNode;
    createWithChildren(children: ReadonlyArray<OperationNode>): RawNode;
}>;
