import { OperationNode } from './operation-node.js';
export interface IdentifierNode extends OperationNode {
    readonly kind: 'IdentifierNode';
    readonly name: string;
}
/**
 * @internal
 */
export declare const IdentifierNode: Readonly<{
    is(node: OperationNode): node is IdentifierNode;
    create(name: string): IdentifierNode;
}>;
