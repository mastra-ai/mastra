import { UnaryOperator } from '../operation-node/operator-node.js';
import { UnaryOperationNode } from '../operation-node/unary-operation-node.js';
import { ExpressionOrFactory } from './expression-parser.js';
import { ReferenceExpression } from './reference-parser.js';
export type ExistsExpression<DB, TB extends keyof DB> = ExpressionOrFactory<DB, TB, any>;
export declare function parseExists(operand: ExistsExpression<any, any>): UnaryOperationNode;
export declare function parseNotExists(operand: ExistsExpression<any, any>): UnaryOperationNode;
export declare function parseUnaryOperation(operator: UnaryOperator, operand: ReferenceExpression<any, any>): UnaryOperationNode;
