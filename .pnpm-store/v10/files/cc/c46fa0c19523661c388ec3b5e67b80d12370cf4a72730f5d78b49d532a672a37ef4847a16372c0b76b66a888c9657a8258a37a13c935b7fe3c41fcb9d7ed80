import resolveGenericTypeAnnotation from '../utils/resolveGenericTypeAnnotation.js';
export default function getTypeParameters(declaration, instantiation, inputParams) {
    const params = {};
    const numInstantiationParams = instantiation.node.params.length;
    let i = 0;
    declaration
        .get('params')
        .forEach((paramPath) => {
        const key = paramPath.node.name;
        const defaultProp = paramPath.get('default');
        const defaultTypePath = defaultProp.hasNode() ? defaultProp : null;
        const typePath = i < numInstantiationParams
            ? instantiation.get('params')[i++]
            : defaultTypePath;
        if (typePath) {
            let resolvedTypePath = resolveGenericTypeAnnotation(typePath) || typePath;
            let typeName;
            if (resolvedTypePath.isTSTypeReference()) {
                typeName = resolvedTypePath.get('typeName');
            }
            else if (resolvedTypePath.isGenericTypeAnnotation()) {
                typeName = resolvedTypePath.get('id');
            }
            if (typeName &&
                inputParams &&
                typeName.isIdentifier() &&
                inputParams[typeName.node.name]) {
                resolvedTypePath = inputParams[typeName.node.name];
            }
            params[key] = resolvedTypePath;
        }
    });
    return params;
}
