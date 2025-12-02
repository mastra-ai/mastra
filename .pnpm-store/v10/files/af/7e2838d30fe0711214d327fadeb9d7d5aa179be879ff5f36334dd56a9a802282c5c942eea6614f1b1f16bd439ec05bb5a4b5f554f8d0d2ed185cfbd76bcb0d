import { CheckConstraintNode } from './check-constraint-node.js';
import { ColumnNode } from './column-node.js';
import { DefaultValueNode } from './default-value-node.js';
import { GeneratedNode } from './generated-node.js';
import { OperationNode } from './operation-node.js';
import { ReferencesNode } from './references-node.js';
export type ColumnDefinitionNodeProps = Omit<Partial<ColumnDefinitionNode>, 'kind' | 'dataType'>;
export interface ColumnDefinitionNode extends OperationNode {
    readonly kind: 'ColumnDefinitionNode';
    readonly column: ColumnNode;
    readonly dataType: OperationNode;
    readonly references?: ReferencesNode;
    readonly primaryKey?: boolean;
    readonly autoIncrement?: boolean;
    readonly unique?: boolean;
    readonly notNull?: boolean;
    readonly defaultTo?: DefaultValueNode;
    readonly check?: CheckConstraintNode;
    readonly generated?: GeneratedNode;
    readonly unsigned?: boolean;
    readonly frontModifiers?: ReadonlyArray<OperationNode>;
    readonly endModifiers?: ReadonlyArray<OperationNode>;
    readonly nullsNotDistinct?: boolean;
    readonly identity?: boolean;
    readonly ifNotExists?: boolean;
}
/**
 * @internal
 */
export declare const ColumnDefinitionNode: Readonly<{
    is(node: OperationNode): node is ColumnDefinitionNode;
    create(column: string, dataType: OperationNode): ColumnDefinitionNode;
    cloneWithFrontModifier(node: ColumnDefinitionNode, modifier: OperationNode): ColumnDefinitionNode;
    cloneWithEndModifier(node: ColumnDefinitionNode, modifier: OperationNode): ColumnDefinitionNode;
    cloneWith(node: ColumnDefinitionNode, props: ColumnDefinitionNodeProps): ColumnDefinitionNode;
}>;
