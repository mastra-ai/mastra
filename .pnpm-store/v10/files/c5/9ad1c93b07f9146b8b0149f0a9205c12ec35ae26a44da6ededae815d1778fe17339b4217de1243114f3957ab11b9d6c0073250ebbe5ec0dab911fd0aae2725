/**
 * Checks if the input Identifier is part of a destructuring Assignment
 * and the name of the property key matches the input name
 */
export default function isDestructuringAssignment(path, name) {
    if (!path.isObjectProperty()) {
        return false;
    }
    const id = path.get('key');
    return id.isIdentifier({ name }) && path.parentPath.isObjectPattern();
}
