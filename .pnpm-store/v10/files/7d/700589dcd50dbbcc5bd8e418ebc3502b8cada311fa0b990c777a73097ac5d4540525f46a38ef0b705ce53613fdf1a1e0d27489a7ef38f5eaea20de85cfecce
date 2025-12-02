import isUnreachableFlowType from '../utils/isUnreachableFlowType.js';
import resolveToValue from '../utils/resolveToValue.js';
import { unwrapUtilityType } from './flowUtilityTypes.js';
import getTypeIdentifier from './getTypeIdentifier.js';
function tryResolveGenericTypeAnnotation(path) {
    let typePath = unwrapUtilityType(path);
    const idPath = getTypeIdentifier(typePath);
    if (idPath) {
        typePath = resolveToValue(idPath);
        if (isUnreachableFlowType(typePath)) {
            return;
        }
        if (typePath.isTypeAlias()) {
            return tryResolveGenericTypeAnnotation(typePath.get('right'));
        }
        else if (typePath.isTSTypeAliasDeclaration()) {
            return tryResolveGenericTypeAnnotation(typePath.get('typeAnnotation'));
        }
        return typePath;
    }
    return typePath;
}
/**
 * Given an React component (stateless or class) tries to find the
 * flow or ts type for the props. If not found or not one of the supported
 * component types returns undefined.
 */
export default function resolveGenericTypeAnnotation(path) {
    const typePath = tryResolveGenericTypeAnnotation(path);
    if (!typePath || typePath === path)
        return;
    return typePath;
}
