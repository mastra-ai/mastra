import babel from '@babel/core';

export function removeDeployer() {
  const t = babel.types;
  let mastraClass: string | null = null;
  let hasReplaced = false;

  return {
    name: 'remove-deployer',
    visitor: {
      ImportDeclaration(path) {
        if (
          (path.node.source.value === '@mastra/core' || path.node.source.value === '@mastra/core/mastra') &&
          path.node.specifiers
        ) {
          const mastraObj = path.node.specifiers.find(
            p => t.isImportSpecifier(p) && t.isIdentifier(p.imported) && p.imported.name === 'Mastra',
          );

          if (mastraObj?.local?.name) {
            mastraClass = mastraObj.local.name;
          }
        }
      },
      NewExpression(path) {
        if (mastraClass && t.isIdentifier(path.node.callee) && path.node.callee.name === mastraClass && !hasReplaced) {
          hasReplaced = true;
          const newMastraObj = t.cloneNode(path.node);
          if (t.isObjectExpression(newMastraObj.arguments[0]) && newMastraObj.arguments[0].properties?.[0]) {
            newMastraObj.arguments[0].properties = newMastraObj.arguments[0].properties.filter(
              prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name !== 'deployer',
            );
            path.replaceWith(newMastraObj);
          }
        }
      },
    },
  } as babel.PluginObj;
}
