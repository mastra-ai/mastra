import getMemberValuePath from '../utils/getMemberValuePath.js';
import resolveToModule from '../utils/resolveToModule.js';
import resolveToValue from '../utils/resolveToValue.js';
/**
 * It resolves the path to its module name and adds it to the "composes" entry
 * in the documentation.
 */
function amendComposes(documentation, path) {
    const moduleName = resolveToModule(path);
    if (moduleName) {
        documentation.addComposes(moduleName);
    }
}
function processObjectExpression(documentation, path) {
    path.get('properties').forEach((propertyPath) => {
        if (propertyPath.isSpreadElement()) {
            amendComposes(documentation, resolveToValue(propertyPath.get('argument')));
        }
    });
}
const propTypeCompositionHandler = function (documentation, componentDefinition) {
    let propTypesPath = getMemberValuePath(componentDefinition, 'propTypes');
    if (!propTypesPath) {
        return;
    }
    propTypesPath = resolveToValue(propTypesPath);
    if (!propTypesPath) {
        return;
    }
    if (propTypesPath.isObjectExpression()) {
        processObjectExpression(documentation, propTypesPath);
        return;
    }
    amendComposes(documentation, propTypesPath);
};
export default propTypeCompositionHandler;
