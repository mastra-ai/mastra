import { OperationNode } from './operation-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
import { TableNode } from './table-node.js';
export type DropIndexNodeProps = Omit<DropIndexNode, 'kind' | 'name'>;
export interface DropIndexNode extends OperationNode {
    readonly kind: 'DropIndexNode';
    readonly name: SchemableIdentifierNode;
    readonly table?: TableNode;
    readonly ifExists?: boolean;
    readonly cascade?: boolean;
}
/**
 * @internal
 */
export declare const DropIndexNode: Readonly<{
    is(node: OperationNode): node is DropIndexNode;
    create(name: string, params?: DropIndexNodeProps): DropIndexNode;
    cloneWith(dropIndex: DropIndexNode, props: DropIndexNodeProps): DropIndexNode;
}>;
