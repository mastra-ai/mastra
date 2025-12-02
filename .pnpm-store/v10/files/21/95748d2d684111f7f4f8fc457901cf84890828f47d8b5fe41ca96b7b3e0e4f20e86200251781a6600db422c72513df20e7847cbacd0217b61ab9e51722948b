import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
import { OnModifyForeignAction, ReferencesNode } from './references-node.js';
import { TableNode } from './table-node.js';
export type ForeignKeyConstraintNodeProps = Omit<ForeignKeyConstraintNode, 'kind' | 'columns' | 'references'>;
export interface ForeignKeyConstraintNode extends OperationNode {
    readonly kind: 'ForeignKeyConstraintNode';
    readonly columns: ReadonlyArray<ColumnNode>;
    readonly references: ReferencesNode;
    readonly onDelete?: OnModifyForeignAction;
    readonly onUpdate?: OnModifyForeignAction;
    readonly name?: IdentifierNode;
    readonly deferrable?: boolean;
    readonly initiallyDeferred?: boolean;
}
/**
 * @internal
 */
export declare const ForeignKeyConstraintNode: Readonly<{
    is(node: OperationNode): node is ForeignKeyConstraintNode;
    create(sourceColumns: ReadonlyArray<ColumnNode>, targetTable: TableNode, targetColumns: ReadonlyArray<ColumnNode>, constraintName?: string): ForeignKeyConstraintNode;
    cloneWith(node: ForeignKeyConstraintNode, props: ForeignKeyConstraintNodeProps): Readonly<{
        name?: IdentifierNode;
        onDelete?: OnModifyForeignAction;
        onUpdate?: OnModifyForeignAction;
        deferrable?: boolean;
        initiallyDeferred?: boolean;
        kind: "ForeignKeyConstraintNode";
        columns: ReadonlyArray<ColumnNode>;
        references: ReferencesNode;
    }>;
}>;
