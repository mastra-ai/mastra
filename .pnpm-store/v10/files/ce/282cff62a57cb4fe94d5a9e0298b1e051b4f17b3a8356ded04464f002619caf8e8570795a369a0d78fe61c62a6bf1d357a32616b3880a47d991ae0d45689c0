import isReactBuiltinReference from './isReactBuiltinReference.js';
/**
 * Unwraps NodePaths from the builtin TS types `PropsWithoutRef`,
 * `PropsWithRef` and `PropsWithChildren` and returns the inner type param.
 * If none of the builtin types is detected the path is returned as-is
 */
export default function unwrapBuiltinTSPropTypes(typePath) {
    if (typePath.isTSTypeReference()) {
        const typeName = typePath.get('typeName');
        if (isReactBuiltinReference(typeName, 'PropsWithoutRef') ||
            isReactBuiltinReference(typeName, 'PropsWithRef') ||
            isReactBuiltinReference(typeName, 'PropsWithChildren')) {
            const typeParameters = typePath.get('typeParameters');
            if (typeParameters.hasNode()) {
                const innerType = typeParameters.get('params')[0];
                if (innerType) {
                    return unwrapBuiltinTSPropTypes(innerType);
                }
            }
        }
    }
    return typePath;
}
