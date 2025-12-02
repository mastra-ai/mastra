import isReactBuiltinReference from './isReactBuiltinReference.js';
/**
 * Returns true if the expression is a function call of the form
 * `React.foo(...)`.
 */
export default function isReactBuiltinCall(path, name) {
    if (!path.isCallExpression()) {
        return false;
    }
    const callee = path.get('callee');
    return isReactBuiltinReference(callee, name);
}
