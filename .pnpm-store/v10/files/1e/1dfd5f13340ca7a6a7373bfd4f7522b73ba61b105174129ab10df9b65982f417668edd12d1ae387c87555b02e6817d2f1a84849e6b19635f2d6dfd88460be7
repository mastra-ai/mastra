import { ColumnDefinitionNode } from './column-definition-node.js';
import { OperationNode } from './operation-node.js';
export interface ModifyColumnNode extends OperationNode {
    readonly kind: 'ModifyColumnNode';
    readonly column: ColumnDefinitionNode;
}
/**
 * @internal
 */
export declare const ModifyColumnNode: Readonly<{
    is(node: OperationNode): node is ModifyColumnNode;
    create(column: ColumnDefinitionNode): ModifyColumnNode;
}>;
