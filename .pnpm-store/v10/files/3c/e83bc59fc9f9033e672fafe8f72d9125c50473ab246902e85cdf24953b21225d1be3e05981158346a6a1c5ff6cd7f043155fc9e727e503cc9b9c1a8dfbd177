import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export type CreateSchemaNodeParams = Omit<Partial<CreateSchemaNode>, 'kind' | 'schema'>;
export interface CreateSchemaNode extends OperationNode {
    readonly kind: 'CreateSchemaNode';
    readonly schema: IdentifierNode;
    readonly ifNotExists?: boolean;
}
/**
 * @internal
 */
export declare const CreateSchemaNode: Readonly<{
    is(node: OperationNode): node is CreateSchemaNode;
    create(schema: string, params?: CreateSchemaNodeParams): CreateSchemaNode;
    cloneWith(createSchema: CreateSchemaNode, params: CreateSchemaNodeParams): CreateSchemaNode;
}>;
