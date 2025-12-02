import { ExpressionBuilder } from '../expression/expression-builder.js';
import { Expression } from '../expression/expression.js';
import { SetOperator, SetOperationNode } from '../operation-node/set-operation-node.js';
export type SetOperandExpression<DB, O> = Expression<O> | ReadonlyArray<Expression<O>> | ((eb: ExpressionBuilder<DB, never>) => Expression<O> | ReadonlyArray<Expression<O>>);
export declare function parseSetOperations(operator: SetOperator, expression: SetOperandExpression<any, any>, all: boolean): SetOperationNode[];
