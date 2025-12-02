import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
import { RawNode } from './raw-node.js';
export type AddIndexNodeProps = Omit<AddIndexNode, 'kind' | 'name'>;
export interface AddIndexNode extends OperationNode {
    readonly kind: 'AddIndexNode';
    readonly name: IdentifierNode;
    readonly columns?: OperationNode[];
    readonly unique?: boolean;
    readonly using?: RawNode;
    readonly ifNotExists?: boolean;
}
/**
 * @internal
 */
export declare const AddIndexNode: Readonly<{
    is(node: OperationNode): node is AddIndexNode;
    create(name: string): AddIndexNode;
    cloneWith(node: AddIndexNode, props: AddIndexNodeProps): AddIndexNode;
    cloneWithColumns(node: AddIndexNode, columns: OperationNode[]): AddIndexNode;
}>;
