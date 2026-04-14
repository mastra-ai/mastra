import type { PluginObj } from '@babel/core';
import * as babel from '@babel/core';

/**
 * Babel plugin that transforms Mastra exports for Cloudflare Workers compatibility.
 *
 * This plugin:
 * 1. Identifies named exports of the 'mastra' variable
 * 2. If the export is `new Mastra(...)`, wraps it in an arrow function so that
 *    instantiation is deferred until request time (Workers bindings are available)
 * 3. If the export is already a function (arrow or function expression), it is
 *    left untouched — this lets users write a factory that takes `env` directly:
 *      `export const mastra = (env) => new Mastra({ storage: new D1Store({ binding: env.D1Database }), ... })`
 *
 * The generated worker entry calls `mastra(env)` so both forms work:
 * - Auto-wrapped `() => new Mastra(...)` accepts and ignores the env arg
 * - Explicit factory `(env) => new Mastra(...)` receives the bindings
 *
 * @returns {PluginObj} A Babel plugin object with a visitor that performs the transformation
 *
 * @example
 * // Pattern A (existing) — wrapper transforms to () => new Mastra()
 * export const mastra = new Mastra();
 *
 * // Pattern B (new) — explicit factory, wrapper leaves it alone
 * export const mastra = (env) => new Mastra({
 *   storage: new D1Store({ binding: env.D1Database }),
 * });
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
            if (!t.isIdentifier(declaration?.id, { name: exportName })) continue;

            // Already a factory (arrow/function expression) — user opted into the
            // env-aware form, leave it unchanged.
            if (
              t.isArrowFunctionExpression(declaration?.init) ||
              t.isFunctionExpression(declaration?.init)
            ) {
              break;
            }

            if (
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
