import type { PluginObj } from '@babel/core';
import * as babel from '@babel/core';

/**
 * Babel plugin that transforms Mastra exports for Cloudflare Workers compatibility.
 *
 * This plugin:
 * 1. Identifies named exports of the 'mastra' variable
 * 2. Checks if the export is a new instance of the 'Mastra' class
 * 3. Wraps the Mastra instantiation in an arrow function to ensure proper initialization
 *    in the Cloudflare Workers environment
 *
 * The transformation ensures the Mastra instance is properly scoped and initialized
 * for each request in the Cloudflare Workers environment.
 *
 * @returns {PluginObj} A Babel plugin object with a visitor that performs the transformation
 *
 * @example
 * // Before transformation:
 * export const mastra = new Mastra();
 *
 * // After transformation:
 * export const mastra = () => new Mastra();
 */
export function mastraInstanceWrapper(): PluginObj {
  const exportName = 'mastra';
  const className = 'Mastra';
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
              declaration.init = t.arrowFunctionExpression([], declaration.init);
              // there should be only one "mastra" export, so we can exit the loop
              break;
            }
          }
        }
      },
    },
  } as PluginObj;
}
