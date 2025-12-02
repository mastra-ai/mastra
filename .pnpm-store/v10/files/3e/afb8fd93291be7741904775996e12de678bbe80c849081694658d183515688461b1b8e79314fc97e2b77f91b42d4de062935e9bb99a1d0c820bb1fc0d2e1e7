import { OperationNode } from './operation-node.js';
export type GeneratedNodeParams = Omit<GeneratedNode, 'kind' | 'expression'>;
export interface GeneratedNode extends OperationNode {
    readonly kind: 'GeneratedNode';
    readonly byDefault?: boolean;
    readonly always?: boolean;
    readonly identity?: boolean;
    readonly stored?: boolean;
    readonly expression?: OperationNode;
}
/**
 * @internal
 */
export declare const GeneratedNode: Readonly<{
    is(node: OperationNode): node is GeneratedNode;
    create(params: GeneratedNodeParams): GeneratedNode;
    createWithExpression(expression: OperationNode): GeneratedNode;
    cloneWith(node: GeneratedNode, params: GeneratedNodeParams): GeneratedNode;
}>;
