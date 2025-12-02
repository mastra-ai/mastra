import getMemberValuePath from './getMemberValuePath.js';
import getTypeAnnotation from './getTypeAnnotation.js';
import getTypeParameters from './getTypeParameters.js';
import isReactComponentClass from './isReactComponentClass.js';
import isReactForwardRefCall from './isReactForwardRefCall.js';
import resolveGenericTypeAnnotation from './resolveGenericTypeAnnotation.js';
import resolveToValue from './resolveToValue.js';
import getTypeIdentifier from './getTypeIdentifier.js';
import isReactBuiltinReference from './isReactBuiltinReference.js';
import unwrapBuiltinTSPropTypes from './unwrapBuiltinTSPropTypes.js';
function getStatelessPropsPath(componentDefinition) {
    if (!componentDefinition.isFunction())
        return;
    return componentDefinition.get('params')[0];
}
function getForwardRefGenericsType(componentDefinition) {
    const typeParameters = componentDefinition.get('typeParameters');
    if (typeParameters && typeParameters.hasNode()) {
        const params = typeParameters.get('params');
        return params[1] ?? null;
    }
    return null;
}
function findAssignedVariableType(componentDefinition) {
    const variableDeclarator = componentDefinition.findParent((path) => path.isVariableDeclarator());
    if (!variableDeclarator)
        return null;
    const typeAnnotation = getTypeAnnotation(variableDeclarator.get('id'));
    if (!typeAnnotation)
        return null;
    if (typeAnnotation.isTSTypeReference()) {
        const typeName = typeAnnotation.get('typeName');
        if (isReactBuiltinReference(typeName, 'FunctionComponent') ||
            isReactBuiltinReference(typeName, 'FC') ||
            isReactBuiltinReference(typeName, 'VoidFunctionComponent') ||
            isReactBuiltinReference(typeName, 'VFC')) {
            const typeParameters = typeAnnotation.get('typeParameters');
            if (typeParameters.hasNode()) {
                return typeParameters.get('params')[0] ?? null;
            }
        }
    }
    return null;
}
/**
 * Given an React component (stateless or class) tries to find
 * flow or TS types for the props. It may find multiple types.
 * If not found or it is not one of the supported component types,
 *  this function returns an empty array.
 */
export default (componentDefinition) => {
    const typePaths = [];
    if (isReactComponentClass(componentDefinition)) {
        const superTypes = componentDefinition.get('superTypeParameters');
        if (superTypes.hasNode()) {
            const params = superTypes.get('params');
            if (params.length >= 1) {
                typePaths.push(params[params.length === 3 ? 1 : 0]);
            }
        }
        else {
            const propsMemberPath = getMemberValuePath(componentDefinition, 'props');
            if (!propsMemberPath) {
                return [];
            }
            const typeAnnotation = getTypeAnnotation(propsMemberPath.parentPath);
            if (typeAnnotation) {
                typePaths.push(typeAnnotation);
            }
        }
    }
    else {
        if (isReactForwardRefCall(componentDefinition)) {
            const genericTypeAnnotation = getForwardRefGenericsType(componentDefinition);
            if (genericTypeAnnotation) {
                typePaths.push(genericTypeAnnotation);
            }
            componentDefinition = resolveToValue(componentDefinition.get('arguments')[0]);
        }
        const propsParam = getStatelessPropsPath(componentDefinition);
        if (propsParam) {
            const typeAnnotation = getTypeAnnotation(propsParam);
            if (typeAnnotation) {
                typePaths.push(typeAnnotation);
            }
        }
        const assignedVariableType = findAssignedVariableType(componentDefinition);
        if (assignedVariableType) {
            typePaths.push(assignedVariableType);
        }
    }
    return typePaths.map((typePath) => unwrapBuiltinTSPropTypes(typePath));
};
export function applyToTypeProperties(documentation, path, callback, typeParams) {
    if (path.isObjectTypeAnnotation()) {
        path
            .get('properties')
            .forEach((propertyPath) => callback(propertyPath, typeParams));
    }
    else if (path.isTSTypeLiteral()) {
        path
            .get('members')
            .forEach((propertyPath) => callback(propertyPath, typeParams));
    }
    else if (path.isInterfaceDeclaration()) {
        applyExtends(documentation, path, callback, typeParams);
        path
            .get('body')
            .get('properties')
            .forEach((propertyPath) => callback(propertyPath, typeParams));
    }
    else if (path.isTSInterfaceDeclaration()) {
        applyExtends(documentation, path, callback, typeParams);
        path
            .get('body')
            .get('body')
            .forEach((propertyPath) => callback(propertyPath, typeParams));
    }
    else if (path.isIntersectionTypeAnnotation() ||
        path.isTSIntersectionType()) {
        path.get('types').forEach((typesPath) => applyToTypeProperties(documentation, typesPath, callback, typeParams));
    }
    else if (!path.isUnionTypeAnnotation()) {
        // The react-docgen output format does not currently allow
        // for the expression of union types
        const typePath = resolveGenericTypeAnnotation(path);
        if (typePath) {
            applyToTypeProperties(documentation, typePath, callback, typeParams);
        }
    }
}
function applyExtends(documentation, path, callback, typeParams) {
    const classExtends = path.get('extends');
    if (!Array.isArray(classExtends)) {
        return;
    }
    classExtends.forEach((extendsPath) => {
        const resolvedPath = resolveGenericTypeAnnotation(extendsPath);
        if (resolvedPath) {
            if (resolvedPath.has('typeParameters') &&
                extendsPath.node.typeParameters) {
                typeParams = getTypeParameters(resolvedPath.get('typeParameters'), extendsPath.get('typeParameters'), typeParams);
            }
            applyToTypeProperties(documentation, resolvedPath, callback, typeParams);
        }
        else {
            const idPath = getTypeIdentifier(extendsPath);
            if (idPath && idPath.isIdentifier()) {
                documentation.addComposes(idPath.node.name);
            }
        }
    });
}
