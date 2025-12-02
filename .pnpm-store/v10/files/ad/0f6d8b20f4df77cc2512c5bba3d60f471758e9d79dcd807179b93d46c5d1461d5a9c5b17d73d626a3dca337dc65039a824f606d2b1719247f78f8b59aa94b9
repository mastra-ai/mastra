import getPropertyValuePath from './getPropertyValuePath.js';
import resolveToValue from './resolveToValue.js';
function resolveToObjectExpression(path) {
    if (path.isVariableDeclarator()) {
        const init = path.get('init');
        if (init.hasNode()) {
            return resolveToValue(init);
        }
    }
    else if (path.isAssignmentExpression()) {
        if (path.node.operator === '=') {
            return resolveToValue(path.get('right'));
        }
    }
    return null;
}
/**
 * Resolve and ObjectProperty inside an ObjectPattern to its value if possible
 * If not found `null` is returned
 */
export default function resolveObjectPatternPropertyToValue(path) {
    if (!path.parentPath.isObjectPattern()) {
        return null;
    }
    const resolved = resolveToObjectExpression(path.parentPath.parentPath);
    if (resolved && resolved.isObjectExpression()) {
        const propertyPath = getPropertyValuePath(resolved, 
        // Always id in ObjectPattern
        path.get('key').node.name);
        if (propertyPath) {
            return resolveToValue(propertyPath);
        }
    }
    return null;
}
