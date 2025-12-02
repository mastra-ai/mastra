import { AliasedExpression, Expression } from '../expression/expression.js';
import { AliasNode } from '../operation-node/alias-node.js';
import { OperationNode } from '../operation-node/operation-node.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
import { SelectQueryBuilderExpression } from '../query-builder/select-query-builder-expression.js';
/**
 * Like `Expression<V>` but also accepts a select query with an output
 * type extending `Record<string, V>`. This type is useful because SQL
 * treats records with a single column as single values.
 */
export type OperandExpression<V> = Expression<V> | SelectQueryBuilderExpression<Record<string, V>>;
export type ExpressionOrFactory<DB, TB extends keyof DB, V> = OperandExpression<V> | OperandExpressionFactory<DB, TB, V>;
export type AliasedExpressionOrFactory<DB, TB extends keyof DB> = AliasedExpression<any, any> | AliasedExpressionFactory<DB, TB>;
export type ExpressionFactory<DB, TB extends keyof DB, V> = (eb: ExpressionBuilder<DB, TB>) => Expression<V>;
type OperandExpressionFactory<DB, TB extends keyof DB, V> = (eb: ExpressionBuilder<DB, TB>) => OperandExpression<V>;
type AliasedExpressionFactory<DB, TB extends keyof DB> = (eb: ExpressionBuilder<DB, TB>) => AliasedExpression<any, any>;
export declare function parseExpression(exp: ExpressionOrFactory<any, any, any>): OperationNode;
export declare function parseAliasedExpression(exp: AliasedExpressionOrFactory<any, any>): AliasNode;
export declare function isExpressionOrFactory(obj: unknown): obj is ExpressionOrFactory<any, any, any>;
export {};
