import isReactComponentClass from '../utils/isReactComponentClass.js';
import isReactCreateClassCall from '../utils/isReactCreateClassCall.js';
import isReactForwardRefCall from '../utils/isReactForwardRefCall.js';
import isStatelessComponent from '../utils/isStatelessComponent.js';
import normalizeClassDefinition from '../utils/normalizeClassDefinition.js';
import resolveToValue from '../utils/resolveToValue.js';
import { visitors } from '@babel/traverse';
function classVisitor(path, state) {
    if (isReactComponentClass(path)) {
        normalizeClassDefinition(path);
        state.foundDefinitions.add(path);
    }
    path.skip();
}
function statelessVisitor(path, state) {
    if (isStatelessComponent(path)) {
        state.foundDefinitions.add(path);
    }
    path.skip();
}
const explodedVisitors = visitors.explode({
    FunctionDeclaration: { enter: statelessVisitor },
    FunctionExpression: { enter: statelessVisitor },
    ObjectMethod: { enter: statelessVisitor },
    ArrowFunctionExpression: { enter: statelessVisitor },
    ClassExpression: { enter: classVisitor },
    ClassDeclaration: { enter: classVisitor },
    CallExpression: {
        enter: function (path, state) {
            const argument = path.get('arguments')[0];
            if (!argument) {
                return;
            }
            if (isReactForwardRefCall(path)) {
                // If the the inner function was previously identified as a component
                // replace it with the parent node
                const inner = resolveToValue(argument);
                state.foundDefinitions.delete(inner);
                state.foundDefinitions.add(path);
                // Do not traverse into arguments
                return path.skip();
            }
            else if (isReactCreateClassCall(path)) {
                const resolvedPath = resolveToValue(argument);
                if (resolvedPath.isObjectExpression()) {
                    state.foundDefinitions.add(resolvedPath);
                }
                // Do not traverse into arguments
                return path.skip();
            }
        },
    },
});
/**
 * Given an AST, this function tries to find all object expressions that are
 * passed to `React.createClass` calls, by resolving all references properly.
 */
export default class FindAllDefinitionsResolver {
    resolve(file) {
        const state = {
            foundDefinitions: new Set(),
        };
        file.traverse(explodedVisitors, state);
        return Array.from(state.foundDefinitions);
    }
}
