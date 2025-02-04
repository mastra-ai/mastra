import babel from '@babel/core';

export function removeAllExceptDeployer() {
  let mastraClass: string | null = null;

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
      ImportDeclaration(path) {
        if (
          (path.node.source.value === '@mastra/core' || path.node.source.value === '@mastra/core/mastra') &&
          path.node.specifiers
        ) {
          mastraClass =
            path.node.specifiers.find(
              // @ts-ignore - no need to type
              p => p.imported?.name === 'Mastra',
            )?.local?.name ?? null;
        }
      },
      NewExpression(path) {
        if (mastraClass && (path.node.callee as babel.types.Identifier).name === mastraClass) {
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
        }
      },
    },
  } as babel.PluginObj;
}
