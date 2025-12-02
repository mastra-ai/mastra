import { Scope, visitors } from '@babel/traverse';
import getMemberExpressionRoot from './getMemberExpressionRoot.js';
import getPropertyValuePath from './getPropertyValuePath.js';
import { Array as toArray } from './expressionTo.js';
import { shallowIgnoreVisitors } from './traverse.js';
import getMemberValuePath, { isSupportedDefinitionType, } from './getMemberValuePath.js';
import initialize from './ts-types/index.js';
import getNameOrValue from './getNameOrValue.js';
function findScopePath(bindingIdentifiers) {
    if (bindingIdentifiers && bindingIdentifiers[0]) {
        const resolvedParentPath = bindingIdentifiers[0].parentPath;
        if (resolvedParentPath.isImportDefaultSpecifier() ||
            resolvedParentPath.isImportSpecifier()) {
            let exportName;
            if (resolvedParentPath.isImportDefaultSpecifier()) {
                exportName = 'default';
            }
            else {
                const imported = resolvedParentPath.get('imported');
                if (imported.isStringLiteral()) {
                    exportName = imported.node.value;
                }
                else if (imported.isIdentifier()) {
                    exportName = imported.node.name;
                }
            }
            if (!exportName) {
                throw new Error('Could not detect export name');
            }
            const importedPath = resolvedParentPath.hub.import(resolvedParentPath.parentPath, exportName);
            if (importedPath) {
                return resolveToValue(importedPath);
            }
        }
        return resolveToValue(resolvedParentPath);
    }
    return null;
}
const explodedVisitors = visitors.explode({
    ...shallowIgnoreVisitors,
    AssignmentExpression: {
        enter: function (assignmentPath, state) {
            const node = state.idPath.node;
            const left = assignmentPath.get('left');
            // Skip anything that is not an assignment to a variable with the
            // passed name.
            // Ensure the LHS isn't the reference we're trying to resolve.
            if (!left.isIdentifier() ||
                left.node === node ||
                left.node.name !== node.name ||
                assignmentPath.node.operator !== '=') {
                return assignmentPath.skip();
            }
            // Ensure the RHS doesn't contain the reference we're trying to resolve.
            const candidatePath = assignmentPath.get('right');
            if (candidatePath.node === node ||
                state.idPath.findParent((parent) => parent.node === candidatePath.node)) {
                return assignmentPath.skip();
            }
            state.resultPath = candidatePath;
            return assignmentPath.skip();
        },
    },
});
/**
 * Tries to find the last value assigned to `name` in the scope created by
 * `scope`. We are not descending into any statements (blocks).
 */
function findLastAssignedValue(path, idPath) {
    const state = { idPath };
    path.traverse(explodedVisitors, state);
    return state.resultPath ? resolveToValue(state.resultPath) : null;
}
/**
 * If the path is an identifier, it is resolved in the scope chain.
 * If it is an assignment expression, it resolves to the right hand side.
 * If it is a member expression it is resolved to it's initialization value.
 *
 * Else the path itself is returned.
 */
export default function resolveToValue(path) {
    if (path.isIdentifier()) {
        if ((path.parentPath.isClass() || path.parentPath.isFunction()) &&
            path.parentPath.get('id') === path) {
            return path.parentPath;
        }
        const binding = path.scope.getBinding(path.node.name);
        let resolvedPath = null;
        if (binding) {
            // The variable may be assigned a different value after initialization.
            // We are first trying to find all assignments to the variable in the
            // block where it is defined (i.e. we are not traversing into statements)
            resolvedPath = findLastAssignedValue(binding.scope.path, path);
            if (!resolvedPath) {
                const bindingMap = binding.path.getOuterBindingIdentifierPaths(true);
                resolvedPath = findScopePath(bindingMap[path.node.name]);
            }
        }
        else {
            // Initialize our monkey-patching of @babel/traverse 🙈
            initialize(Scope);
            const typeBinding = path.scope.getTypeBinding(path.node.name);
            if (typeBinding) {
                resolvedPath = findScopePath([typeBinding.identifierPath]);
            }
        }
        return resolvedPath || path;
    }
    else if (path.isVariableDeclarator()) {
        const init = path.get('init');
        if (init.hasNode()) {
            return resolveToValue(init);
        }
    }
    else if (path.isMemberExpression()) {
        const root = getMemberExpressionRoot(path);
        const resolved = resolveToValue(root);
        if (resolved.isObjectExpression()) {
            let propertyPath = resolved;
            for (const propertyName of toArray(path).slice(1)) {
                if (propertyPath && propertyPath.isObjectExpression()) {
                    propertyPath = getPropertyValuePath(propertyPath, propertyName);
                }
                if (!propertyPath) {
                    return path;
                }
                propertyPath = resolveToValue(propertyPath);
            }
            return propertyPath;
        }
        else if (isSupportedDefinitionType(resolved)) {
            const property = path.get('property');
            if (property.isIdentifier() || property.isStringLiteral()) {
                const memberPath = getMemberValuePath(resolved, property.isIdentifier() ? property.node.name : property.node.value);
                if (memberPath) {
                    return resolveToValue(memberPath);
                }
            }
        }
        else if (resolved.isImportSpecifier() ||
            resolved.isImportDefaultSpecifier() ||
            resolved.isImportNamespaceSpecifier()) {
            const declaration = resolved.parentPath;
            // Handle references to namespace imports, e.g. import * as foo from 'bar'.
            // Try to find a specifier that matches the root of the member expression, and
            // find the export that matches the property name.
            for (const specifier of declaration.get('specifiers')) {
                const property = path.get('property');
                let propertyName;
                if (property.isIdentifier() || property.isStringLiteral()) {
                    propertyName = getNameOrValue(property);
                }
                if (specifier.isImportNamespaceSpecifier() &&
                    root.isIdentifier() &&
                    propertyName &&
                    specifier.node.local.name === root.node.name) {
                    const resolvedPath = path.hub.import(declaration, propertyName);
                    if (resolvedPath) {
                        return resolveToValue(resolvedPath);
                    }
                }
            }
        }
    }
    else if (path.isTypeCastExpression() ||
        path.isTSAsExpression() ||
        path.isTSTypeAssertion()) {
        return resolveToValue(path.get('expression'));
    }
    return path;
}
