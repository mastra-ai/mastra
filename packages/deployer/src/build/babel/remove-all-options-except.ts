import babel from '@babel/core';
import type { NodePath, types } from '@babel/core';

export function removeAllOptionsFromMastraExcept(result: { hasCustomConfig: boolean }, option: 'telemetry' | 'server') {
  const t = babel.types;

  return {
    name: 'remove-all-except-' + option + '-config',
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

        let mastraArgs = t.objectExpression([]);
        if (t.isObjectExpression(path.node.arguments[0])) {
          mastraArgs = path.node.arguments[0];
        }

        let telemetry = mastraArgs.properties.find(
          // @ts-ignore
          prop => prop.key.name === option,
        );
        let telemetryValue: types.Expression = t.objectExpression([]);

        const programPath = path.scope.getProgramParent().path as NodePath<types.Program> | undefined;
        if (!programPath) {
          return;
        }

        if (telemetry && t.isObjectProperty(telemetry) && t.isExpression(telemetry.value)) {
          result.hasCustomConfig = true;
          telemetryValue = telemetry.value;

          if (t.isIdentifier(telemetry.value) && telemetry.value.name === option) {
            const telemetryBinding = state.file.scope.getBinding(option)!;

            if (telemetryBinding && t.isVariableDeclarator(telemetryBinding.path.node)) {
              const id = path.scope.generateUidIdentifier(option);

              telemetryBinding.path.replaceWith(t.variableDeclarator(id, telemetryBinding.path.node.init!));
              telemetryValue = id;
            }
          }
        }

        // add the deployer export
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier(option), telemetryValue)]),
          [],
        );

        programPath.node.body.push(exportDeclaration);
      },
    },
  } as babel.PluginObj;
}
