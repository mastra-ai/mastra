import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
export interface CollateNode extends OperationNode {
    readonly kind: 'CollateNode';
    readonly collation: IdentifierNode;
}
/**
 * @internal
 */
export declare const CollateNode: {
    is(node: OperationNode): node is CollateNode;
    create(collation: string): CollateNode;
};
