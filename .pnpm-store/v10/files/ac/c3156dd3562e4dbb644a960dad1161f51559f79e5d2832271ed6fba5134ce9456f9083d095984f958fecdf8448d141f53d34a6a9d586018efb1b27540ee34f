import { OperationNode } from './operation-node.js';
export interface DefaultValueNode extends OperationNode {
    readonly kind: 'DefaultValueNode';
    readonly defaultValue: OperationNode;
}
/**
 * @internal
 */
export declare const DefaultValueNode: Readonly<{
    is(node: OperationNode): node is DefaultValueNode;
    create(defaultValue: OperationNode): DefaultValueNode;
}>;
