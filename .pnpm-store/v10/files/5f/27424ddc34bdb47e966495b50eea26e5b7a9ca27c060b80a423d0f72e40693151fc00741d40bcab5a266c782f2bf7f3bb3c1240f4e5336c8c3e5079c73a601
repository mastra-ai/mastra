import { OperationNode } from './operation-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
export interface TableNode extends OperationNode {
    readonly kind: 'TableNode';
    readonly table: SchemableIdentifierNode;
}
/**
 * @internal
 */
export declare const TableNode: Readonly<{
    is(node: OperationNode): node is TableNode;
    create(table: string): TableNode;
    createWithSchema(schema: string, table: string): TableNode;
}>;
