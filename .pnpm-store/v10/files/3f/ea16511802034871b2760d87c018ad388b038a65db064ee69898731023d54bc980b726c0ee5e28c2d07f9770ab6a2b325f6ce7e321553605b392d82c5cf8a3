import { OperationNode } from './operation-node.js';
import { ColumnNode } from './column-node.js';
import { RawNode } from './raw-node.js';
export type AlterColumnNodeProps = Omit<AlterColumnNode, 'kind' | 'column'>;
export interface AlterColumnNode extends OperationNode {
    readonly kind: 'AlterColumnNode';
    readonly column: ColumnNode;
    readonly dataType?: OperationNode;
    readonly dataTypeExpression?: RawNode;
    readonly setDefault?: OperationNode;
    readonly dropDefault?: true;
    readonly setNotNull?: true;
    readonly dropNotNull?: true;
}
/**
 * @internal
 */
export declare const AlterColumnNode: Readonly<{
    is(node: OperationNode): node is AlterColumnNode;
    create<T extends keyof AlterColumnNodeProps>(column: string, prop: T, value: Required<AlterColumnNodeProps>[T]): AlterColumnNode;
}>;
