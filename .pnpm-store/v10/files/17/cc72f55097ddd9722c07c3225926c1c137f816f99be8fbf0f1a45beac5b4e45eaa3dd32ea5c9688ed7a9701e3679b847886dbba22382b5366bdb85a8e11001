import getClassMemberValuePath from './getClassMemberValuePath.js';
import getMemberExpressionValuePath from './getMemberExpressionValuePath.js';
import getPropertyValuePath from './getPropertyValuePath.js';
import resolveFunctionDefinitionToReturnValue from '../utils/resolveFunctionDefinitionToReturnValue.js';
const postprocessPropTypes = (path) => path.isFunction() ? resolveFunctionDefinitionToReturnValue(path) : path;
const POSTPROCESS_MEMBERS = new Map([['propTypes', postprocessPropTypes]]);
const SUPPORTED_DEFINITION_TYPES = [
    // potential stateless function component
    'ArrowFunctionExpression',
    /**
     * Adds support for libraries such as
     * [system-components]{@link https://jxnblk.com/styled-system/system-components} that use
     * CallExpressions to generate components.
     *
     * While react-docgen's built-in resolvers do not support resolving
     * CallExpressions definitions, third-party resolvers (such as
     * https://github.com/Jmeyering/react-docgen-annotation-resolver) could be
     * used to add these definitions.
     */
    'CallExpression',
    'ClassDeclaration',
    'ClassExpression',
    // potential stateless function component
    'FunctionDeclaration',
    // potential stateless function component
    'FunctionExpression',
    'ObjectExpression',
    // potential stateless function component
    'ObjectMethod',
    /**
     * Adds support for libraries such as
     * [styled components]{@link https://github.com/styled-components} that use
     * TaggedTemplateExpression's to generate components.
     *
     * While react-docgen's built-in resolvers do not support resolving
     * TaggedTemplateExpression definitions, third-party resolvers (such as
     * https://github.com/Jmeyering/react-docgen-annotation-resolver) could be
     * used to add these definitions.
     */
    'TaggedTemplateExpression',
    'VariableDeclaration',
];
export function isSupportedDefinitionType(path) {
    return SUPPORTED_DEFINITION_TYPES.includes(path.node.type);
}
/**
 * This is a helper method for handlers to make it easier to work either with
 * an ObjectExpression from `React.createClass` class or with a class
 * definition.
 *
 * Given a path and a name, this function will either return the path of the
 * property value if the path is an ObjectExpression, or the value of the
 * ClassProperty/MethodDefinition if it is a class definition (declaration or
 * expression).
 *
 * It also normalizes the names so that e.g. `defaultProps` and
 * `getDefaultProps` can be used interchangeably.
 */
export default function getMemberValuePath(componentDefinition, memberName) {
    let result;
    if (componentDefinition.isObjectExpression()) {
        result = getPropertyValuePath(componentDefinition, memberName);
        if (!result && memberName === 'defaultProps') {
            result = getPropertyValuePath(componentDefinition, 'getDefaultProps');
        }
    }
    else if (componentDefinition.isClassDeclaration() ||
        componentDefinition.isClassExpression()) {
        result = getClassMemberValuePath(componentDefinition, memberName);
        if (!result && memberName === 'defaultProps') {
            result = getClassMemberValuePath(componentDefinition, 'getDefaultProps');
        }
    }
    else {
        result = getMemberExpressionValuePath(componentDefinition, memberName);
        if (!result && memberName === 'defaultProps') {
            result = getMemberExpressionValuePath(componentDefinition, 'getDefaultProps');
        }
    }
    const postprocessMethod = POSTPROCESS_MEMBERS.get(memberName);
    if (result && postprocessMethod) {
        result = postprocessMethod(result);
    }
    return result;
}
