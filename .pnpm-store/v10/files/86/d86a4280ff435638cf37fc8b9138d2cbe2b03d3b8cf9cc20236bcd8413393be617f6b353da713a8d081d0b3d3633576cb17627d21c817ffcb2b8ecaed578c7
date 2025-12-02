import isReactModuleName from './isReactModuleName.js';
import resolveToModule from './resolveToModule.js';
import resolveToValue from './resolveToValue.js';
import isDestructuringAssignment from './isDestructuringAssignment.js';
import isImportSpecifier from './isImportSpecifier.js';
function isNamedMemberExpression(value, name) {
    if (!value.isMemberExpression()) {
        return false;
    }
    const property = value.get('property');
    return property.isIdentifier() && property.node.name === name;
}
/**
 * Returns true if the expression is a reference to a react export.
 */
export default function isReactBuiltinReference(path, name) {
    if (path.isMemberExpression() &&
        path.get('property').isIdentifier({ name })) {
        const module = resolveToModule(path.get('object'));
        return Boolean(module && isReactModuleName(module));
    }
    // Typescript
    if (path.isTSQualifiedName() && path.get('right').isIdentifier({ name })) {
        const module = resolveToModule(path.get('left'));
        return Boolean(module && isReactModuleName(module));
    }
    // Flow
    if (path.isQualifiedTypeIdentifier() &&
        path.get('id').isIdentifier({ name })) {
        const module = resolveToModule(path.get('qualification'));
        return Boolean(module && isReactModuleName(module));
    }
    const value = resolveToValue(path);
    if (value === path) {
        return false;
    }
    if (
    // const { x } = require('react')
    isDestructuringAssignment(value, name) ||
        // `require('react').createElement`
        isNamedMemberExpression(value, name) ||
        // `import { createElement } from 'react'`
        isImportSpecifier(value, name)) {
        const module = resolveToModule(value);
        return Boolean(module && isReactModuleName(module));
    }
    return false;
}
