export default function getTypeIdentifier(path) {
    if (path.has('id')) {
        return path.get('id');
    }
    else if (path.isTSTypeReference()) {
        return path.get('typeName');
    }
    else if (path.isTSExpressionWithTypeArguments()) {
        return path.get('expression');
    }
    return null;
}
