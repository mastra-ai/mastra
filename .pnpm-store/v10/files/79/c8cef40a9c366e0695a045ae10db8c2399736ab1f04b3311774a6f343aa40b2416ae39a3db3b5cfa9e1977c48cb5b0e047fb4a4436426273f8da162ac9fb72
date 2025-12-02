import { OperationNode } from './operation-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
import { ValueListNode } from './value-list-node.js';
export type CreateTypeNodeParams = Omit<Partial<CreateTypeNode>, 'kind'>;
export interface CreateTypeNode extends OperationNode {
    readonly kind: 'CreateTypeNode';
    readonly name: SchemableIdentifierNode;
    readonly enum?: ValueListNode;
}
/**
 * @internal
 */
export declare const CreateTypeNode: Readonly<{
    is(node: OperationNode): node is CreateTypeNode;
    create(name: SchemableIdentifierNode): CreateTypeNode;
    cloneWithEnum(createType: CreateTypeNode, values: readonly string[]): CreateTypeNode;
}>;
