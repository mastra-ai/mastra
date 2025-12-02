import { ColumnNode } from './column-node.js';
import { OperationNode } from './operation-node.js';
import { RawNode } from './raw-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
import { SelectQueryNode } from './select-query-node.js';
export type CreateViewNodeParams = Omit<Partial<CreateViewNode>, 'kind' | 'name'>;
export interface CreateViewNode extends OperationNode {
    readonly kind: 'CreateViewNode';
    readonly name: SchemableIdentifierNode;
    readonly temporary?: boolean;
    readonly materialized?: boolean;
    readonly orReplace?: boolean;
    readonly ifNotExists?: boolean;
    readonly columns?: ReadonlyArray<ColumnNode>;
    readonly as?: SelectQueryNode | RawNode;
}
/**
 * @internal
 */
export declare const CreateViewNode: Readonly<{
    is(node: OperationNode): node is CreateViewNode;
    create(name: string): CreateViewNode;
    cloneWith(createView: CreateViewNode, params: CreateViewNodeParams): CreateViewNode;
}>;
