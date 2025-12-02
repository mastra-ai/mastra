/**
 * Returns true of the path is an unreachable TypePath
 * This evaluates the NodePaths returned from resolveToValue
 */
export default (path) => {
    return (path.isIdentifier() ||
        path.parentPath?.isImportDeclaration() ||
        path.isCallExpression());
};
