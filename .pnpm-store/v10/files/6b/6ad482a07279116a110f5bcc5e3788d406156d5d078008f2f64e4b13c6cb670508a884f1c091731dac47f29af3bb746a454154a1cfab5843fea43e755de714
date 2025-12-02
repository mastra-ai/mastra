import isReactBuiltinCall from './isReactBuiltinCall.js';
/**
 * Returns true if the expression is a function call of the form
 * `React.createElement(...)`.
 */
export default function isReactCreateElementCall(path) {
    return isReactBuiltinCall(path, 'createElement');
}
