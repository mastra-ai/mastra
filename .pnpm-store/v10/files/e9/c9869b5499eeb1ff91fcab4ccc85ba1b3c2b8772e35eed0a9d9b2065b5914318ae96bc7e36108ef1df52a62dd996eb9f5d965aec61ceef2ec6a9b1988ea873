import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export type DropSchemaNodeParams = Omit<Partial<DropSchemaNode>, 'kind' | 'schema'>;
export interface DropSchemaNode extends OperationNode {
    readonly kind: 'DropSchemaNode';
    readonly schema: IdentifierNode;
    readonly ifExists?: boolean;
    readonly cascade?: boolean;
}
/**
 * @internal
 */
export declare const DropSchemaNode: Readonly<{
    is(node: OperationNode): node is DropSchemaNode;
    create(schema: string, params?: DropSchemaNodeParams): DropSchemaNode;
    cloneWith(dropSchema: DropSchemaNode, params: DropSchemaNodeParams): DropSchemaNode;
}>;
