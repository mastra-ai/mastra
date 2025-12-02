import { ColumnDefinitionNode } from './column-definition-node.js';
import { OperationNode } from './operation-node.js';
export interface AddColumnNode extends OperationNode {
    readonly kind: 'AddColumnNode';
    readonly column: ColumnDefinitionNode;
}
/**
 * @internal
 */
export declare const AddColumnNode: Readonly<{
    is(node: OperationNode): node is AddColumnNode;
    create(column: ColumnDefinitionNode): AddColumnNode;
}>;
