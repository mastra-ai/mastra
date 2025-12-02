import isReactCreateElementCall from './isReactCreateElementCall.js';
import isReactCloneElementCall from './isReactCloneElementCall.js';
import isReactChildrenElementCall from './isReactChildrenElementCall.js';
import findFunctionReturn from './findFunctionReturn.js';
const validPossibleStatelessComponentTypes = [
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
    'ObjectMethod',
];
function isJSXElementOrReactCall(path) {
    return (path.isJSXElement() ||
        path.isJSXFragment() ||
        (path.isCallExpression() &&
            (isReactCreateElementCall(path) ||
                isReactCloneElementCall(path) ||
                isReactChildrenElementCall(path))));
}
/**
 * Returns `true` if the path represents a function which returns a JSXElement
 */
export default function isStatelessComponent(path) {
    if (!path.inType(...validPossibleStatelessComponentTypes)) {
        return false;
    }
    const foundPath = findFunctionReturn(path, isJSXElementOrReactCall);
    return Boolean(foundPath);
}
