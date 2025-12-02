import getPropertyName from '../utils/getPropertyName.js';
import getMemberValuePath from '../utils/getMemberValuePath.js';
import printValue from '../utils/printValue.js';
import resolveToValue from '../utils/resolveToValue.js';
import resolveFunctionDefinitionToReturnValue from '../utils/resolveFunctionDefinitionToReturnValue.js';
import isReactComponentClass from '../utils/isReactComponentClass.js';
import isReactForwardRefCall from '../utils/isReactForwardRefCall.js';
function getDefaultValue(path) {
    let defaultValue;
    let resolvedPath = path;
    let valuePath = path;
    if (path.isBooleanLiteral()) {
        defaultValue = `${path.node.value}`;
    }
    else if (path.isNullLiteral()) {
        defaultValue = 'null';
    }
    else if (path.isLiteral()) {
        defaultValue = path.node.extra?.raw;
    }
    else {
        if (path.isAssignmentPattern()) {
            resolvedPath = resolveToValue(path.get('right'));
        }
        else {
            resolvedPath = resolveToValue(path);
        }
        if (resolvedPath.parentPath?.isImportDeclaration() && path.isIdentifier()) {
            defaultValue = path.node.name;
        }
        else {
            valuePath = resolvedPath;
            defaultValue = printValue(resolvedPath);
        }
    }
    if (typeof defaultValue !== 'undefined') {
        return {
            value: defaultValue,
            computed: valuePath.isCallExpression() ||
                valuePath.isMemberExpression() ||
                valuePath.isIdentifier(),
        };
    }
    return null;
}
function getStatelessPropsPath(componentDefinition) {
    let value = componentDefinition;
    if (isReactForwardRefCall(componentDefinition)) {
        value = resolveToValue(componentDefinition.get('arguments')[0]);
    }
    if (!value.isFunction()) {
        return;
    }
    return value.get('params')[0];
}
function getDefaultPropsPath(componentDefinition) {
    let defaultPropsPath = getMemberValuePath(componentDefinition, 'defaultProps');
    if (!defaultPropsPath) {
        return null;
    }
    defaultPropsPath = resolveToValue(defaultPropsPath);
    if (!defaultPropsPath) {
        return null;
    }
    if (defaultPropsPath.isFunctionExpression() ||
        defaultPropsPath.isFunctionDeclaration() ||
        defaultPropsPath.isClassMethod() ||
        defaultPropsPath.isObjectMethod()) {
        // Find the value that is returned from the function and process it if it is
        // an object literal.
        const returnValue = resolveFunctionDefinitionToReturnValue(defaultPropsPath);
        if (returnValue && returnValue.isObjectExpression()) {
            defaultPropsPath = returnValue;
        }
    }
    return defaultPropsPath;
}
function getDefaultValuesFromProps(properties, documentation, isStateless) {
    properties.forEach((propertyPath) => {
        if (propertyPath.isObjectProperty()) {
            const propName = getPropertyName(propertyPath);
            if (!propName)
                return;
            let valuePath = propertyPath.get('value');
            if (isStateless) {
                if (valuePath.isAssignmentPattern()) {
                    valuePath = valuePath.get('right');
                }
                else {
                    // Don't evaluate property if component is functional and the node is not an AssignmentPattern
                    return;
                }
            }
            // Initialize the prop descriptor here after the early return from above
            const propDescriptor = documentation.getPropDescriptor(propName);
            const defaultValue = getDefaultValue(valuePath);
            if (defaultValue) {
                propDescriptor.defaultValue = defaultValue;
            }
        }
        else if (propertyPath.isSpreadElement()) {
            const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
            if (resolvedValuePath.isObjectExpression()) {
                getDefaultValuesFromProps(resolvedValuePath.get('properties'), documentation, isStateless);
            }
        }
    });
}
const defaultPropsHandler = function (documentation, componentDefinition) {
    let statelessProps;
    const defaultPropsPath = getDefaultPropsPath(componentDefinition);
    /**
     * function, lazy, memo, forwardRef etc components can resolve default props as well
     */
    if (!isReactComponentClass(componentDefinition)) {
        statelessProps = getStatelessPropsPath(componentDefinition);
    }
    // Do both statelessProps and defaultProps if both are available so defaultProps can override
    if (statelessProps && statelessProps.isObjectPattern()) {
        getDefaultValuesFromProps(statelessProps.get('properties'), documentation, true);
    }
    if (defaultPropsPath && defaultPropsPath.isObjectExpression()) {
        getDefaultValuesFromProps(defaultPropsPath.get('properties'), documentation, false);
    }
};
export default defaultPropsHandler;
