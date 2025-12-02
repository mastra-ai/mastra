/**
 * Checks if the path is a ImportSpecifier that imports the given named export
 */
export default function isImportSpecifier(path, name) {
    return (path.isImportSpecifier() &&
        (path.get('imported').isIdentifier({ name }) ||
            path.get('imported').isStringLiteral({ value: name })));
}
