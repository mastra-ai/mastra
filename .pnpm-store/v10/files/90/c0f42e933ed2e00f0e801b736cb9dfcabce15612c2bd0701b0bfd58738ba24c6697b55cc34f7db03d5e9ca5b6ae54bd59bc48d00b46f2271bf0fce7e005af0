import { getDocblock } from '../utils/docblock.js';
import getMembers from './getMembers.js';
import getPropertyName from './getPropertyName.js';
import isRequiredPropType from '../utils/isRequiredPropType.js';
import printValue from './printValue.js';
import resolveToValue from './resolveToValue.js';
import resolveObjectKeysToArray from './resolveObjectKeysToArray.js';
import resolveObjectValuesToArray from './resolveObjectValuesToArray.js';
function getEnumValuesFromArrayExpression(path) {
    const values = [];
    path.get('elements').forEach((elementPath) => {
        if (!elementPath.hasNode())
            return;
        if (elementPath.isSpreadElement()) {
            const value = resolveToValue(elementPath.get('argument'));
            if (value.isArrayExpression()) {
                // if the SpreadElement resolved to an Array, add all their elements too
                return values.push(...getEnumValuesFromArrayExpression(value));
            }
            else {
                // otherwise we'll just print the SpreadElement itself
                return values.push({
                    value: printValue(elementPath),
                    computed: !elementPath.isLiteral(),
                });
            }
        }
        // try to resolve the array element to it's value
        const value = resolveToValue(elementPath);
        return values.push({
            value: printValue(value.parentPath?.isImportDeclaration() ? elementPath : value),
            computed: !value.isLiteral(),
        });
    });
    return values;
}
function getPropTypeOneOf(type, argumentPath) {
    const value = resolveToValue(argumentPath);
    if (value.isArrayExpression()) {
        type.value = getEnumValuesFromArrayExpression(value);
    }
    else {
        const objectValues = resolveObjectKeysToArray(value) || resolveObjectValuesToArray(value);
        if (objectValues) {
            type.value = objectValues.map((objectValue) => ({
                value: objectValue,
                computed: false,
            }));
        }
        else {
            // could not easily resolve to an Array, let's print the original value
            type.computed = true;
            type.value = printValue(argumentPath);
        }
    }
    return type;
}
function getPropTypeOneOfType(type, argumentPath) {
    if (argumentPath.isArrayExpression()) {
        type.value = argumentPath.get('elements').map((elementPath) => {
            if (!elementPath.hasNode())
                return;
            const descriptor = getPropType(elementPath);
            const docs = getDocblock(elementPath);
            if (docs) {
                descriptor.description = docs;
            }
            return descriptor;
        });
    }
    return type;
}
function getPropTypeArrayOf(type, argumentPath) {
    const docs = getDocblock(argumentPath);
    if (docs) {
        type.description = docs;
    }
    const subType = getPropType(argumentPath);
    type.value = subType;
    return type;
}
function getPropTypeObjectOf(type, argumentPath) {
    const docs = getDocblock(argumentPath);
    if (docs) {
        type.description = docs;
    }
    const subType = getPropType(argumentPath);
    type.value = subType;
    return type;
}
function getFirstArgument(path) {
    let argument;
    if (path.isCallExpression()) {
        argument = path.get('arguments')[0];
    }
    else {
        const members = getMembers(path, true);
        if (members[0] && members[0].argumentPaths[0]) {
            argument = members[0].argumentPaths[0];
        }
    }
    return argument;
}
function isCyclicReference(argument, argumentPath) {
    return Boolean(argument && resolveToValue(argument) === argumentPath);
}
/**
 * Handles shape and exact prop types
 */
