import isReactBuiltinCall from './isReactBuiltinCall.js';
/**
 * Returns true if the expression is a function call of the form
 * `React.forwardRef(...)`.
 */
export default function isReactForwardRefCall(path) {
    return (isReactBuiltinCall(path, 'forwardRef') &&
        path.get('arguments').length === 1);
}
