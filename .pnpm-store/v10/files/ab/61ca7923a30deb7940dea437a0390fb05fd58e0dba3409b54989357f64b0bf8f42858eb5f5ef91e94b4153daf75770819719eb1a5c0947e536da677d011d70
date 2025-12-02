import { getDocblock } from './docblock.js';
import getFlowType from './getFlowType.js';
import getTSType from './getTSType.js';
import getParameterName from './getParameterName.js';
import getPropertyName from './getPropertyName.js';
import getTypeAnnotation from './getTypeAnnotation.js';
import resolveToValue from './resolveToValue.js';
import printValue from './printValue.js';
function getMethodFunctionExpression(methodPath) {
    if (methodPath.isClassMethod() || methodPath.isObjectMethod()) {
        return methodPath;
    }
    const potentialFunctionExpression = methodPath.isAssignmentExpression()
        ? methodPath.get('right')
        : methodPath.get('value');
    const functionExpression = resolveToValue(potentialFunctionExpression);
    if (functionExpression.isFunction()) {
        return functionExpression;
    }
    return null;
}
function getMethodParamOptional(path) {
    let identifier = path;
    if (identifier.isTSParameterProperty()) {
        identifier = identifier.get('parameter');
    }
    if (identifier.isAssignmentPattern()) {
        // A default value always makes the param optional
        return true;
    }
    return identifier.isIdentifier() ? Boolean(identifier.node.optional) : false;
}
function getMethodParamsDoc(methodPath) {
    const params = [];
    const functionExpression = getMethodFunctionExpression(methodPath);
    if (functionExpression) {
        // Extract param types.
        functionExpression.get('params').forEach((paramPath) => {
            let type = null;
            const typePath = getTypeAnnotation(paramPath);
            if (typePath) {
                if (typePath.isFlowType()) {
                    type = getFlowType(typePath, null);
                    if (typePath.isGenericTypeAnnotation()) {
                        type.alias = printValue(typePath.get('id'));
                    }
                }
                else if (typePath.isTSType()) {
                    type = getTSType(typePath, null);
                    if (typePath.isTSTypeReference()) {
                        type.alias = printValue(typePath.get('typeName'));
                    }
                }
            }
            const param = {
                name: getParameterName(paramPath),
                optional: getMethodParamOptional(paramPath),
                type,
            };
            params.push(param);
        });
    }
    return params;
}
// Extract flow return type.
function getMethodReturnDoc(methodPath) {
    const functionExpression = getMethodFunctionExpression(methodPath);
    if (functionExpression && functionExpression.node.returnType) {
        const returnType = getTypeAnnotation(functionExpression.get('returnType'));
        if (!returnType) {
            return null;
        }
        if (returnType.isFlowType()) {
            return { type: getFlowType(returnType, null) };
        }
        else if (returnType.isTSType()) {
            return { type: getTSType(returnType, null) };
        }
    }
    return null;
}
function getMethodModifiers(methodPath, options) {
    if (methodPath.isAssignmentExpression()) {
        return ['static'];
    }
    // Otherwise this is a method/property node
    const modifiers = [];
    if (options.isStatic === true ||
        ((methodPath.isClassProperty() || methodPath.isClassMethod()) &&
            methodPath.node.static)) {
        modifiers.push('static');
    }
    const functionExpression = getMethodFunctionExpression(methodPath);
    if (functionExpression) {
        if (functionExpression.isClassMethod() ||
            functionExpression.isObjectMethod()) {
            if (functionExpression.node.kind === 'get' ||
                functionExpression.node.kind === 'set') {
                modifiers.push(functionExpression.node.kind);
            }
        }
        if (functionExpression.node.generator) {
            modifiers.push('generator');
        }
        if (functionExpression.node.async) {
            modifiers.push('async');
        }
    }
    return modifiers;
}
function getMethodName(methodPath) {
    if (methodPath.isAssignmentExpression()) {
        const left = methodPath.get('left');
        if (left.isMemberExpression()) {
            const property = left.get('property');
            if (!left.node.computed && property.isIdentifier()) {
                return property.node.name;
            }
            if (property.isStringLiteral() || property.isNumericLiteral()) {
                return String(property.node.value);
            }
        }
        return null;
    }
    return getPropertyName(methodPath);
}
function getMethodAccessibility(methodPath) {
    if (methodPath.isClassMethod() || methodPath.isClassProperty()) {
        return methodPath.node.accessibility || null;
    }
    // Otherwise this is a object method/property or assignment expression
    return null;
}
function getMethodDocblock(methodPath) {
    if (methodPath.isAssignmentExpression()) {
        let path = methodPath;
        do {
            path = path.parentPath;
        } while (path && !path.isExpressionStatement());
        if (path) {
            return getDocblock(path);
        }
        return null;
    }
    // Otherwise this is a method/property node
    return getDocblock(methodPath);
}
// Gets the documentation object for a component method.
// Component methods may be represented as class/object method/property nodes
// or as assignment expression of the form `Component.foo = function() {}`
export default function getMethodDocumentation(methodPath, options = {}) {
    if (getMethodAccessibility(methodPath) === 'private' ||
        methodPath.isClassPrivateMethod()) {
        return null;
    }
    const name = getMethodName(methodPath);
    if (!name)
        return null;
    return {
        name,
        docblock: getMethodDocblock(methodPath),
        modifiers: getMethodModifiers(methodPath, options),
        params: getMethodParamsDoc(methodPath),
        returns: getMethodReturnDoc(methodPath),
    };
}
