import { OperationNode } from './operation-node.js';
import { TableNode } from './table-node.js';
import { ConstraintNode } from './constraint-node.js';
import { ColumnDefinitionNode } from './column-definition-node.js';
import { ArrayItemType } from '../util/type-utils.js';
export declare const ON_COMMIT_ACTIONS: string[];
export type OnCommitAction = ArrayItemType<typeof ON_COMMIT_ACTIONS>;
export type CreateTableNodeParams = Omit<CreateTableNode, 'kind' | 'table' | 'columns' | 'constraints' | 'frontModifiers' | 'endModifiers'>;
export interface CreateTableNode extends OperationNode {
    readonly kind: 'CreateTableNode';
    readonly table: TableNode;
    readonly columns: ReadonlyArray<ColumnDefinitionNode>;
    readonly constraints?: ReadonlyArray<ConstraintNode>;
    readonly temporary?: boolean;
    readonly ifNotExists?: boolean;
    readonly onCommit?: OnCommitAction;
    readonly frontModifiers?: ReadonlyArray<OperationNode>;
    readonly endModifiers?: ReadonlyArray<OperationNode>;
    readonly selectQuery?: OperationNode;
}
/**
 * @internal
 */
export declare const CreateTableNode: Readonly<{
    is(node: OperationNode): node is CreateTableNode;
    create(table: TableNode): CreateTableNode;
    cloneWithColumn(createTable: CreateTableNode, column: ColumnDefinitionNode): CreateTableNode;
    cloneWithConstraint(createTable: CreateTableNode, constraint: ConstraintNode): CreateTableNode;
    cloneWithFrontModifier(createTable: CreateTableNode, modifier: OperationNode): CreateTableNode;
    cloneWithEndModifier(createTable: CreateTableNode, modifier: OperationNode): CreateTableNode;
    cloneWith(createTable: CreateTableNode, params: CreateTableNodeParams): CreateTableNode;
}>;
