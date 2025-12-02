"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorNode = exports.OPERATORS = exports.UNARY_OPERATORS = exports.UNARY_FILTER_OPERATORS = exports.BINARY_OPERATORS = exports.JSON_OPERATORS = exports.ARITHMETIC_OPERATORS = exports.COMPARISON_OPERATORS = void 0;
exports.isOperator = isOperator;
exports.isBinaryOperator = isBinaryOperator;
exports.isComparisonOperator = isComparisonOperator;
exports.isArithmeticOperator = isArithmeticOperator;
exports.isJSONOperator = isJSONOperator;
const object_utils_js_1 = require("../util/object-utils.js");
exports.COMPARISON_OPERATORS = [
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
exports.ARITHMETIC_OPERATORS = [
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
exports.JSON_OPERATORS = ['->', '->>'];
exports.BINARY_OPERATORS = [
    ...exports.COMPARISON_OPERATORS,
    ...exports.ARITHMETIC_OPERATORS,
    '&&',
    '||',
];
exports.UNARY_FILTER_OPERATORS = ['exists', 'not exists'];
exports.UNARY_OPERATORS = ['not', '-', ...exports.UNARY_FILTER_OPERATORS];
exports.OPERATORS = [
    ...exports.BINARY_OPERATORS,
    ...exports.JSON_OPERATORS,
    ...exports.UNARY_OPERATORS,
    'between',
    'between symmetric',
];
/**
 * @internal
 */
exports.OperatorNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OperatorNode';
    },
    create(operator) {
        return (0, object_utils_js_1.freeze)({
            kind: 'OperatorNode',
            operator,
        });
    },
});
function isOperator(op) {
    return (0, object_utils_js_1.isString)(op) && exports.OPERATORS.includes(op);
}
function isBinaryOperator(op) {
    return (0, object_utils_js_1.isString)(op) && exports.BINARY_OPERATORS.includes(op);
}
function isComparisonOperator(op) {
    return (0, object_utils_js_1.isString)(op) && exports.COMPARISON_OPERATORS.includes(op);
}
function isArithmeticOperator(op) {
    return (0, object_utils_js_1.isString)(op) && exports.ARITHMETIC_OPERATORS.includes(op);
}
function isJSONOperator(op) {
    return (0, object_utils_js_1.isString)(op) && exports.JSON_OPERATORS.includes(op);
}
