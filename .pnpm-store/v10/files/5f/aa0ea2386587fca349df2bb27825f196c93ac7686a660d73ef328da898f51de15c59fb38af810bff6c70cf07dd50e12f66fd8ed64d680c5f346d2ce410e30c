import getPropertyName from './getPropertyName.js';
import printValue from './printValue.js';
import getTypeAnnotation from '../utils/getTypeAnnotation.js';
import resolveToValue from '../utils/resolveToValue.js';
import { resolveObjectToNameArray } from '../utils/resolveObjectKeysToArray.js';
import getTypeParameters from '../utils/getTypeParameters.js';
import { getDocblock } from './docblock.js';
const tsTypes = {
    TSAnyKeyword: 'any',
    TSBooleanKeyword: 'boolean',
    TSUnknownKeyword: 'unknown',
    TSNeverKeyword: 'never',
    TSNullKeyword: 'null',
    TSUndefinedKeyword: 'undefined',
    TSNumberKeyword: 'number',
    TSStringKeyword: 'string',
    TSSymbolKeyword: 'symbol',
    TSThisType: 'this',
    TSObjectKeyword: 'object',
    TSVoidKeyword: 'void',
};
const namedTypes = {
    TSArrayType: handleTSArrayType,
    TSTypeReference: handleTSTypeReference,
    TSTypeLiteral: handleTSTypeLiteral,
    TSInterfaceDeclaration: handleTSInterfaceDeclaration,
    TSUnionType: handleTSUnionType,
    TSFunctionType: handleTSFunctionType,
    TSIntersectionType: handleTSIntersectionType,
    TSMappedType: handleTSMappedType,
    TSTupleType: handleTSTupleType,
    TSTypeQuery: handleTSTypeQuery,
    TSTypeOperator: handleTSTypeOperator,
    TSIndexedAccessType: handleTSIndexedAccessType,
    TSLiteralType: handleTSLiteralType,
};
function handleTSQualifiedName(path) {
    const left = path.get('left');
    const right = path.get('right');
    if (left.isIdentifier({ name: 'React' }) && right.isIdentifier()) {
        return {
            name: `${left.node.name}${right.node.name}`,
            raw: printValue(path),
        };
    }
    return { name: printValue(path).replace(/<.*>$/, '') };
}
function handleTSLiteralType(path) {
    const literal = path.get('literal');
    return {
        name: 'literal',
        value: printValue(literal),
    };
}
function handleTSArrayType(path, typeParams) {
    return {
        name: 'Array',
        elements: [getTSTypeWithResolvedTypes(path.get('elementType'), typeParams)],
        raw: printValue(path),
    };
}
function handleTSTypeReference(path, typeParams) {
    let type;
    const typeName = path.get('typeName');
    if (typeName.isTSQualifiedName()) {
        type = handleTSQualifiedName(typeName);
    }
    else {
        type = { name: typeName.node.name };
    }
    const resolvedPath = (typeParams && typeParams[type.name]) ||
        resolveToValue(path.get('typeName'));
    const typeParameters = path.get('typeParameters');
    const resolvedTypeParameters = resolvedPath.get('typeParameters');
    if (typeParameters.hasNode() && resolvedTypeParameters.hasNode()) {
        typeParams = getTypeParameters(resolvedTypeParameters, typeParameters, typeParams);
    }
    if (typeParams && typeParams[type.name]) {
        // Open question: Why is this `null` instead of `typeParams`
        type = getTSTypeWithResolvedTypes(resolvedPath, null);
    }
    const resolvedTypeAnnotation = resolvedPath.get('typeAnnotation');
    if (resolvedTypeAnnotation.hasNode()) {
        type = getTSTypeWithResolvedTypes(resolvedTypeAnnotation, typeParams);
    }
    else if (typeParameters.hasNode()) {
        const params = typeParameters.get('params');
        type = {
            ...type,
            elements: params.map((param) => getTSTypeWithResolvedTypes(param, typeParams)),
            raw: printValue(path),
        };
    }
    return type;
}
function getTSTypeWithRequirements(path, typeParams) {
    const type = getTSTypeWithResolvedTypes(path, typeParams);
    type.required =
        !('optional' in path.parentPath.node) || !path.parentPath.node.optional;
    return type;
}
function handleTSTypeLiteral(path, typeParams) {
    const type = {
        name: 'signature',
        type: 'object',
        raw: printValue(path),
        signature: { properties: [] },
    };
    path.get('members').forEach((param) => {
        const typeAnnotation = param.get('typeAnnotation');
        if ((param.isTSPropertySignature() || param.isTSMethodSignature()) &&
            typeAnnotation.hasNode()) {
            const propName = getPropertyName(param);
            if (!propName) {
                return;
            }
            const docblock = getDocblock(param);
            let doc = {};
            if (docblock) {
                doc = { description: docblock };
            }
            type.signature.properties.push({
                key: propName,
                value: getTSTypeWithRequirements(typeAnnotation, typeParams),
                ...doc,
            });
        }
        else if (param.isTSCallSignatureDeclaration()) {
            type.signature.constructor = handleTSFunctionType(param, typeParams);
        }
        else if (param.isTSIndexSignature() && typeAnnotation.hasNode()) {
            const parameters = param.get('parameters');
            if (parameters[0]) {
                const idTypeAnnotation = parameters[0].get('typeAnnotation');
                if (idTypeAnnotation.hasNode()) {
                    type.signature.properties.push({
                        key: getTSTypeWithResolvedTypes(idTypeAnnotation, typeParams),
                        value: getTSTypeWithRequirements(typeAnnotation, typeParams),
                    });
                }
            }
        }
    });
    return type;
}
function handleTSInterfaceDeclaration(path) {
    // Interfaces are handled like references which would be documented separately,
    // rather than inlined like type aliases.
    return {
        name: path.node.id.name,
    };
}
function handleTSUnionType(path, typeParams) {
    return {
        name: 'union',
        raw: printValue(path),
        elements: path
            .get('types')
            .map((subType) => getTSTypeWithResolvedTypes(subType, typeParams)),
    };
}
function handleTSIntersectionType(path, typeParams) {
    return {
        name: 'intersection',
        raw: printValue(path),
        elements: path
            .get('types')
            .map((subType) => getTSTypeWithResolvedTypes(subType, typeParams)),
    };
}
// type OptionsFlags<Type> = { [Property in keyof Type]; };
function handleTSMappedType(path, typeParams) {
    const key = getTSTypeWithResolvedTypes(path.get('typeParameter').get('constraint'), typeParams);
    key.required = !path.node.optional;
    const typeAnnotation = path.get('typeAnnotation');
    let value;
    if (typeAnnotation.hasNode()) {
        value = getTSTypeWithResolvedTypes(typeAnnotation, typeParams);
    }
    else {
        value = { name: 'any' };
    }
    return {
        name: 'signature',
        type: 'object',
        raw: printValue(path),
        signature: {
            properties: [
                {
                    key,
                    value,
                },
            ],
        },
    };
}
function handleTSFunctionType(path, typeParams) {
    let returnType;
    const annotation = path.get('typeAnnotation');
    if (annotation.hasNode()) {
        returnType = getTSTypeWithResolvedTypes(annotation, typeParams);
    }
    const type = {
        name: 'signature',
        type: 'function',
        raw: printValue(path),
        signature: {
            arguments: [],
            return: returnType,
        },
    };
    path.get('parameters').forEach((param) => {
        const typeAnnotation = getTypeAnnotation(param);
        const arg = {
            type: typeAnnotation
                ? getTSTypeWithResolvedTypes(typeAnnotation, typeParams)
                : undefined,
            name: '',
        };
        if (param.isIdentifier()) {
            arg.name = param.node.name;
            if (param.node.name === 'this') {
                type.signature.this = arg.type;
                return;
            }
        }
        else if (param.isRestElement()) {
            const restArgument = param.get('argument');
            if (restArgument.isIdentifier()) {
                arg.name = restArgument.node.name;
            }
            else {
                arg.name = printValue(restArgument);
            }
            arg.rest = true;
        }
        type.signature.arguments.push(arg);
    });
    return type;
}
function handleTSTupleType(path, typeParams) {
    const type = {
        name: 'tuple',
        raw: printValue(path),
        elements: [],
    };
    path.get('elementTypes').forEach((param) => {
        type.elements.push(getTSTypeWithResolvedTypes(param, typeParams));
    });
    return type;
}
function handleTSTypeQuery(path, typeParams) {
    const exprName = path.get('exprName');
    if (exprName.isIdentifier()) {
        const resolvedPath = resolveToValue(path.get('exprName'));
        if (resolvedPath.has('typeAnnotation')) {
            return getTSTypeWithResolvedTypes(resolvedPath.get('typeAnnotation'), typeParams);
        }
        return { name: exprName.node.name };
    }
    else if (exprName.isTSQualifiedName()) {
        return handleTSQualifiedName(exprName);
    }
    else {
        // TSImportType
        return { name: printValue(exprName) };
    }
}
function handleTSTypeOperator(path, typeParams) {
    if (path.node.operator !== 'keyof') {
        return null;
    }
    let value = path.get('typeAnnotation');
    if (value.isTSTypeQuery()) {
        value = value.get('exprName');
    }
    else if ('id' in value.node) {
        value = value.get('id');
    }
    else if (value.isTSTypeReference()) {
        return getTSTypeWithResolvedTypes(value, typeParams);
    }
    const resolvedPath = resolveToValue(value);
    if (resolvedPath.isObjectExpression() || resolvedPath.isTSTypeLiteral()) {
        const keys = resolveObjectToNameArray(resolvedPath, true);
        if (keys) {
            return {
                name: 'union',
                raw: printValue(path),
                elements: keys.map((key) => ({ name: 'literal', value: key })),
            };
        }
    }
    return null;
}
function handleTSIndexedAccessType(path, typeParams) {
    const objectType = getTSTypeWithResolvedTypes(path.get('objectType'), typeParams);
    const indexType = getTSTypeWithResolvedTypes(path.get('indexType'), typeParams);
    // We only get the signature if the objectType is a type (vs interface)
    if (!objectType.signature) {
        return {
            name: `${objectType.name}[${indexType.value ? indexType.value.toString() : indexType.name}]`,
            raw: printValue(path),
        };
    }
    const resolvedType = objectType.signature.properties.find((p) => {
        // indexType.value = "'foo'"
        return indexType.value && p.key === indexType.value.replace(/['"]+/g, '');
    });
    if (!resolvedType) {
        return { name: 'unknown' };
    }
    return {
        name: resolvedType.value.name,
        raw: printValue(path),
    };
}
let visitedTypes = {};
function getTSTypeWithResolvedTypes(path, typeParams) {
    if (path.isTSTypeAnnotation()) {
        path = path.get('typeAnnotation');
    }
    const node = path.node;
    let type = null;
    let typeAliasName = null;
    if (path.parentPath.isTSTypeAliasDeclaration()) {
        typeAliasName = path.parentPath.node.id.name;
    }
    // When we see a typealias mark it as visited so that the next
    // call of this function does not run into an endless loop
    if (typeAliasName) {
        if (visitedTypes[typeAliasName] === true) {
            // if we are currently visiting this node then just return the name
            // as we are starting to endless loop
            return { name: typeAliasName };
        }
        else if (typeof visitedTypes[typeAliasName] === 'object') {
            // if we already resolved the type simple return it
            return visitedTypes[typeAliasName];
        }
        // mark the type as visited
        visitedTypes[typeAliasName] = true;
    }
    if (node.type in tsTypes) {
        type = { name: tsTypes[node.type] };
    }
    else if (node.type in namedTypes) {
        type = namedTypes[node.type](path, typeParams);
    }
    if (!type) {
        type = { name: 'unknown' };
    }
    if (typeAliasName) {
        // mark the type as unvisited so that further calls can resolve the type again
        visitedTypes[typeAliasName] = type;
    }
    return type;
}
/**
 * Tries to identify the typescript type by inspecting the path for known
 * typescript type names. This method doesn't check whether the found type is actually
 * existing. It simply assumes that a match is always valid.
 *
 * If there is no match, "unknown" is returned.
 */
export default function getTSType(path, typeParamMap = null) {
    // Empty visited types before an after run
    // Before: in case the detection threw and we rerun again
    // After: cleanup memory after we are done here
    visitedTypes = {};
    const type = getTSTypeWithResolvedTypes(path, typeParamMap);
    visitedTypes = {};
    return type;
}
