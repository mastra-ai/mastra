import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
import { RawNode } from './raw-node.js';
import { TableNode } from './table-node.js';
import { WhereNode } from './where-node.js';
export type CreateIndexNodeProps = Omit<CreateIndexNode, 'kind' | 'name'>;
export type IndexType = 'btree' | 'hash' | 'gist' | 'gin';
export interface CreateIndexNode extends OperationNode {
    readonly kind: 'CreateIndexNode';
    readonly name: IdentifierNode;
    readonly table?: TableNode;
    readonly columns?: OperationNode[];
    readonly unique?: boolean;
    readonly using?: RawNode;
    readonly ifNotExists?: boolean;
    readonly where?: WhereNode;
    readonly nullsNotDistinct?: boolean;
}
/**
 * @internal
 */
export declare const CreateIndexNode: Readonly<{
    is(node: OperationNode): node is CreateIndexNode;
    create(name: string): CreateIndexNode;
    cloneWith(node: CreateIndexNode, props: CreateIndexNodeProps): CreateIndexNode;
    cloneWithColumns(node: CreateIndexNode, columns: OperationNode[]): CreateIndexNode;
}>;
