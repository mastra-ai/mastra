import getMemberValuePath from '../utils/getMemberValuePath.js';
import resolveToValue from '../utils/resolveToValue.js';
import setPropDescription from '../utils/setPropDescription.js';
function resolveDocumentation(documentation, path) {
    if (!path.isObjectExpression()) {
        return;
    }
    path.get('properties').forEach((propertyPath) => {
        if (propertyPath.isSpreadElement()) {
            const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
            resolveDocumentation(documentation, resolvedValuePath);
        }
        else if (propertyPath.isObjectProperty() ||
            propertyPath.isObjectMethod()) {
            setPropDescription(documentation, propertyPath);
        }
    });
}
const propDocblockHandler = function (documentation, componentDefinition) {
    let propTypesPath = getMemberValuePath(componentDefinition, 'propTypes');
    if (!propTypesPath) {
        return;
    }
    propTypesPath = resolveToValue(propTypesPath);
    if (!propTypesPath) {
        return;
    }
    resolveDocumentation(documentation, propTypesPath);
};
export default propDocblockHandler;
