import resolveToModule from './resolveToModule.js';
import isReactBuiltinCall from './isReactBuiltinCall.js';
/**
 * Returns true if the expression is a function call of the form
 * ```
 * import createReactClass from 'create-react-class';
 * createReactClass(...);
 * ```
 */
function isReactCreateClassCallModular(path) {
    if (!path.isCallExpression()) {
        return false;
    }
    const module = resolveToModule(path);
    return Boolean(module && module === 'create-react-class');
}
/**
 * Returns true if the expression is a function call of the form
 * `React.createClass(...)` or
 * ```
 * import createReactClass from 'create-react-class';
 * createReactClass(...);
 * ```
 */
export default function isReactCreateClassCall(path) {
    return ((isReactBuiltinCall(path, 'createClass') &&
        path.get('arguments').length === 1) ||
        isReactCreateClassCallModular(path));
}
