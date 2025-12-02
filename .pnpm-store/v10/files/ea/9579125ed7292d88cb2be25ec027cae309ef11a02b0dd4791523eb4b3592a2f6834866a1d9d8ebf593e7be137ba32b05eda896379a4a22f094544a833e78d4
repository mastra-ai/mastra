import { OperationNode } from './operation-node.js';
import { PrimitiveValueListNode } from './primitive-value-list-node.js';
import { ValueListNode } from './value-list-node.js';
export type ValuesItemNode = ValueListNode | PrimitiveValueListNode;
export interface ValuesNode extends OperationNode {
    readonly kind: 'ValuesNode';
    readonly values: ReadonlyArray<ValuesItemNode>;
}
/**
 * @internal
 */
export declare const ValuesNode: Readonly<{
    is(node: OperationNode): node is ValuesNode;
    create(values: ReadonlyArray<ValuesItemNode>): ValuesNode;
}>;
