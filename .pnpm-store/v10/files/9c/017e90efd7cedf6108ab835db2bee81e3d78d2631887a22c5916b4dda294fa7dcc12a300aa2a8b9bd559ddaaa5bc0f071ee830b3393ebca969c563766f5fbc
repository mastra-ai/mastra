import { OperationNode } from './operation-node.js';
export type TopModifier = 'percent' | 'with ties' | 'percent with ties';
export interface TopNode extends OperationNode {
    readonly kind: 'TopNode';
    readonly expression: number | bigint;
    readonly modifiers?: TopModifier;
}
/**
 * @internal
 */
export declare const TopNode: Readonly<{
    is(node: OperationNode): node is TopNode;
    create(expression: number | bigint, modifiers?: TopModifier): TopNode;
}>;
