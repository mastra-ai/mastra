import { OperationNode } from './operation-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
export type DropTypeNodeParams = Omit<Partial<DropTypeNode>, 'kind' | 'name'>;
export interface DropTypeNode extends OperationNode {
    readonly kind: 'DropTypeNode';
    readonly name: SchemableIdentifierNode;
    readonly ifExists?: boolean;
}
/**
 * @internal
 */
export declare const DropTypeNode: Readonly<{
    is(node: OperationNode): node is DropTypeNode;
    create(name: SchemableIdentifierNode): DropTypeNode;
    cloneWith(dropType: DropTypeNode, params: DropTypeNodeParams): DropTypeNode;
}>;
