import normalizeClassDefinition from '../utils/normalizeClassDefinition.js';
import { visitors } from '@babel/traverse';
function isAnnotated(path, annotation) {
    let inspectPath = path;
    do {
        const leadingComments = inspectPath.node.leadingComments;
        // If an export doesn't have leading comments, we can simply continue
        if (leadingComments && leadingComments.length > 0) {
            // Search for the annotation in any comment.
            const hasAnnotation = leadingComments.some(({ value }) => value.includes(annotation));
            // if we found an annotation return true
            if (hasAnnotation) {
                return true;
            }
        }
        // return false if the container of the current path is an array
        // as we do not want to traverse up through this kind of nodes, like ArrayExpressions for example
        // The only exception is variable declarations
        if (Array.isArray(inspectPath.container) &&
            !inspectPath.isVariableDeclarator() &&
            !inspectPath.parentPath?.isCallExpression()) {
            return false;
        }
    } while ((inspectPath = inspectPath.parentPath));
    return false;
}
function classVisitor(path, state) {
    if (isAnnotated(path, state.annotation)) {
        normalizeClassDefinition(path);
        state.foundDefinitions.add(path);
    }
}
function statelessVisitor(path, state) {
    if (isAnnotated(path, state.annotation)) {
        state.foundDefinitions.add(path);
    }
}
const explodedVisitors = visitors.explode({
    ArrowFunctionExpression: { enter: statelessVisitor },
    FunctionDeclaration: { enter: statelessVisitor },
    FunctionExpression: { enter: statelessVisitor },
    ObjectMethod: { enter: statelessVisitor },
    ClassDeclaration: { enter: classVisitor },
    ClassExpression: { enter: classVisitor },
});
/**
 * Given an AST, this function tries to find all react components which
 * are annotated with an annotation
 */
export default class FindAnnotatedDefinitionsResolver {
    constructor({ annotation = '@component', } = {}) {
        this.annotation = annotation;
    }
    resolve(file) {
        const state = {
            foundDefinitions: new Set(),
            annotation: this.annotation,
        };
        file.traverse(explodedVisitors, state);
        return Array.from(state.foundDefinitions);
    }
}
