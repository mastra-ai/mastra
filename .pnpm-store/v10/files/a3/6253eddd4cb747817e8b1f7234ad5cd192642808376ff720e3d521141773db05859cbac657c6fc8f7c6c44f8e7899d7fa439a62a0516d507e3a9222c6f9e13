import getMemberExpressionRoot from './getMemberExpressionRoot.js';
import resolveToValue from './resolveToValue.js';
/**
 * Given a path (e.g. call expression, member expression or identifier),
 * this function tries to find the name of module from which the "root value"
 * was imported.
 */
export default function resolveToModule(path) {
    if (path.isVariableDeclarator()) {
        if (path.node.init) {
            return resolveToModule(path.get('init'));
        }
    }
    else if (path.isCallExpression()) {
        const callee = path.get('callee');
        if (callee.isIdentifier({ name: 'require' })) {
            return path.node.arguments[0].value;
        }
        return resolveToModule(callee);
    }
    else if (path.isIdentifier() || path.isJSXIdentifier()) {
        const valuePath = resolveToValue(path);
        if (valuePath !== path) {
            return resolveToModule(valuePath);
        }
        if (path.parentPath.isObjectProperty()) {
            return resolveToModule(path.parentPath);
        }
    }
    else if (path.isObjectProperty() || path.isObjectPattern()) {
        return resolveToModule(path.parentPath);
    }
    else if (path.parentPath?.isImportDeclaration()) {
        return path.parentPath.node.source.value;
    }
    else if (path.isMemberExpression()) {
        path = getMemberExpressionRoot(path);
        return resolveToModule(path);
    }
    return null;
}
