import { OperationNode } from './operation-node.js';
export interface UsingNode extends OperationNode {
    readonly kind: 'UsingNode';
    readonly tables: ReadonlyArray<OperationNode>;
}
/**
 * @internal
 */
export declare const UsingNode: Readonly<{
    is(node: OperationNode): node is UsingNode;
    create(tables: ReadonlyArray<OperationNode>): UsingNode;
    cloneWithTables(using: UsingNode, tables: ReadonlyArray<OperationNode>): UsingNode;
}>;
