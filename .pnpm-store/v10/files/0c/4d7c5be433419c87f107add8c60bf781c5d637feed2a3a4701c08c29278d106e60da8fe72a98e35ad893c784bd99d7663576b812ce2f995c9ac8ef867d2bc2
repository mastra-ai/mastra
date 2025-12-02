import isReactCreateClassCall from './isReactCreateClassCall.js';
import isReactForwardRefCall from './isReactForwardRefCall.js';
import resolveToValue from './resolveToValue.js';
/**
 * If the path is a call expression, it recursively resolves to the
 * rightmost argument, stopping if it finds a React.createClass call expression
 *
 * Else the path itself is returned.
 */
export default function resolveHOC(path) {
    if (path.isCallExpression() &&
        !isReactCreateClassCall(path) &&
        !isReactForwardRefCall(path)) {
        const node = path.node;
        const argumentLength = node.arguments.length;
        if (argumentLength && argumentLength > 0) {
            const args = path.get('arguments');
            const firstArg = args[0];
            // If the first argument is one of these types then the component might be the last argument
            // If there are all identifiers then we cannot figure out exactly and have to assume it is the first
            if (argumentLength > 1 &&
                (firstArg.isLiteral() ||
                    firstArg.isObjectExpression() ||
                    firstArg.isArrayExpression() ||
                    firstArg.isSpreadElement())) {
                return resolveHOC(resolveToValue(args[argumentLength - 1]));
            }
            return resolveHOC(resolveToValue(firstArg));
        }
    }
    return path;
}
