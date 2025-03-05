import babel, { NodePath, type Node } from '@babel/core';

export function removeAllExceptTelemetryConfig(result: { hasCustomConfig: boolean }) {
  const t = babel.types;

  return {
    name: 'remove-all-except-telemetry-config',
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
        let telemetry = path.node.arguments[0]?.properties?.find(
          // @ts-ignore
          prop => prop.key.name === 'telemetry',
        );

        const programPath = path.scope.getProgramParent().path;
        if (!programPath) {
          return;
        }

        if (telemetry) {
          result.hasCustomConfig = true;
        } else {
          telemetry = {
            value: t.objectExpression([]),
          };
        }

        // add the deployer export
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier('telemetry'), telemetry.value)]),
          [],
        );

        // @ts-ignore
        programPath.node.body.push(exportDeclaration);
      },
    },
  } as babel.PluginObj;
}
