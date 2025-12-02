import { unwrapUtilityType } from '../utils/flowUtilityTypes.js';
import getFlowType from '../utils/getFlowType.js';
import getTypeFromReactComponent, { applyToTypeProperties, } from '../utils/getTypeFromReactComponent.js';
import getPropertyName from '../utils/getPropertyName.js';
import getTSType from '../utils/getTSType.js';
import resolveToValue from '../utils/resolveToValue.js';
import setPropDescription from '../utils/setPropDescription.js';
function setPropDescriptor(documentation, path, typeParams) {
    if (path.isObjectTypeSpreadProperty()) {
        const argument = unwrapUtilityType(path.get('argument'));
        if (argument.isObjectTypeAnnotation()) {
            applyToTypeProperties(documentation, argument, (propertyPath, innerTypeParams) => {
                setPropDescriptor(documentation, propertyPath, innerTypeParams);
            }, typeParams);
            return;
        }
        const id = argument.get('id');
        if (!id.hasNode() || !id.isIdentifier()) {
            return;
        }
        const resolvedPath = resolveToValue(id);
        if (resolvedPath.isTypeAlias()) {
            const right = resolvedPath.get('right');
            applyToTypeProperties(documentation, right, (propertyPath, innerTypeParams) => {
                setPropDescriptor(documentation, propertyPath, innerTypeParams);
            }, typeParams);
        }
        else if (!argument.has('typeParameters')) {
            documentation.addComposes(id.node.name);
        }
    }
    else if (path.isObjectTypeProperty()) {
        const type = getFlowType(path.get('value'), typeParams);
        const propName = getPropertyName(path);
        if (!propName)
            return;
        const propDescriptor = documentation.getPropDescriptor(propName);
        propDescriptor.required = !path.node.optional;
        propDescriptor.flowType = type;
        // We are doing this here instead of in a different handler
        // to not need to duplicate the logic for checking for
        // imported types that are spread in to props.
        setPropDescription(documentation, path);
    }
    else if (path.isTSPropertySignature()) {
        const typeAnnotation = path.get('typeAnnotation');
        if (!typeAnnotation.hasNode()) {
            return;
        }
        const type = getTSType(typeAnnotation, typeParams);
        const propName = getPropertyName(path);
        if (!propName)
            return;
        const propDescriptor = documentation.getPropDescriptor(propName);
        propDescriptor.required = !path.node.optional;
        propDescriptor.tsType = type;
        // We are doing this here instead of in a different handler
        // to not need to duplicate the logic for checking for
        // imported types that are spread in to props.
        setPropDescription(documentation, path);
    }
}
/**
 * This handler tries to find flow and TS Type annotated react components and extract
 * its types to the documentation. It also extracts docblock comments which are
 * inlined in the type definition.
 */
const codeTypeHandler = function (documentation, componentDefinition) {
    const typePaths = getTypeFromReactComponent(componentDefinition);
    if (typePaths.length === 0) {
        return;
    }
    for (const typePath of typePaths) {
        applyToTypeProperties(documentation, typePath, (propertyPath, typeParams) => {
            setPropDescriptor(documentation, propertyPath, typeParams);
        }, null);
    }
};
export default codeTypeHandler;
