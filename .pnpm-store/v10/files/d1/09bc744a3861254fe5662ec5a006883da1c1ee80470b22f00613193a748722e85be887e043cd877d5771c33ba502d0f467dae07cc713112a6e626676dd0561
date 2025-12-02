import { CommonTableExpressionNameNode } from './common-table-expression-name-node.js';
import { OperationNode } from './operation-node.js';
type CommonTableExpressionNodeProps = Pick<CommonTableExpressionNode, 'materialized'>;
export interface CommonTableExpressionNode extends OperationNode {
    readonly kind: 'CommonTableExpressionNode';
    readonly name: CommonTableExpressionNameNode;
    readonly materialized?: boolean;
    readonly expression: OperationNode;
}
/**
 * @internal
 */
export declare const CommonTableExpressionNode: Readonly<{
    is(node: OperationNode): node is CommonTableExpressionNode;
    create(name: CommonTableExpressionNameNode, expression: OperationNode): CommonTableExpressionNode;
    cloneWith(node: CommonTableExpressionNode, props: CommonTableExpressionNodeProps): CommonTableExpressionNode;
}>;
export {};
