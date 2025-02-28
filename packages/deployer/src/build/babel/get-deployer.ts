import babel from '@babel/core';

export function removeAllExceptDeployer() {
  const t = babel.types;

  return {
    name: 'remove-all-except-deployer',
    visitor: {
      ExportNamedDeclaration: {
        // remove all exports
        exit(path) {
          path.remove();
        },
      },

      NewExpression(path) {
        // is a variable declaration
        const varDeclaratorPath = path.findParent(path => t.isVariableDeclarator(path.node));
        if (!varDeclaratorPath) {
          return;
        }

        const parentNode = path.parentPath.node;
        // check if it's a const of mastra
        if (!t.isVariableDeclarator(parentNode) || !t.isIdentifier(parentNode.id) || parentNode.id.name !== 'mastra') {
          return;
        }

        // @ts-ignore
        const deployer = path.node.arguments[0]?.properties?.find(
          // @ts-ignore
          prop => prop.key.name === 'deployer',
        );

        const programPath = path.scope.getProgramParent().path;
        if (!deployer || !programPath) {
          return;
        }

        // add the deployer export
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier('deployer'), deployer.value)]),
          [],
        );

        // @ts-ignore
        programPath.node.body.push(exportDeclaration);
      },
    },
  } as babel.PluginObj;
}
