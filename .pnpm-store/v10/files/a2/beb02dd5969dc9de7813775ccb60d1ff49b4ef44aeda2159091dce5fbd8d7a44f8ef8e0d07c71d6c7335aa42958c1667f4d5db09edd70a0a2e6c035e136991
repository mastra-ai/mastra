import { ColumnNode } from './column-node.js';
import { OperationNode } from './operation-node.js';
import { TableNode } from './table-node.js';
export interface CommonTableExpressionNameNode extends OperationNode {
    readonly kind: 'CommonTableExpressionNameNode';
    readonly table: TableNode;
    readonly columns?: ReadonlyArray<ColumnNode>;
}
/**
 * @internal
 */
export declare const CommonTableExpressionNameNode: Readonly<{
    is(node: OperationNode): node is CommonTableExpressionNameNode;
    create(tableName: string, columnNames?: ReadonlyArray<string>): CommonTableExpressionNameNode;
}>;
