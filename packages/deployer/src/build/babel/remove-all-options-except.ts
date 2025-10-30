import babel from '@babel/core';
import type { NodePath, types } from '@babel/core';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import type { IMastraLogger } from '@mastra/core/logger';

export function removeAllOptionsFromMastraExcept(
  result: { hasCustomConfig: boolean },
  option: keyof MastraConfig,
  logger?: IMastraLogger,
) {
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

        let configProperty = mastraArgs.properties.find(
          // @ts-ignore
          prop => prop.key.name === option,
        );
        let configValue: types.Expression = t.objectExpression([]);

        const programPath = path.scope.getProgramParent().path as NodePath<types.Program> | undefined;
        if (!programPath) {
          return;
        }

        if (configProperty && t.isObjectProperty(configProperty) && t.isExpression(configProperty.value)) {
          result.hasCustomConfig = true;
          configValue = configProperty.value;

          if (t.isIdentifier(configProperty.value) && configProperty.value.name === option) {
            const configBinding = state.file.scope.getBinding(option)!;

            if (configBinding && t.isVariableDeclarator(configBinding.path.node)) {
              const id = path.scope.generateUidIdentifier(option);

              configBinding.path.replaceWith(t.variableDeclarator(id, configBinding.path.node.init!));
              configValue = id;
            }
          }
        }

        // add the deployer export
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier(option), configValue)]),
          [],
        );

        programPath.node.body.push(exportDeclaration);
      },

      Program: {
        exit(path) {
          // Add a fallback export if no mastra configuration was found
          const hasExport = path.node.body.some(
            node => node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration',
          );

          if (!hasExport) {
            if (logger) {
              logger.warn(`Mastra ${option} config could not be extracted. Please make sure your entry file looks like this:
export const mastra = new Mastra({
  ${option}: <value>
})

`);
            }

            const fallbackExportDeclaration = t.exportNamedDeclaration(
              t.variableDeclaration('const', [t.variableDeclarator(t.identifier(option), t.objectExpression([]))]),
              [],
            );
            path.node.body.push(fallbackExportDeclaration);
          }
        },
      },
    },
  } as babel.PluginObj;
}
