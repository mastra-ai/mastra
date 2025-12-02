import * as expressionTo from './expressionTo.js';
/**
 * Returns true if the expression is of form `exports.foo = ...;` or
 * `modules.exports = ...;`.
 */
export default function isExportsOrModuleAssignment(path) {
    if (!path.isAssignmentExpression() ||
        !path.get('left').isMemberExpression()) {
        return false;
    }
    const exprArr = expressionTo.Array(path.get('left'));
    return ((exprArr[0] === 'module' && exprArr[1] === 'exports') ||
        exprArr[0] === 'exports');
}