function getPropTypeShapish(type, argumentPath) {
    if (!argumentPath.isObjectExpression()) {
        argumentPath = resolveToValue(argumentPath);
    }
    if (argumentPath.isObjectExpression()) {
        const value = {};
        let rawValue;
        argumentPath.get('properties').forEach((propertyPath) => {
            // We only handle ObjectProperty as there is nothing to handle for
            // SpreadElements and ObjectMethods
            if (propertyPath.isObjectProperty()) {
                const propertyName = getPropertyName(propertyPath);
                if (!propertyName)
                    return;
                const valuePath = propertyPath.get('value');
                const argument = getFirstArgument(valuePath);
                // This indicates we have a cyclic reference in the shape
                // In this case we simply print the argument to shape and bail
                if (argument && isCyclicReference(argument, argumentPath)) {
                    rawValue = printValue(argument);
                    return;
                }
                const descriptor = getPropType(valuePath);
                const docs = getDocblock(propertyPath);
                if (docs) {
                    descriptor.description = docs;
                }
                descriptor.required = isRequiredPropType(valuePath);
                value[propertyName] = descriptor;
            }
        });
        type.value = rawValue ?? value;
    }
    return type;
}
function getPropTypeInstanceOf(_type, argumentPath) {
    return {
        name: 'instanceOf',
        value: printValue(argumentPath),
    };
}
const simplePropTypes = [
    'array',
    'bool',
    'func',
    'number',
    'object',
    'string',
    'any',
    'element',
    'node',
    'symbol',
    'elementType',
];
function isSimplePropType(name) {
    return simplePropTypes.includes(name);
}
const propTypes = new Map([
    ['oneOf', callPropTypeHandler.bind(null, 'enum', getPropTypeOneOf)],
    ['oneOfType', callPropTypeHandler.bind(null, 'union', getPropTypeOneOfType)],
    [
        'instanceOf',
        callPropTypeHandler.bind(null, 'instanceOf', getPropTypeInstanceOf),
    ],
    ['arrayOf', callPropTypeHandler.bind(null, 'arrayOf', getPropTypeArrayOf)],
    ['objectOf', callPropTypeHandler.bind(null, 'objectOf', getPropTypeObjectOf)],
    ['shape', callPropTypeHandler.bind(null, 'shape', getPropTypeShapish)],
    ['exact', callPropTypeHandler.bind(null, 'exact', getPropTypeShapish)],
]);
function callPropTypeHandler(name, handler, argumentPath) {
    let type = { name };
    if (argumentPath) {
        type = handler(type, argumentPath);
    }
    if (!type.value) {
        // If there is no argument then leave the value an empty string
        type.value = argumentPath ? printValue(argumentPath) : '';
        type.computed = true;
    }
    return type;
}
/**
 * Tries to identify the prop type by inspecting the path for known
 * prop type names. This method doesn't check whether the found type is actually
 * from React.PropTypes. It simply assumes that a match has the same meaning
 * as the React.PropTypes one.
 *
 * If there is no match, "custom" is returned.
 */
export default function getPropType(path) {
    let descriptor = null;
    getMembers(path, true).some((member) => {
        const memberPath = member.path;
        let name = null;
        if (memberPath.isStringLiteral()) {
            name = memberPath.node.value;
        }
        else if (memberPath.isIdentifier() && !member.computed) {
            name = memberPath.node.name;
        }
        if (name) {
            if (isSimplePropType(name)) {
                descriptor = { name };
                return true;
            }
            const propTypeHandler = propTypes.get(name);
            if (propTypeHandler) {
                descriptor = propTypeHandler(member.argumentPaths[0]);
                return true;
            }
        }
        return;
    });
    if (descriptor) {
        return descriptor;
    }
    if (path.isIdentifier() && isSimplePropType(path.node.name)) {
        return { name: path.node.name };
    }
    if (path.isCallExpression()) {
        const callee = path.get('callee');
        if (callee.isIdentifier()) {
            const propTypeHandler = propTypes.get(callee.node.name);
            if (propTypeHandler) {
                return propTypeHandler(path.get('arguments')[0]);
            }
        }
    }
    return { name: 'custom', raw: printValue(path) };
}
