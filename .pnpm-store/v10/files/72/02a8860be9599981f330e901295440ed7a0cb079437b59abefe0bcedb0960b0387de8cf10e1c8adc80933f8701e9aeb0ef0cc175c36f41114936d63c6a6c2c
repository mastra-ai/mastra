import resolveToValue from './resolveToValue.js';
export default function resolveExportDeclaration(path) {
    const definitions = [];
    if (path.isExportDefaultDeclaration()) {
        definitions.push(path.get('declaration'));
    }
    else if (path.isExportNamedDeclaration()) {
        if (path.has('declaration')) {
            const declaration = path.get('declaration');
            if (declaration.isVariableDeclaration()) {
                declaration
                    .get('declarations')
                    .forEach((declarator) => definitions.push(declarator));
            }
            else if (declaration.isDeclaration()) {
                definitions.push(declaration);
            }
        }
        else if (path.has('specifiers')) {
            path.get('specifiers').forEach((specifier) => {
                if (specifier.isExportSpecifier()) {
                    definitions.push(specifier.get('local'));
                }
            });
        }
    }
    return definitions.map((definition) => resolveToValue(definition));
}
