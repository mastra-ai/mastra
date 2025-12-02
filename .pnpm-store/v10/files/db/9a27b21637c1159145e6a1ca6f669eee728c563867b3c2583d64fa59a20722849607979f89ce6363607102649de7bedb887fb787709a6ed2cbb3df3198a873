import { ColumnUpdateNode } from './column-update-node.js';
import { OperationNode } from './operation-node.js';
export type OnDuplicateKeyNodeProps = Omit<OnDuplicateKeyNode, 'kind'>;
export interface OnDuplicateKeyNode extends OperationNode {
    readonly kind: 'OnDuplicateKeyNode';
    readonly updates: ReadonlyArray<ColumnUpdateNode>;
}
/**
 * @internal
 */
export declare const OnDuplicateKeyNode: Readonly<{
    is(node: OperationNode): node is OnDuplicateKeyNode;
    create(updates: ReadonlyArray<ColumnUpdateNode>): OnDuplicateKeyNode;
}>;
