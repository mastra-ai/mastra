import { OperationNode } from './operation-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
export type DropViewNodeParams = Omit<Partial<DropViewNode>, 'kind' | 'name'>;
export interface DropViewNode extends OperationNode {
    readonly kind: 'DropViewNode';
    readonly name: SchemableIdentifierNode;
    readonly ifExists?: boolean;
    readonly materialized?: boolean;
    readonly cascade?: boolean;
}
/**
 * @internal
 */
export declare const DropViewNode: Readonly<{
    is(node: OperationNode): node is DropViewNode;
    create(name: string): DropViewNode;
    cloneWith(dropView: DropViewNode, params: DropViewNodeParams): DropViewNode;
}>;
