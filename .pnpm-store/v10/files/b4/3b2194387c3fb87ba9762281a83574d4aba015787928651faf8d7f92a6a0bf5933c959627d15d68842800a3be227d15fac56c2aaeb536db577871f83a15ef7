import { OperationNode } from './operation-node.js';
import { TableNode } from './table-node.js';
export type DropTablexNodeParams = Omit<Partial<DropTableNode>, 'kind' | 'table'>;
export interface DropTableNode extends OperationNode {
    readonly kind: 'DropTableNode';
    readonly table: TableNode;
    readonly ifExists?: boolean;
    readonly cascade?: boolean;
}
/**
 * @internal
 */
export declare const DropTableNode: Readonly<{
    is(node: OperationNode): node is DropTableNode;
    create(table: TableNode, params?: DropTablexNodeParams): DropTableNode;
    cloneWith(dropIndex: DropTableNode, params: DropTablexNodeParams): DropTableNode;
}>;
