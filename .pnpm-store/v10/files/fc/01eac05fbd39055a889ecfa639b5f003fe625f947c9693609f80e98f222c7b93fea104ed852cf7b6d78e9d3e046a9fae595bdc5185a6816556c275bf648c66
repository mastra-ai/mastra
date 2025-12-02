import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export interface UniqueConstraintNode extends OperationNode {
    readonly kind: 'UniqueConstraintNode';
    readonly columns: ReadonlyArray<ColumnNode>;
    readonly name?: IdentifierNode;
    readonly nullsNotDistinct?: boolean;
    readonly deferrable?: boolean;
    readonly initiallyDeferred?: boolean;
}
export type UniqueConstraintNodeProps = Omit<Partial<UniqueConstraintNode>, 'kind'>;
/**
 * @internal
 */
export declare const UniqueConstraintNode: Readonly<{
    is(node: OperationNode): node is UniqueConstraintNode;
    create(columns: string[], constraintName?: string, nullsNotDistinct?: boolean): UniqueConstraintNode;
    cloneWith(node: UniqueConstraintNode, props: UniqueConstraintNodeProps): UniqueConstraintNode;
}>;
