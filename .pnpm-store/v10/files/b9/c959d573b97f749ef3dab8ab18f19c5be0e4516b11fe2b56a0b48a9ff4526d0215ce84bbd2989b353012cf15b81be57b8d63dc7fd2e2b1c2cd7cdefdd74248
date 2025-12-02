import getPropType from '../utils/getPropType.js';
import getPropertyName from '../utils/getPropertyName.js';
import getMemberValuePath from '../utils/getMemberValuePath.js';
import isReactModuleName from '../utils/isReactModuleName.js';
import isRequiredPropType from '../utils/isRequiredPropType.js';
import printValue from '../utils/printValue.js';
import resolveToModule from '../utils/resolveToModule.js';
import resolveToValue from '../utils/resolveToValue.js';
function isPropTypesExpression(path) {
    const moduleName = resolveToModule(path);
    if (moduleName) {
        return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
    }
    return false;
}
function amendPropTypes(getDescriptor, path) {
    if (!path.isObjectExpression()) {
        return;
    }
    path.get('properties').forEach((propertyPath) => {
        if (propertyPath.isObjectProperty()) {
            const propName = getPropertyName(propertyPath);
            if (!propName)
                return;
            const propDescriptor = getDescriptor(propName);
            const valuePath = resolveToValue(propertyPath.get('value'));
            const type = isPropTypesExpression(valuePath)
                ? getPropType(valuePath)
                : { name: 'custom', raw: printValue(valuePath) };
            if (type) {
                propDescriptor.type = type;
                propDescriptor.required =
                    type.name !== 'custom' && isRequiredPropType(valuePath);
            }
        }
        if (propertyPath.isSpreadElement()) {
            const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
            if (resolvedValuePath.isObjectExpression()) {
                // normal object literal
                amendPropTypes(getDescriptor, resolvedValuePath);
            }
        }
    });
}
function getPropTypeHandler(propName) {
    return function (documentation, componentDefinition) {
        let propTypesPath = getMemberValuePath(componentDefinition, propName);
        if (!propTypesPath) {
            return;
        }
        propTypesPath = resolveToValue(propTypesPath);
        if (!propTypesPath) {
            return;
        }
        let getDescriptor;
        switch (propName) {
            case 'childContextTypes':
                getDescriptor = documentation.getChildContextDescriptor;
                break;
            case 'contextTypes':
                getDescriptor = documentation.getContextDescriptor;
                break;
            default:
                getDescriptor = documentation.getPropDescriptor;
        }
        amendPropTypes(getDescriptor.bind(documentation), propTypesPath);
    };
}
export const propTypeHandler = getPropTypeHandler('propTypes');
export const contextTypeHandler = getPropTypeHandler('contextTypes');
export const childContextTypeHandler = getPropTypeHandler('childContextTypes');
