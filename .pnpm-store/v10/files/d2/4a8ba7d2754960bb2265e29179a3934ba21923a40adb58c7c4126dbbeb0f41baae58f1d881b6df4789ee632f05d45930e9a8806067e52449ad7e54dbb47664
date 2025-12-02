import isExportsOrModuleAssignment from '../utils/isExportsOrModuleAssignment.js';
import resolveExportDeclaration from '../utils/resolveExportDeclaration.js';
import resolveToValue from '../utils/resolveToValue.js';
import { visitors } from '@babel/traverse';
import { shallowIgnoreVisitors } from '../utils/traverse.js';
import findComponentDefinition from '../utils/findComponentDefinition.js';
import { ERROR_CODES, ReactDocgenError } from '../error.js';
function exportDeclaration(path, state) {
    resolveExportDeclaration(path).forEach((exportedPath) => {
        const definition = findComponentDefinition(exportedPath);
        if (definition) {
            if (state.limit > 0 && state.foundDefinitions.size > 0) {
                // If a file exports multiple components, ... complain!
                throw new ReactDocgenError(ERROR_CODES.MULTIPLE_DEFINITIONS);
            }
            state.foundDefinitions.add(definition);
        }
    });
    return path.skip();
}
function assignmentExpressionVisitor(path, state) {
    // Ignore anything that is not `exports.X = ...;` or
    // `module.exports = ...;`
    if (!isExportsOrModuleAssignment(path)) {
        return path.skip();
    }
    // Resolve the value of the right hand side. It should resolve to a call
    // expression, something like React.createClass
    const resolvedPath = resolveToValue(path.get('right'));
    const definition = findComponentDefinition(resolvedPath);
    if (definition) {
        if (state.limit > 0 && state.foundDefinitions.size > 0) {
            // If a file exports multiple components, ... complain!
            throw new ReactDocgenError(ERROR_CODES.MULTIPLE_DEFINITIONS);
        }
        state.foundDefinitions.add(definition);
    }
    return path.skip();
}
const explodedVisitors = visitors.explode({
    ...shallowIgnoreVisitors,
    ExportNamedDeclaration: { enter: exportDeclaration },
    ExportDefaultDeclaration: { enter: exportDeclaration },
    AssignmentExpression: { enter: assignmentExpressionVisitor },
});
/**
 * Given an AST, this function tries to find the exported component definitions.
 *
 * The component definitions are either the ObjectExpression passed to
 * `React.createClass` or a `class` definition extending `React.Component` or
 * having a `render()` method.
 *
 * If a definition is part of the following statements, it is considered to be
 * exported:
 *
 * modules.exports = Definition;
 * exports.foo = Definition;
 * export default Definition;
 * export var Definition = ...;
 *
 * limit can be used to limit the components to be found. When the limit is reached an error will be thrown
 */
export default class FindExportedDefinitionsResolver {
    constructor({ limit = 0 } = {}) {
        this.limit = limit;
    }
    resolve(file) {
        const state = {
            foundDefinitions: new Set(),
            limit: this.limit,
        };
        file.traverse(explodedVisitors, state);
        return Array.from(state.foundDefinitions);
    }
}
