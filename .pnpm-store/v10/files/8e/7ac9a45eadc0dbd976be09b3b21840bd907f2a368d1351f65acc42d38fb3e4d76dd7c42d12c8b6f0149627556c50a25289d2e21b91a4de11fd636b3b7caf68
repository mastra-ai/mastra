import { OperationNode } from './operation-node.js';
export declare const COMPARISON_OPERATORS: readonly ["=", "==", "!=", "<>", ">", ">=", "<", "<=", "in", "not in", "is", "is not", "like", "not like", "match", "ilike", "not ilike", "@>", "<@", "^@", "&&", "?", "?&", "?|", "!<", "!>", "<=>", "!~", "~", "~*", "!~*", "@@", "@@@", "!!", "<->", "regexp", "is distinct from", "is not distinct from"];
export declare const ARITHMETIC_OPERATORS: readonly ["+", "-", "*", "/", "%", "^", "&", "|", "#", "<<", ">>"];
export declare const JSON_OPERATORS: readonly ["->", "->>"];
export declare const BINARY_OPERATORS: readonly ["=", "==", "!=", "<>", ">", ">=", "<", "<=", "in", "not in", "is", "is not", "like", "not like", "match", "ilike", "not ilike", "@>", "<@", "^@", "&&", "?", "?&", "?|", "!<", "!>", "<=>", "!~", "~", "~*", "!~*", "@@", "@@@", "!!", "<->", "regexp", "is distinct from", "is not distinct from", "+", "-", "*", "/", "%", "^", "&", "|", "#", "<<", ">>", "&&", "||"];
export declare const UNARY_FILTER_OPERATORS: readonly ["exists", "not exists"];
export declare const UNARY_OPERATORS: readonly ["not", "-", "exists", "not exists"];
export declare const OPERATORS: readonly ["=", "==", "!=", "<>", ">", ">=", "<", "<=", "in", "not in", "is", "is not", "like", "not like", "match", "ilike", "not ilike", "@>", "<@", "^@", "&&", "?", "?&", "?|", "!<", "!>", "<=>", "!~", "~", "~*", "!~*", "@@", "@@@", "!!", "<->", "regexp", "is distinct from", "is not distinct from", "+", "-", "*", "/", "%", "^", "&", "|", "#", "<<", ">>", "&&", "||", "->", "->>", "not", "-", "exists", "not exists", "between", "between symmetric"];
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];
export type ArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number];
export type JSONOperator = (typeof JSON_OPERATORS)[number];
export type JSONOperatorWith$ = JSONOperator | `${JSONOperator}$`;
export type BinaryOperator = (typeof BINARY_OPERATORS)[number];
export type UnaryOperator = (typeof UNARY_OPERATORS)[number];
export type UnaryFilterOperator = (typeof UNARY_FILTER_OPERATORS)[number];
export type Operator = (typeof OPERATORS)[number];
export interface OperatorNode extends OperationNode {
    readonly kind: 'OperatorNode';
    readonly operator: Operator;
}
/**
 * @internal
 */
export declare const OperatorNode: Readonly<{
    is(node: OperationNode): node is OperatorNode;
    create(operator: Operator): OperatorNode;
}>;
export declare function isOperator(op: unknown): op is Operator;
export declare function isBinaryOperator(op: unknown): op is BinaryOperator;
export declare function isComparisonOperator(op: unknown): op is ComparisonOperator;
export declare function isArithmeticOperator(op: unknown): op is ArithmeticOperator;
export declare function isJSONOperator(op: unknown): op is JSONOperator;
