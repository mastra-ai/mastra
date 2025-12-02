import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export interface SchemableIdentifierNode extends OperationNode {
    readonly kind: 'SchemableIdentifierNode';
    readonly schema?: IdentifierNode;
    readonly identifier: IdentifierNode;
}
/**
 * @internal
 */
export declare const SchemableIdentifierNode: Readonly<{
    is(node: OperationNode): node is SchemableIdentifierNode;
    create(identifier: string): SchemableIdentifierNode;
    createWithSchema(schema: string, identifier: string): SchemableIdentifierNode;
}>;
