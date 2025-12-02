import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export interface PrimaryKeyConstraintNode extends OperationNode {
    readonly kind: 'PrimaryKeyConstraintNode';
    readonly columns: ReadonlyArray<ColumnNode>;
    readonly name?: IdentifierNode;
    readonly deferrable?: boolean;
    readonly initiallyDeferred?: boolean;
}
export type PrimaryKeyConstraintNodeProps = Omit<Partial<PrimaryKeyConstraintNode>, 'kind'>;
/**
 * @internal
 */
export declare const PrimaryKeyConstraintNode: Readonly<{
    is(node: OperationNode): node is PrimaryKeyConstraintNode;
    create(columns: string[], constraintName?: string): PrimaryKeyConstraintNode;
    cloneWith(node: PrimaryKeyConstraintNode, props: PrimaryKeyConstraintNodeProps): PrimaryKeyConstraintNode;
}>;
/**
 * Backwards compatibility for a typo in the codebase.
 *
 * @deprecated Use {@link PrimaryKeyConstraintNode} instead.
 */
export declare const PrimaryConstraintNode: Readonly<{
    is(node: OperationNode): node is PrimaryKeyConstraintNode;
    create(columns: string[], constraintName?: string): PrimaryKeyConstraintNode;
    cloneWith(node: PrimaryKeyConstraintNode, props: PrimaryKeyConstraintNodeProps): PrimaryKeyConstraintNode;
}>;
