import { OperationNode } from './operation-node.js';
import { CommonTableExpressionNode } from './common-table-expression-node.js';
export type WithNodeParams = Omit<WithNode, 'kind' | 'expressions'>;
export interface WithNode extends OperationNode {
    readonly kind: 'WithNode';
    readonly expressions: ReadonlyArray<CommonTableExpressionNode>;
    readonly recursive?: boolean;
}
/**
 * @internal
 */
export declare const WithNode: Readonly<{
    is(node: OperationNode): node is WithNode;
    create(expression: CommonTableExpressionNode, params?: WithNodeParams): WithNode;
    cloneWithExpression(withNode: WithNode, expression: CommonTableExpressionNode): WithNode;
}>;
