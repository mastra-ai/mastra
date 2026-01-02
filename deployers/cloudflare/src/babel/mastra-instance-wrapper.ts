import type { NodePath, PluginObj } from '@babel/core';
import * as babel from '@babel/core';
import type { MemberExpression, NewExpression, VariableDeclarator } from '@babel/types';

/**
 * Babel plugin that transforms Mastra exports for Cloudflare Workers compatibility.
 *
 * This plugin:
 * 1. Identifies named exports of the 'mastra' variable
 * 2. Checks if the export is a new instance of the 'Mastra' class
 * 3. Wraps the Mastra instantiation in an arrow function with a `cfEnv` parameter
 * 4. Transforms any `env.X` references within the Mastra config to use `cfEnv.X`
 *
 * The transformation ensures:
 * - The Mastra instance is properly scoped and initialized for each request
 * - Cloudflare bindings (Hyperdrive, D1, KV, etc.) can be accessed via the cfEnv parameter
 *
 * @returns {PluginObj} A Babel plugin object with a visitor that performs the transformation
 *
 * @example
 * // Before transformation:
 * export const mastra = new Mastra({
 *   storage: new PostgresStore({ connectionString: env.DB.connectionString })
 * });
 *
 * // After transformation:
 * export const mastra = (cfEnv) => new Mastra({
 *   storage: new PostgresStore({ connectionString: cfEnv.DB.connectionString })
 * });
 */
export function mastraInstanceWrapper(): PluginObj {
  const exportName = 'mastra';
  const className = 'Mastra';
  const envParamName = 'cfEnv';
  const t = babel.types;

  return {
    name: 'wrap-mastra',
    visitor: {
      ExportNamedDeclaration(path) {
        if (t.isVariableDeclaration(path.node?.declaration)) {
          for (const declaration of path.node.declaration.declarations) {
            if (
              t.isIdentifier(declaration?.id, { name: exportName }) &&
              t.isNewExpression(declaration?.init) &&
              t.isIdentifier(declaration.init.callee, { name: className })
            ) {
              const newExpression = declaration.init;

              // Find all `env.X` references within the Mastra constructor arguments
              // and transform them to `cfEnv.X`
              const declaratorPath = path
                .get('declaration')
                .get('declarations')
                .find(
                  (d): d is NodePath<VariableDeclarator> =>
                    t.isVariableDeclarator(d.node) && t.isIdentifier(d.node.id, { name: exportName }),
                );

              if (declaratorPath) {
                declaratorPath.traverse({
                  MemberExpression(memberPath: NodePath<MemberExpression>) {
                    // Check if this is `env.X` pattern (where env is an Identifier)
                    if (t.isIdentifier(memberPath.node.object, { name: 'env' }) && !memberPath.node.computed) {
                      // Replace `env` with `cfEnv`
                      memberPath.node.object = t.identifier(envParamName);
                    }
                  },
                });
              }

              // Wrap in arrow function with cfEnv parameter
              declaration.init = t.arrowFunctionExpression([t.identifier(envParamName)], newExpression);

              // there should be only one "mastra" export, so we can exit the loop
              break;
            }
          }
        }
      },
    },
  } as PluginObj;
}
