import { OperationNode } from './operation-node.js';
import { ColumnNode } from './column-node.js';
import { TableNode } from './table-node.js';
import { ArrayItemType } from '../util/type-utils.js';
export declare const ON_MODIFY_FOREIGN_ACTIONS: readonly ["no action", "restrict", "cascade", "set null", "set default"];
export type OnModifyForeignAction = ArrayItemType<typeof ON_MODIFY_FOREIGN_ACTIONS>;
export interface ReferencesNode extends OperationNode {
    readonly kind: 'ReferencesNode';
    readonly table: TableNode;
    readonly columns: ReadonlyArray<ColumnNode>;
    readonly onDelete?: OnModifyForeignAction;
    readonly onUpdate?: OnModifyForeignAction;
}
/**
 * @internal
 */
export declare const ReferencesNode: Readonly<{
    is(node: OperationNode): node is ReferencesNode;
    create(table: TableNode, columns: ReadonlyArray<ColumnNode>): ReferencesNode;
    cloneWithOnDelete(references: ReferencesNode, onDelete: OnModifyForeignAction): ReferencesNode;
    cloneWithOnUpdate(references: ReferencesNode, onUpdate: OnModifyForeignAction): ReferencesNode;
}>;
