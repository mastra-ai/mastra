/// <reference types="./operator-node.d.ts" />
import { freeze, isString } from '../util/object-utils.js';
export const COMPARISON_OPERATORS = [
    '=',
    '==',
    '!=',
    '<>',
    '>',
    '>=',
    '<',
    '<=',
    'in',
    'not in',
    'is',
    'is not',
    'like',
    'not like',
    'match',
    'ilike',
    'not ilike',
    '@>',
    '<@',
    '^@',
    '&&',
    '?',
    '?&',
    '?|',
    '!<',
    '!>',
    '<=>',
    '!~',
    '~',
    '~*',
    '!~*',
    '@@',
    '@@@',
    '!!',
    '<->',
    'regexp',
    'is distinct from',
    'is not distinct from',
];
export const ARITHMETIC_OPERATORS = [
    '+',
    '-',
    '*',
    '/',
    '%',
    '^',
    '&',
    '|',
    '#',
    '<<',
    '>>',
];
export const JSON_OPERATORS = ['->', '->>'];
export const BINARY_OPERATORS = [
    ...COMPARISON_OPERATORS,
    ...ARITHMETIC_OPERATORS,
    '&&',
    '||',
];
export const UNARY_FILTER_OPERATORS = ['exists', 'not exists'];
export const UNARY_OPERATORS = ['not', '-', ...UNARY_FILTER_OPERATORS];
export const OPERATORS = [
    ...BINARY_OPERATORS,
    ...JSON_OPERATORS,
    ...UNARY_OPERATORS,
    'between',
    'between symmetric',
];
/**
 * @internal
 */
export const OperatorNode = freeze({
    is(node) {
        return node.kind === 'OperatorNode';
    },
    create(operator) {
        return freeze({
            kind: 'OperatorNode',
            operator,
        });
    },
});
export function isOperator(op) {
    return isString(op) && OPERATORS.includes(op);
}
export function isBinaryOperator(op) {
    return isString(op) && BINARY_OPERATORS.includes(op);
}
export function isComparisonOperator(op) {
    return isString(op) && COMPARISON_OPERATORS.includes(op);
}
export function isArithmeticOperator(op) {
    return isString(op) && ARITHMETIC_OPERATORS.includes(op);
}
export function isJSONOperator(op) {
    return isString(op) && JSON_OPERATORS.includes(op);
}
