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

      NewExpression(path, state) {
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

        if (!t.isObjectExpression(path.node.arguments[0]) || !path.node.arguments[0].properties?.[0]) {
          return;
        }

        let telemetry = path.node.arguments[0].properties.find(
          // @ts-ignore
          prop => prop.key.name === 'telemetry',
        );
        let telemetryValue: babel.types.Expression = t.objectExpression([]);

        const programPath = path.scope.getProgramParent().path as NodePath<babel.types.Program> | undefined;
        if (!programPath) {
          return;
        }

        if (telemetry && t.isObjectProperty(telemetry) && t.isExpression(telemetry.value)) {
          result.hasCustomConfig = true;
          telemetryValue = telemetry.value;

          if (t.isIdentifier(telemetry.value) && telemetry.value.name === 'telemetry') {
            const telemetryBinding = state.file.scope.getBinding('telemetry')!;

            if (telemetryBinding && t.isVariableDeclarator(telemetryBinding.path.node)) {
              const id = path.scope.generateUidIdentifier('telemetry');

              telemetryBinding.path.replaceWith(t.variableDeclarator(id, telemetryBinding.path.node.init!));
              telemetryValue = id;
            }
          }
        }

        // add the deployer export
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier('telemetry'), telemetryValue)]),
          [],
        );

        programPath.node.body.push(exportDeclaration);
      },
    },
  } as babel.PluginObj;
}
