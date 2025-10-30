import type { PluginObj } from '@babel/core';
import babel from '@babel/core';

export function checkConfigExport(result: { hasValidConfig: boolean }): PluginObj {
  const t = babel.types;
  // Track which local variable names are assigned to `new Mastra()`
  const mastraVars = new Set<string>();

  return {
    visitor: {
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;
        // 1) export const mastra = new Mastra(...)
        if (t.isVariableDeclaration(decl)) {
          const varDecl = decl.declarations[0];
          if (
            t.isIdentifier(varDecl?.id, { name: 'mastra' }) &&
            t.isNewExpression(varDecl.init) &&
            t.isIdentifier(varDecl.init.callee, { name: 'Mastra' })
          ) {
            result.hasValidConfig = true;
          }
        }
        /**
         * 2) export { foo as mastra }
         * 3) export { mastra }
         * 4) export { mastra, foo }
         */
        if (Array.isArray(path.node.specifiers)) {
          for (const spec of path.node.specifiers) {
            if (
              t.isExportSpecifier(spec) &&
              t.isIdentifier(spec.exported, { name: 'mastra' }) &&
              t.isIdentifier(spec.local) &&
              mastraVars.has(spec.local.name)
            ) {
              result.hasValidConfig = true;
            }
          }
        }
      },
      // For cases 2-4 we need to track whether those variables are assigned to `new Mastra()`
      VariableDeclaration(path) {
        for (const decl of path.node.declarations) {
          if (
            t.isIdentifier(decl.id) &&
            t.isNewExpression(decl.init) &&
            t.isIdentifier(decl.init.callee, { name: 'Mastra' })
          ) {
            mastraVars.add(decl.id.name);
          }
        }
      },
    },
  };
}
