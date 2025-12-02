import { OperationNode } from './operation-node.js';
export type JSONPathLegType = 'Member' | 'ArrayLocation';
export interface JSONPathLegNode extends OperationNode {
    readonly kind: 'JSONPathLegNode';
    readonly type: JSONPathLegType;
    readonly value: string | number;
}
/**
 * @internal
 */
export declare const JSONPathLegNode: Readonly<{
    is(node: OperationNode): node is JSONPathLegNode;
    create(type: JSONPathLegType, value: string | number): JSONPathLegNode;
}>;
