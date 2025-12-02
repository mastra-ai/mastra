/**
 * See `supportedUtilityTypes` for which types are supported and
 * https://flow.org/en/docs/types/utilities/ for which types are available.
 */
export function isSupportedUtilityType(path) {
    if (path.isGenericTypeAnnotation()) {
        const idPath = path.get('id');
        if (idPath.isIdentifier()) {
            const name = idPath.node.name;
            return name === '$Exact' || name === '$ReadOnly';
        }
    }
    return false;
}
/**
 * Unwraps well known utility types. For example:
 *
 *   $ReadOnly<T> => T
 */
export function unwrapUtilityType(path) {
    let resultPath = path;
    while (isSupportedUtilityType(resultPath)) {
        const typeParameters = resultPath.get('typeParameters');
        if (!typeParameters.hasNode())
            break;
        const firstParam = typeParameters.get('params')[0];
        if (!firstParam)
            break;
        resultPath = firstParam;
    }
    return resultPath;
}
